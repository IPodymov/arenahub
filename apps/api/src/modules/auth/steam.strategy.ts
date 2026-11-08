import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Profile } from 'passport';
import { Strategy } from 'passport-steam';
import { ENV, type Env } from '../../config/env';
import type { SessionUser } from '../../common/auth';
import { AuthService } from './auth.service';

export const STEAM_RETURN_PATH = '/api/v1/auth/steam/return';

interface SteamJson {
  profileurl?: string;
  avatarfull?: string;
}

@Injectable()
export class SteamStrategy extends PassportStrategy(Strategy, 'steam') {
  constructor(
    @Inject(ENV) env: Env,
    private readonly auth: AuthService,
  ) {
    // Realm и returnURL — на origin веба: API проксируется через Next.js, cookie первосторонняя.
    super({
      returnURL: `${env.WEB_ORIGIN}${STEAM_RETURN_PATH}`,
      realm: `${env.WEB_ORIGIN}/`,
      apiKey: env.STEAM_API_KEY,
    });
  }

  async validate(_identifier: string, profile: Profile): Promise<SessionUser> {
    const json = (profile as Profile & { _json?: SteamJson })._json ?? {};
    return this.auth.loginWithSteam({
      steamId: profile.id,
      displayName: profile.displayName,
      avatarUrl: json.avatarfull ?? profile.photos?.at(-1)?.value ?? null,
      profileUrl: json.profileurl ?? null,
    });
  }
}
