import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsEmail, IsString, MinLength } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

interface ErrorBody {
  statusCode: number;
  errorCode: string;
  message: string;
  path: string;
}

class ContractDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  name!: string;
}

@Controller('test-contract')
class ContractController {
  @Post()
  create(@Body() body: ContractDto): ContractDto {
    return body;
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException('Provider access required');
  }

  @Get('unexpected-error')
  unexpectedError(): never {
    throw new Error('Sensitive implementation detail');
  }
}

describe('ATPP HTTP contract (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, ContractController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the application smoke endpoint', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('accepts and transforms a valid request body', async () => {
    await request(app.getHttpServer())
      .post('/test-contract')
      .send({ email: 'daibll@example.test', name: 'DaiBLL' })
      .expect(201)
      .expect({ email: 'daibll@example.test', name: 'DaiBLL' });
  });

  it('returns the standardized validation response for invalid fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-contract')
      .send({ email: 'not-an-email', name: 'A' })
      .expect(400);
    const body = response.body as ErrorBody;

    expect(body).toMatchObject({
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      path: '/test-contract',
    });
    expect(body.message).toContain('email must be an email');
    expect(body.message).toContain(
      'name must be longer than or equal to 3 characters',
    );
  });

  it('rejects fields outside the DTO allow-list', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-contract')
      .send({ email: 'daibll@example.test', name: 'DaiBLL', role: 'ADMIN' })
      .expect(400);
    const body = response.body as ErrorBody;

    expect(body).toMatchObject({
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      path: '/test-contract',
    });
    expect(body.message).toContain('property role should not exist');
  });

  it('maps authorization failures to the shared permission error code', async () => {
    const response = await request(app.getHttpServer())
      .get('/test-contract/forbidden')
      .expect(403);
    const body = response.body as ErrorBody;

    expect(body).toMatchObject({
      statusCode: 403,
      errorCode: 'PERMISSION_DENIED',
      message: 'Provider access required',
      path: '/test-contract/forbidden',
    });
  });

  it('does not expose internal exception details', async () => {
    const response = await request(app.getHttpServer())
      .get('/test-contract/unexpected-error')
      .expect(500);
    const body = response.body as ErrorBody;

    expect(body).toMatchObject({
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      message: 'Internal server error',
      path: '/test-contract/unexpected-error',
    });
    expect(JSON.stringify(body)).not.toContain(
      'Sensitive implementation detail',
    );
  });
});
