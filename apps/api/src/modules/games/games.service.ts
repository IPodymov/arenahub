import { Injectable } from '@nestjs/common';
import type { GameCode, GameDto } from '@arenahub/shared';
import { DomainError } from '../../common/domain-error';
import { PrismaService } from '../../infra/prisma.service';
import { toGameDto } from './games.mapper';

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<GameDto[]> {
    const games = await this.prisma.game.findMany({
      where: { isActive: true },
      include: { policy: true },
      orderBy: { sortOrder: 'asc' },
    });
    return games.map(toGameDto);
  }

  async getByCode(code: GameCode): Promise<GameDto> {
    const game = await this.prisma.game.findUnique({ where: { code }, include: { policy: true } });
    if (!game) throw new DomainError('GAME_NOT_FOUND');
    return toGameDto(game);
  }
}
