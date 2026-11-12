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
  adminTournamentListQuery,
  createTournamentSchema,
  type Paginated,
  rejectTournamentSchema,
  type TournamentDto,
  type TournamentSummaryDto,
  updateTournamentSchema,
} from '@arenahub/shared';
import { z } from 'zod';
import { CurrentUser, type SessionUser, StaffGuard } from '../../common/auth';
import { ZodPipe } from '../../common/zod.pipe';
import type { StatusAction } from './domain/tournament-phase';
import { TournamentsService } from './tournaments.service';

// reject — отдельный маршрут: ему нужна причина в теле
const statusAction = z.enum(['publish', 'start', 'complete', 'cancel', 'approve']);

/** Модераторы и админы: создание без премодерации, жизненный цикл, рассмотрение предложений. */
@Controller('admin/tournaments')
@UseGuards(StaffGuard)
export class AdminTournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Get()
  list(
    @Query(new ZodPipe(adminTournamentListQuery)) q: z.output<typeof adminTournamentListQuery>,
  ): Promise<Paginated<TournamentSummaryDto>> {
    return this.tournaments.adminList(q.page, q.pageSize, q.status);
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

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(rejectTournamentSchema)) body: z.output<typeof rejectTournamentSchema>,
  ): Promise<TournamentDto> {
    return this.tournaments.changeStatus(id, 'reject', body.note);
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
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tournaments.remove(id, user.role);
  }
}
