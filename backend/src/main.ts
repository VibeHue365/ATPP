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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
  const isProduction = process.env.NODE_ENV === 'production';
  const storageDomains: string[] = [];
  if (process.env.STORAGE_PUBLIC_DOMAIN) {
    storageDomains.push(process.env.STORAGE_PUBLIC_DOMAIN);
  }
  if (process.env.MINIO_ENDPOINT) {
    const minioHost = process.env.MINIO_ENDPOINT.replace(/^https?:\/\//, '');
    storageDomains.push(`http://${minioHost}`, `https://${minioHost}`);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProduction
            ? ["'self'"]
            : ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https://img.vietqr.io",
            "https://images.unsplash.com",
            "https://res.cloudinary.com",
            ...storageDomains,
            ...(!isProduction ? ["*"] : []),
          ],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VibeHue Platform API')
    .setDescription('Tài liệu API chính thức của hệ thống VibeHue Platform')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Nhập Bearer Token',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'VibeHue API Docs',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
// trigger watch reload: 2026-10-15T20:35:50

function allowedCorsOrigins(): (string | RegExp)[] {
  const isProduction = process.env.NODE_ENV === 'production';
  const envOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // In production, strictly permit only explicit origins configured in FRONTEND_URL
  if (isProduction) {
    return envOrigins;
  }

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
