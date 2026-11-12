import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createTournamentSchema, type TournamentDto } from '@arenahub/shared';
import type { z } from 'zod';
import { AuthenticatedGuard, CurrentUser, type SessionUser } from '../../common/auth';
import { ZodPipe } from '../../common/zod.pipe';
import { TournamentsService } from './tournaments.service';

/** Пользователь предлагает турнир — он появится в каталоге после одобрения модератором. */
@Controller('proposals')
@UseGuards(AuthenticatedGuard)
export class ProposalsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(createTournamentSchema)) body: z.output<typeof createTournamentSchema>,
  ): Promise<TournamentDto> {
    return this.tournaments.propose(user.id, body);
  }

  /** Все турниры, созданные пользователем, вместе с решением модератора. */
  @Get('mine')
  mine(@CurrentUser() user: SessionUser): Promise<TournamentDto[]> {
    return this.tournaments.myProposals(user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  withdraw(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.tournaments.withdrawProposal(user.id, id);
  }
}
