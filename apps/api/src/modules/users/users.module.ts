import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AvatarStorage } from './avatar-storage';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, AdminUsersService, AvatarStorage],
  exports: [UsersService],
})
export class UsersModule {}
