import { Controller, Get, Param } from '@nestjs/common';
import { GameCode, type GameDto } from '@arenahub/shared';
import { ZodPipe } from '../../common/zod.pipe';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  list(): Promise<GameDto[]> {
    return this.games.list();
  }

  @Get(':code')
  get(@Param('code', new ZodPipe(GameCode)) code: GameCode): Promise<GameDto> {
    return this.games.getByCode(code);
  }
}
