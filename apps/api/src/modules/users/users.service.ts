import { Injectable } from '@nestjs/common';
import {
  ageAt,
  type MeDto,
  PLATFORM_MIN_AGE,
  type PublicUserDto,
  type UpdateProfileInput,
} from '@arenahub/shared';
import { dateOnlyToString, stringToDateOnly } from '../../common/dates';
import { DomainError } from '../../common/domain-error';
import { isUniqueViolation } from '../../common/prisma-errors';
import { Clock } from '../../infra/clock';
import { PrismaService } from '../../infra/prisma.service';
import { computeEligibility } from './age-policy';

const meInclude = { linkedAccounts: { orderBy: { createdAt: 'asc' } } } as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
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

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<MeDto> {
    try {
      await this.prisma.user.update({ where: { id: userId }, data: input });
    } catch (err) {
      if (isUniqueViolation(err)) throw new DomainError('NICKNAME_TAKEN');
      throw err;
    }
    return this.getMe(userId);
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
