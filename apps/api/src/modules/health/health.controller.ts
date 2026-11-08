import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { REDIS, type RedisClient } from '../../infra/redis';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  @Get()
  async check(): Promise<{ status: 'ok'; db: boolean; redis: boolean }> {
    const db = await this.prisma.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    const redis = await this.redis.ping().then(
      () => true,
      () => false,
    );
    return { status: 'ok', db, redis };
  }
}
