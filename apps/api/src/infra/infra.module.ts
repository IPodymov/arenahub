import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ENV, type Env, loadEnv } from '../config/env';
import { Clock } from './clock';
import { PrismaService } from './prisma.service';
import { createRedis, REDIS, type RedisClient } from './redis';

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) => createRedis(env.REDIS_URL),
    },
    PrismaService,
    Clock,
  ],
  exports: [ENV, REDIS, PrismaService, Clock],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: RedisClient) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.isOpen) await this.redis.quit();
  }
}
