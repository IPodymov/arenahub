import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { devLoginSchema, type MeDto } from '@arenahub/shared';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { ENV, type Env } from '../../config/env';
import { AuthenticatedGuard, CurrentUser, type SessionUser } from '../../common/auth';
import { ZodPipe } from '../../common/zod.pipe';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './session';

/** Запускает Steam OpenID и после возврата сохраняет пользователя в сессии. */
@Injectable()
class SteamAuthGuard extends AuthGuard('steam') {
  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  override async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.env.STEAM_API_KEY) {
      throw new ServiceUnavailableException({
        code: 'STEAM_DISABLED',
        message: 'Вход через Steam не настроен (STEAM_API_KEY)',
      });
    }
    const ok = (await super.canActivate(ctx)) as boolean;
    await super.logIn(ctx.switchToHttp().getRequest());
    return ok;
  }
}

function logIn(req: Request, user: SessionUser): Promise<void> {
  return new Promise((resolve, reject) =>
    req.logIn(user, (err) => (err ? reject(err) : resolve())),
  );
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('steam')
  @UseGuards(SteamAuthGuard)
  steam(): void {
    // Passport перенаправляет на Steam
  }

  @Get('steam/return')
  @UseGuards(SteamAuthGuard)
  steamReturn(@Res() res: Response): void {
    res.redirect(`${this.env.WEB_ORIGIN}/profile`);
  }

  @Post('dev-login')
  @HttpCode(200)
  async devLogin(
    @Req() req: Request,
    @Body(new ZodPipe(devLoginSchema)) body: z.output<typeof devLoginSchema>,
  ): Promise<MeDto> {
    if (!this.env.AUTH_DEV_LOGIN) throw new NotFoundException();
    const user = await this.auth.devLogin(body.nickname, body.asAdmin);
    await logIn(req, user);
    return this.users.getMe(user.id);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      req.logout((err) => (err ? reject(err) : resolve())),
    );
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  me(@CurrentUser() user: SessionUser): Promise<MeDto> {
    return this.users.getMe(user.id);
  }

  @Get('providers')
  providers(): { steam: boolean; devLogin: boolean } {
    return { steam: Boolean(this.env.STEAM_API_KEY), devLogin: this.env.AUTH_DEV_LOGIN };
  }
}
