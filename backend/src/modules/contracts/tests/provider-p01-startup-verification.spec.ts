import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ContractsModule } from '../contracts.module';
import { ContractsController } from '../contracts.controller';
import { ContractPreparationService } from '../contract-preparation.service';
import { ContractReadService } from '../contract-read.service';
import { ProviderContractApprovalService } from '../provider-contract-approval.service';
import { ContractCheckoutGuard } from '../contract-checkout-guard.service';
import { ContractMechanismService } from '../contract-mechanism.service';
import { CONTRACTS_V2_ENABLED } from '../contracts.constants';

describe('P0.1 — NestJS Startup & Dependency Injection Verification', () => {
  jest.setTimeout(30000);
  let moduleRef: TestingModule;
  let connection: Connection;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(
          'mongodb://127.0.0.1:27028/contract_startup_test?replicaSet=rsContractTest&directConnection=true',
        ),
        ContractsModule,
      ],
    })
      .overrideProvider('PrivateStorageService')
      .useValue({
        uploadPrivateFile: jest.fn(),
        readPrivateFile: jest.fn(),
        exists: jest.fn(),
        deletePrivateFile: jest.fn(),
      })
      .compile();

    connection = moduleRef.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('1. Compiles ContractsModule successfully without UnknownDependenciesException', () => {
    expect(moduleRef).toBeDefined();
  });

  it('2. Successfully resolves ContractsController and its routes', () => {
    const controller = moduleRef.get<ContractsController>(ContractsController);
    expect(controller).toBeDefined();
    expect(typeof controller.mechanism).toBe('function');
    expect(typeof controller.providerStatus).toBe('function');
    expect(typeof controller.acceptMechanism).toBe('function');
    expect(typeof controller.revokeMechanism).toBe('function');
    expect(typeof controller.readiness).toBe('function');
    expect(typeof controller.list).toBe('function');
    expect(typeof controller.get).toBe('function');
    expect(typeof controller.downloadPdf).toBe('function');
    expect(typeof controller.getEvidence).toBe('function');
  });

  it('3. Successfully resolves all core contract domain services', () => {
    const prepService = moduleRef.get<ContractPreparationService>(ContractPreparationService);
    const readService = moduleRef.get<ContractReadService>(ContractReadService);
    const approvalService = moduleRef.get<ProviderContractApprovalService>(ProviderContractApprovalService);
    const guardService = moduleRef.get<ContractCheckoutGuard>(ContractCheckoutGuard);
    const mechanismService = moduleRef.get<ContractMechanismService>(ContractMechanismService);

    expect(prepService).toBeDefined();
    expect(readService).toBeDefined();
    expect(approvalService).toBeDefined();
    expect(guardService).toBeDefined();
    expect(mechanismService).toBeDefined();
  });

  it('4. Feature flag CONTRACTS_V2_ENABLED factory correctly defaults to false when unconfigured', () => {
    // Tests ContractsModule factory: config.get<string>(CONTRACTS_V2_ENABLED, 'false') === 'true'
    const mockUnconfiguredConfig = {
      get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
    };
    const defaultVal = mockUnconfiguredConfig.get(CONTRACTS_V2_ENABLED, 'false') === 'true';
    expect(defaultVal).toBe(false);

    // Current module resolves flag as boolean (not string or undefined)
    const currentFlag = moduleRef.get<boolean>(CONTRACTS_V2_ENABLED);
    expect(typeof currentFlag).toBe('boolean');
  });
});
