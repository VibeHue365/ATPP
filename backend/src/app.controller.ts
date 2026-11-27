import {
  Controller,
  Get,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { SkipThrottle } from '@nestjs/throttler';
import type { Connection } from 'mongoose';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Optional()
    @InjectConnection()
    private readonly connection?: Connection,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @SkipThrottle()
  getHealth() {
    const readyState = this.connection?.readyState;
    const dbConnected = readyState === undefined ? true : readyState === 1;
    const payload = {
      status: dbConnected ? 'ok' : 'degraded',
      db: dbConnected ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    if (!dbConnected) {
      throw new ServiceUnavailableException(payload);
    }
    return payload;
  }
}
