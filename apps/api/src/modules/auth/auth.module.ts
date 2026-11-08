import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { loadEnv } from '../../config/env';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionSerializer } from './session.serializer';
import { SteamStrategy } from './steam.strategy';

// Steam-стратегия регистрируется только при наличии ключа — без него /auth/steam отвечает 503.
const steamProviders = loadEnv().STEAM_API_KEY ? [SteamStrategy] : [];

@Module({
  imports: [PassportModule.register({ session: true }), UsersModule],
  controllers: [AuthController],
  providers: [AuthService, SessionSerializer, ...steamProviders],
})
export class AuthModule {}
