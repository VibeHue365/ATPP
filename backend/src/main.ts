import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('HTTP');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const expressApp = app.getHttpAdapter().getInstance() as express.Express;
  expressApp.set('trust proxy', 1);
  app.enableCors({
    origin: allowedCorsOrigins(),
    credentials: true,
  });
  app.use(express.json({ limit: process.env.BODY_LIMIT ?? '1mb' }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: process.env.BODY_LIMIT ?? '1mb',
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
// trigger watch reload

function allowedCorsOrigins(): string[] {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
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

function requestLogger(logger: Logger) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const requestId = request.header('x-request-id') ?? randomUUID();
    const startedAt = Date.now();
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const user = request.user as { sub?: string } | undefined;
      logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          responseTime: Date.now() - startedAt,
          userId: user?.sub ?? null,
          ip: request.ip,
          userAgent: request.header('user-agent') ?? null,
        }),
      );
    });

    next();
  };
}
