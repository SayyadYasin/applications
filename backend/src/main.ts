import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet());
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',') });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('TownServices API')
      .setDescription('Local services marketplace for small towns')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, doc);

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
