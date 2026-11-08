import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createTournamentSchema,
  type Paginated,
  paginationQuery,
  type TournamentDto,
  type TournamentSummaryDto,
  updateTournamentSchema,
} from '@arenahub/shared';
import { z } from 'zod';
import { AdminGuard, CurrentUser, type SessionUser } from '../../common/auth';
import { ZodPipe } from '../../common/zod.pipe';
import type { StatusAction } from './domain/tournament-phase';
import { TournamentsService } from './tournaments.service';

const statusAction = z.enum(['publish', 'start', 'complete', 'cancel']);

@Controller('admin/tournaments')
@UseGuards(AdminGuard)
export class AdminTournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Get()
  list(
    @Query(new ZodPipe(paginationQuery)) q: z.output<typeof paginationQuery>,
  ): Promise<Paginated<TournamentSummaryDto>> {
    return this.tournaments.adminList(q.page, q.pageSize);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<TournamentDto> {
    return this.tournaments.adminGet(id);
  }

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(createTournamentSchema)) body: z.output<typeof createTournamentSchema>,
  ): Promise<TournamentDto> {
    return this.tournaments.create(user.id, body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateTournamentSchema)) body: z.output<typeof updateTournamentSchema>,
  ): Promise<TournamentDto> {
    return this.tournaments.update(id, body);
  }

  @Post(':id/:action')
  @HttpCode(200)
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('action', new ZodPipe(statusAction)) action: StatusAction,
  ): Promise<TournamentDto> {
    return this.tournaments.changeStatus(id, action);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tournaments.remove(id);
  }
}
