import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { requestLogger } from './common/http/request-logger';

async function bootstrap() {
  const logger = new Logger('HTTP');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const expressApp = app.getHttpAdapter().getInstance() as express.Express;
  expressApp.set('trust proxy', 1);
  app.enableCors({
    origin: allowedCorsOrigins(),
    credentials: true,
    exposedHeaders: ['X-Contract-SHA256', 'Content-Disposition'],
  });
  app.use(express.json({ limit: process.env.BODY_LIMIT ?? '10mb' }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: process.env.BODY_LIMIT ?? '10mb',
    }),
  );
  app.use(cookieParser());
  // The Vite frontend is served from a different local origin in development.
  // Product/review uploads must be embeddable in its image elements.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://img.vietqr.io", "https://images.unsplash.com", "*"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(securityHeaders);
  app.use(requestLogger(logger));
  if (process.env.SERVE_LEGACY_UPLOADS !== 'false') {
    app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
// trigger watch reload: 2026-10-15T20:35:50

function allowedCorsOrigins(): (string | RegExp)[] {
  const envOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // In development, permit localhost/127.0.0.1 on common dev ports (5173, 5174, 5175, etc.)
  return [
    ...envOrigins,
    /^http:\/\/localhost:(517[0-9]|300[0-9]|417[0-9])$/,
    /^http:\/\/127\.0\.0\.1:(517[0-9]|300[0-9]|417[0-9])$/,
  ];
}

function securityHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}
