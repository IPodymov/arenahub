import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { DomainError } from '../../common/domain-error';
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

  /** multipart/form-data, поле file. Картинку обрабатывает сервер, внешние ссылки не принимаются. */
  @Put('me/avatar')
  @UseGuards(AuthenticatedGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  setAvatar(
    @CurrentUser() user: SessionUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MeDto> {
    if (!file) throw new DomainError('AVATAR_INVALID');
    return this.users.setAvatar(user.id, file.buffer);
  }

  @Delete('me/avatar')
  @UseGuards(AuthenticatedGuard)
  removeAvatar(@CurrentUser() user: SessionUser): Promise<MeDto> {
    return this.users.removeAvatar(user.id);
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
