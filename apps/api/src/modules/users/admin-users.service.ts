import { Injectable } from '@nestjs/common';
import type { AdminUserDto, Paginated, UserRole } from '@arenahub/shared';
import { DomainError } from '../../common/domain-error';
import { Clock } from '../../infra/clock';
import { PrismaService } from '../../infra/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

type UserRow = Prisma.UserGetPayload<object>;

function toDto(u: UserRow): AdminUserDto {
  return {
    id: u.id,
    nickname: u.nickname,
    role: u.role,
    bannedAt: u.bannedAt?.toISOString() ?? null,
    canLogin: u.passwordHash !== null,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Роли и баны. Себе ничего из этого сделать нельзя, чтобы админ не заблокировал сам себя. */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list(query: {
    q?: string;
    role?: UserRole;
    page: number;
    pageSize: number;
  }): Promise<Paginated<AdminUserDto>> {
    const where: Prisma.UserWhereInput = {
      nickname: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
      role: query.role,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        // Сначала персонал, затем новые
        orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toDto), total, page: query.page, pageSize: query.pageSize };
  }

  setRole(actorId: string, userId: string, role: UserRole): Promise<AdminUserDto> {
    return this.change(actorId, userId, { role });
  }

  setBanned(actorId: string, userId: string, banned: boolean): Promise<AdminUserDto> {
    // Сессии забаненного отваливаются сами: роль и бан проверяются при каждом запросе
    return this.change(actorId, userId, { bannedAt: banned ? this.clock.now() : null });
  }

  private async change(
    actorId: string,
    userId: string,
    data: Prisma.UserUpdateInput,
  ): Promise<AdminUserDto> {
    if (actorId === userId) throw new DomainError('CANNOT_MODERATE_SELF');
    const exists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!exists) throw new DomainError('USER_NOT_FOUND');
    return toDto(await this.prisma.user.update({ where: { id: userId }, data }));
  }
}
