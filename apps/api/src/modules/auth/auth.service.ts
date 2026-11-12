import { Inject, Injectable } from '@nestjs/common';
import { nicknameSchema } from '@arenahub/shared';
import { randomInt } from 'node:crypto';
import { ENV, type Env } from '../../config/env';
import type { SessionUser } from '../../common/auth';
import { DomainError } from '../../common/domain-error';
import { isUniqueViolation } from '../../common/prisma-errors';
import { PrismaService } from '../../infra/prisma.service';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password';

export interface SteamProfileData {
  steamId: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Вход через Steam: находит пользователя по steamid64 или создаёт нового. */
  async loginWithSteam(profile: SteamProfileData): Promise<SessionUser> {
    const isAdmin = this.env.ADMIN_STEAM_IDS.includes(profile.steamId);
    const accountData = {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      profileUrl: profile.profileUrl,
      verifiedAt: new Date(),
    };

    const existing = await this.prisma.linkedAccount.findUnique({
      where: { provider_externalId: { provider: 'STEAM', externalId: profile.steamId } },
      include: { user: true },
    });
    if (existing) {
      await this.prisma.linkedAccount.update({ where: { id: existing.id }, data: accountData });
      const user =
        isAdmin && existing.user.role !== 'ADMIN'
          ? await this.prisma.user.update({
              where: { id: existing.userId },
              data: { role: 'ADMIN' },
            })
          : existing.user;
      return this.toSessionUser(user);
    }

    const user = await this.prisma.user.create({
      data: {
        nickname: await this.freeNickname(profile.displayName),
        avatarUrl: profile.avatarUrl,
        role: isAdmin ? 'ADMIN' : 'USER',
        linkedAccounts: {
          create: { provider: 'STEAM', externalId: profile.steamId, ...accountData },
        },
      },
    });
    return this.toSessionUser(user);
  }

  /** Регистрация по никнейму и паролю (до подключения внешних аккаунтов). */
  async register(nickname: string, password: string): Promise<SessionUser> {
    const passwordHash = await hashPassword(password);
    try {
      const user = await this.prisma.user.create({
        data: { nickname, passwordHash, role: this.isAdminNickname(nickname) ? 'ADMIN' : 'USER' },
      });
      return this.toSessionUser(user);
    } catch (err) {
      if (isUniqueViolation(err)) throw new DomainError('NICKNAME_TAKEN');
      throw err;
    }
  }

  /** Вход по никнейму или почте (если в логине есть «@»). */
  async loginWithPassword(login: string, password: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: login.includes('@') ? { email: login.toLowerCase() } : { nickname: login },
    });
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user?.passwordHash || !ok) throw new DomainError('INVALID_CREDENTIALS');
    if (this.isAdminNickname(user.nickname) && user.role !== 'ADMIN') {
      return this.toSessionUser(
        await this.prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } }),
      );
    }
    return this.toSessionUser(user);
  }

  /** Только для пользователей с паролем: у Steam-входа свой список ADMIN_STEAM_IDS. */
  private isAdminNickname(nickname: string): boolean {
    return this.env.ADMIN_NICKNAMES.includes(nickname);
  }

  /** Вход без Steam для локальной разработки и e2e. Создаёт фиктивный подтверждённый Steam-аккаунт. */
  async devLogin(nickname: string, asAdmin: boolean): Promise<SessionUser> {
    const user = await this.prisma.user.upsert({
      where: { nickname },
      create: {
        nickname,
        role: asAdmin ? 'ADMIN' : 'USER',
        linkedAccounts: {
          create: {
            provider: 'STEAM',
            externalId: `dev:${nickname}`,
            displayName: nickname,
            verifiedAt: new Date(),
          },
        },
      },
      update: asAdmin ? { role: 'ADMIN' } : {},
    });
    return this.toSessionUser(user);
  }

  /** Для десериализации сессии: актуальная роль; забаненные и отозванные сессии не проходят. */
  async findSessionUser(id: string, sessionVersion: number): Promise<SessionUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.bannedAt || user.sessionVersion !== sessionVersion) return null;
    return { id: user.id, role: user.role, sessionVersion: user.sessionVersion };
  }

  private toSessionUser(user: {
    id: string;
    role: SessionUser['role'];
    bannedAt: Date | null;
    sessionVersion: number;
  }): SessionUser {
    if (user.bannedAt) throw new DomainError('USER_BANNED');
    return { id: user.id, role: user.role, sessionVersion: user.sessionVersion };
  }

  private async freeNickname(displayName: string): Promise<string> {
    const cleaned = displayName.replace(/[^\p{L}\p{N}_.-]/gu, '').slice(0, 18);
    const base = nicknameSchema.safeParse(cleaned).success ? cleaned : 'player';
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate =
        attempt === 0 && base !== 'player' ? base : `${base}${randomInt(1000, 9999)}`;
      const taken = await this.prisma.user.findUnique({
        where: { nickname: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `player${Date.now()}`;
  }
}
