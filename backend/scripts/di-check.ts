// Boots the full module graph without a database to catch DI/wiring errors.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

PrismaService.prototype.onModuleInit = async () => {};
process.env.JWT_SECRET ??= 'x';
NestFactory.create(AppModule, { logger: ['error'] })
  .then(async (app) => { await app.init(); console.log('DI OK'); await app.close(); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
