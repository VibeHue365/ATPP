import { ServiceUnavailableException } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getConnectionToken(),
          useValue: { readyState: 1 },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('returns ok status when MongoDB connection is ready', () => {
      const res = appController.getHealth();
      expect(res.status).toBe('ok');
      expect(res.db).toBe('connected');
      expect(typeof res.uptimeSeconds).toBe('number');
    });

    it('throws ServiceUnavailableException when MongoDB is disconnected', () => {
      const degraded = new AppController(new AppService(), {
        readyState: 0,
      } as any);
      expect(() => degraded.getHealth()).toThrow(ServiceUnavailableException);
    });
  });
});
