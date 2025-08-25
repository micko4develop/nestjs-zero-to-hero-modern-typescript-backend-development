import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { TransformInterceptor } from './transform.interceptor';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  //app.useGlobalInterceptors(new TransformInterceptor()); // Temporarily disabled due to circular reference issues

  app.use(cookieParser(process.env.COOKIE_SECRET)); 

  app.enableCors({
    origin: process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000',
    credentials: true,
    exposedHeaders: ['x-access-token'], // frontend can read refreshed AT
  });

  await app.listen(process.env.PORT ?? 5555);

  logger.log(`Server listening on port ${process.env.PORT ?? 5555}`);
}
bootstrap();