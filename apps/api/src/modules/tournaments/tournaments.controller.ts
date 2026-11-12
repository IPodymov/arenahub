import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type BracketDto,
  type MyRegistrationDto,
  type Paginated,
  type ParticipantDto,
  registerForTournamentSchema,
  type TournamentDto,
  tournamentListQuery,
  type TournamentSummaryDto,
} from '@arenahub/shared';
import type { z } from 'zod';
import { AuthenticatedGuard, CurrentUser, type SessionUser } from '../../common/auth';
import { ZodPipe } from '../../common/zod.pipe';
import { RegistrationsService } from './registrations.service';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(
    private readonly tournaments: TournamentsService,
    private readonly registrations: RegistrationsService,
  ) {}

  @Get()
  list(
    @Query(new ZodPipe(tournamentListQuery)) query: z.output<typeof tournamentListQuery>,
  ): Promise<Paginated<TournamentSummaryDto>> {
    return this.tournaments.list(query);
  }

  @Get(':slug')
  get(@Param('slug') slug: string): Promise<TournamentDto> {
    return this.tournaments.getPublic(slug);
  }

  @Get(':slug/participants')
  participants(@Param('slug') slug: string): Promise<ParticipantDto[]> {
    return this.tournaments.participants(slug);
  }

  @Get(':slug/bracket')
  bracket(@Param('slug') slug: string): Promise<BracketDto> {
    return this.tournaments.bracket(slug);
  }

  @Post(':slug/registrations')
  @UseGuards(AuthenticatedGuard)
  register(
    @CurrentUser() user: SessionUser,
    @Param('slug') slug: string,
    @Body(new ZodPipe(registerForTournamentSchema))
    body: z.output<typeof registerForTournamentSchema>,
  ): Promise<MyRegistrationDto> {
    return this.registrations.register(user.id, slug, body);
  }

  @Get(':slug/registrations/mine')
  @UseGuards(AuthenticatedGuard)
  async mine(
    @CurrentUser() user: SessionUser,
    @Param('slug') slug: string,
  ): Promise<{ registration: MyRegistrationDto | null }> {
    return { registration: await this.registrations.mine(user.id, slug) };
  }

  @Delete(':slug/registrations/mine')
  @HttpCode(204)
  @UseGuards(AuthenticatedGuard)
  withdraw(@CurrentUser() user: SessionUser, @Param('slug') slug: string): Promise<void> {
    return this.registrations.withdraw(user.id, slug);
  }
}
