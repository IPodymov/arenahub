import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  type MeDto,
  type PublicUserDto,
  setBirthDateSchema,
  type SetBirthDateInput,
  updateProfileSchema,
  type UpdateProfileInput,
} from '@arenahub/shared';
import { AuthenticatedGuard, CurrentUser, type SessionUser } from '../../common/auth';
import { ZodPipe } from '../../common/zod.pipe';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @UseGuards(AuthenticatedGuard)
  update(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<MeDto> {
    return this.users.updateProfile(user.id, body);
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
