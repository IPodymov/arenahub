import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { ENV, type Env } from './config/env';

// BigInt нигде не должен уходить в JSON неявно — суммы маппятся в строки вручную.

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const env = app.get<Env>(ENV);
  await app.listen(env.API_PORT);
  Logger.log(`API: http://localhost:${env.API_PORT}/api/v1`, 'Bootstrap');
}

void bootstrap();
