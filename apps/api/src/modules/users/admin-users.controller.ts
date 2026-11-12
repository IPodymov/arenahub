import {
  Body,
  Controller,
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
  type AdminUserDto,
  adminUserListQuery,
  type Paginated,
  setUserRoleSchema,
} from '@arenahub/shared';
import type { z } from 'zod';
import { AdminGuard, CurrentUser, type SessionUser } from '../../common/auth';
import { ZodPipe } from '../../common/zod.pipe';
import { AdminUsersService } from './admin-users.service';

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(
    @Query(new ZodPipe(adminUserListQuery)) q: z.output<typeof adminUserListQuery>,
  ): Promise<Paginated<AdminUserDto>> {
    return this.users.list(q);
  }

  @Patch(':id/role')
  setRole(
    @CurrentUser() actor: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(setUserRoleSchema)) body: z.output<typeof setUserRoleSchema>,
  ): Promise<AdminUserDto> {
    return this.users.setRole(actor.id, id, body.role);
  }

  @Post(':id/ban')
  @HttpCode(200)
  ban(
    @CurrentUser() actor: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserDto> {
    return this.users.setBanned(actor.id, id, true);
  }

  @Post(':id/unban')
  @HttpCode(200)
  unban(
    @CurrentUser() actor: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserDto> {
    return this.users.setBanned(actor.id, id, false);
  }
}
