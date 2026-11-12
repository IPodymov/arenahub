import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  changePasswordSchema,
  type ChangePasswordInput,
  type MeDto,
  type PublicUserDto,
  setBirthDateSchema,
  type SetBirthDateInput,
  updateProfileSchema,
  type UpdateProfileData,
} from '@arenahub/shared';
import type { Request } from 'express';
import { AuthenticatedGuard, CurrentUser, logIn, type SessionUser } from '../../common/auth';
import { ZodPipe } from '../../common/zod.pipe';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @UseGuards(AuthenticatedGuard)
  update(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileData,
  ): Promise<MeDto> {
    return this.users.updateProfile(user.id, body);
  }

  @Put('me/password')
  @HttpCode(204)
  @UseGuards(AuthenticatedGuard)
  async changePassword(
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
    @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordInput,
  ): Promise<void> {
    const updated = await this.users.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
    // Текущее устройство остаётся в аккаунте с новой версией сессии
    await logIn(req, updated);
  }

  @Post('me/sessions/revoke')
  @HttpCode(204)
  @UseGuards(AuthenticatedGuard)
  async revokeOtherSessions(@CurrentUser() user: SessionUser, @Req() req: Request): Promise<void> {
    await logIn(req, await this.users.revokeOtherSessions(user.id));
  }

  @Put('me/birth-date')
  @UseGuards(AuthenticatedGuard)
  setBirthDate(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(setBirthDateSchema)) body: SetBirthDateInput,
  ): Promise<MeDto> {
    return this.users.setBirthDate(user.id, body.birthDate);
  }

  @Get(':id')
  async getPublic(@Param('id', ParseUUIDPipe) id: string): Promise<PublicUserDto> {
    const user = await this.users.getPublic(id);
    if (!user)
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Пользователь не найден' });
    return user;
  }
}
