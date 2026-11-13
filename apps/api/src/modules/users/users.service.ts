import { Injectable } from '@nestjs/common';
import {
  ageAt,
  type MeDto,
  PLATFORM_MIN_AGE,
  type PublicUserDto,
  type UpdateProfileData,
} from '@arenahub/shared';
import type { SessionUser } from '../../common/auth';
import { dateOnlyToString, stringToDateOnly } from '../../common/dates';
import { DomainError } from '../../common/domain-error';
import { isUniqueViolation } from '../../common/prisma-errors';
import { Clock } from '../../infra/clock';
import { PrismaService } from '../../infra/prisma.service';
import { hashPassword, verifyPassword } from '../auth/password';
import { computeEligibility } from './age-policy';
import { AvatarStorage } from './avatar-storage';

const meInclude = { linkedAccounts: { orderBy: { createdAt: 'asc' } } } as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly avatars: AvatarStorage,
  ) {}

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: meInclude,
    });
    const birthDate = user.birthDate ? dateOnlyToString(user.birthDate) : null;
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      email: user.email,
      hasPassword: user.passwordHash !== null,
      role: user.role,
      birthDate,
      eligibility: computeEligibility(birthDate, this.clock.now()),
      linkedAccounts: user.linkedAccounts.map((a) => ({
        provider: a.provider,
        externalId: a.externalId,
        displayName: a.displayName,
        profileUrl: a.profileUrl,
        verified: a.verifiedAt !== null,
      })),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async getPublic(userId: string): Promise<PublicUserDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        linkedAccounts: true,
        teamMemberships: {
          where: { team: { disbandedAt: null } },
          include: { team: { include: { game: true } } },
        },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      linkedAccounts: user.linkedAccounts.map((a) => ({
        provider: a.provider,
        displayName: a.displayName,
        profileUrl: a.profileUrl,
      })),
      teams: user.teamMemberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        tag: m.team.tag,
        gameCode: m.team.game.code,
      })),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, input: UpdateProfileData): Promise<MeDto> {
    try {
      await this.prisma.user.update({ where: { id: userId }, data: input });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Уникальны и ник, и почта — выясняем, что именно занято
      const emailTaken =
        input.email &&
        (await this.prisma.user.count({ where: { email: input.email, id: { not: userId } } }));
      throw new DomainError(emailTaken ? 'EMAIL_TAKEN' : 'NICKNAME_TAKEN');
    }
    return this.getMe(userId);
  }

  /** Новый аватар из загруженного файла; прежний файл удаляется после успешного сохранения. */
  async setAvatar(userId: string, file: Buffer): Promise<MeDto> {
    const { avatarUrl: previous } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const avatarUrl = await this.avatars.save(userId, file);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    await this.avatars.remove(previous);
    return this.getMe(userId);
  }

  async removeAvatar(userId: string): Promise<MeDto> {
    const { avatarUrl } = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    await this.avatars.remove(avatarUrl);
    return this.getMe(userId);
  }

  /**
   * Смена пароля (или установка первого — без текущего). Версия сессии растёт,
   * поэтому все остальные устройства разлогиниваются; вызывающий перезаписывает свою сессию.
   */
  async changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
  ): Promise<SessionUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (
      user.passwordHash &&
      !(currentPassword && (await verifyPassword(currentPassword, user.passwordHash)))
    )
      throw new DomainError('WRONG_PASSWORD');
    return this.bumpSessionVersion(userId, { passwordHash: await hashPassword(newPassword) });
  }

  /** «Выйти на других устройствах». */
  revokeOtherSessions(userId: string): Promise<SessionUser> {
    return this.bumpSessionVersion(userId, {});
  }

  private async bumpSessionVersion(
    userId: string,
    data: { passwordHash?: string },
  ): Promise<SessionUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { ...data, sessionVersion: { increment: 1 } },
    });
    return { id: user.id, role: user.role, sessionVersion: user.sessionVersion };
  }

  /** Дату рождения пользователь задаёт один раз; дальше — только через поддержку. */
  async setBirthDate(userId: string, birthDate: string): Promise<MeDto> {
    const now = this.clock.now();
    const age = ageAt(birthDate, now);
    if (age > 120 || birthDate > now.toISOString().slice(0, 10))
      throw new DomainError('BIRTH_DATE_INVALID');
    if (age < PLATFORM_MIN_AGE) throw new DomainError('AGE_BELOW_PLATFORM_MINIMUM');

    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, birthDate: null },
      data: { birthDate: stringToDateOnly(birthDate), birthDateSetAt: now },
    });
    if (count === 0) throw new DomainError('BIRTH_DATE_ALREADY_SET');
    return this.getMe(userId);
  }
}
