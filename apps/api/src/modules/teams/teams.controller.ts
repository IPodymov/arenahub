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
  UseGuards,
} from '@nestjs/common';
import {
  createInviteSchema,
  createTeamSchema,
  type InvitePreviewDto,
  setMemberRoleSchema,
  type TeamDto,
  type TeamInviteDto,
  transferCaptainSchema,
  updateTeamSchema,
} from '@arenahub/shared';
import type { z } from 'zod';
import { AuthenticatedGuard, CurrentUser, type SessionUser } from '../../common/auth';
import { ZodPipe } from '../../common/zod.pipe';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  @UseGuards(AuthenticatedGuard)
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(createTeamSchema)) body: z.output<typeof createTeamSchema>,
  ): Promise<TeamDto> {
    return this.teams.create(user.id, body);
  }

  @Get('mine')
  @UseGuards(AuthenticatedGuard)
  mine(@CurrentUser() user: SessionUser): Promise<TeamDto[]> {
    return this.teams.listForUser(user.id);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<TeamDto> {
    return this.teams.get(id);
  }

  @Patch(':id')
  @UseGuards(AuthenticatedGuard)
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateTeamSchema)) body: z.output<typeof updateTeamSchema>,
  ): Promise<TeamDto> {
    return this.teams.update(user.id, id, body);
  }

  @Post(':id/invites')
  @UseGuards(AuthenticatedGuard)
  createInvite(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(createInviteSchema)) body: z.output<typeof createInviteSchema>,
  ): Promise<TeamInviteDto> {
    return this.teams.createInvite(user.id, id, body);
  }

  @Delete(':id/invites/:inviteId')
  @HttpCode(204)
  @UseGuards(AuthenticatedGuard)
  revokeInvite(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ): Promise<void> {
    return this.teams.revokeInvite(user.id, id, inviteId);
  }

  @Post(':id/leave')
  @HttpCode(204)
  @UseGuards(AuthenticatedGuard)
  leave(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.teams.leave(user.id, id);
  }

  @Post(':id/captain')
  @UseGuards(AuthenticatedGuard)
  transferCaptain(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(transferCaptainSchema)) body: z.output<typeof transferCaptainSchema>,
  ): Promise<TeamDto> {
    return this.teams.transferCaptain(user.id, id, body.userId);
  }

  @Patch(':id/members/:userId')
  @UseGuards(AuthenticatedGuard)
  setRole(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodPipe(setMemberRoleSchema)) body: z.output<typeof setMemberRoleSchema>,
  ): Promise<TeamDto> {
    return this.teams.setMemberRole(user.id, id, userId, body.role);
  }

  @Delete(':id/members/:userId')
  @UseGuards(AuthenticatedGuard)
  kick(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<TeamDto> {
    return this.teams.kick(user.id, id, userId);
  }
}

@Controller('invites')
export class InvitesController {
  constructor(private readonly teams: TeamsService) {}

  @Get(':token')
  preview(@Param('token') token: string): Promise<InvitePreviewDto> {
    return this.teams.previewInvite(token);
  }

  @Post(':token/accept')
  @UseGuards(AuthenticatedGuard)
  accept(@CurrentUser() user: SessionUser, @Param('token') token: string): Promise<TeamDto> {
    return this.teams.acceptInvite(user.id, token);
  }
}
