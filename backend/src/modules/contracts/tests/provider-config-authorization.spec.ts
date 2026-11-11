import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ContractsController } from '../contracts.controller';
import { ProviderContractConfigService } from '../provider-contract-config.service';
import { ProviderContractMode } from '../schemas/provider-contract-config.schema';

describe('Phase 2A Regression Suite: Provider Config API Authorization & IDOR Defense', () => {
  let controller: ContractsController;
  let configService: ProviderContractConfigService;
  let mockConfigModel: any;
  let mockAuditModel: any;
  let mockAccess: any;
  let mockConnection: any;

  const providerA_UserId = new Types.ObjectId('650000000000000000000001');
  const providerA_Id = new Types.ObjectId('650000000000000000000002');

  const providerB_UserId = new Types.ObjectId('650000000000000000000003');
  const providerB_Id = new Types.ObjectId('650000000000000000000004');

  const customerUserId = new Types.ObjectId('650000000000000000000005');
  const adminUserId = new Types.ObjectId('650000000000000000000006');

  const userProviderA: AuthUser = {
    sub: providerA_UserId.toString(),
    roles: ['PROVIDER'],
    permissions: ['provider:manage'],
    email: 'providerA@vibehue.com',
    sessionId: 'session-prov-a',
  };

  const userProviderB: AuthUser = {
    sub: providerB_UserId.toString(),
    roles: ['PROVIDER'],
    permissions: ['provider:manage'],
    email: 'providerB@vibehue.com',
    sessionId: 'session-prov-b',
  };

  const userCustomer: AuthUser = {
    sub: customerUserId.toString(),
    roles: ['CUSTOMER'],
    permissions: [],
    email: 'customer@vibehue.com',
    sessionId: 'session-cust',
  };

  const userAdmin: AuthUser = {
    sub: adminUserId.toString(),
    roles: ['ADMIN'],
    permissions: ['user:read', 'provider:read'],
    email: 'admin@vibehue.com',
    sessionId: 'session-admin',
  };

  beforeEach(() => {
    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
      withTransaction: jest.fn(async (cb) => cb()),
    };

    mockConnection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    mockConfigModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };

    mockAuditModel = {
      create: jest.fn(),
      find: jest.fn(),
    };

    mockAccess = {
      ownProvider: jest.fn(async (user: AuthUser) => {
        if (user.sub === providerA_UserId.toString()) {
          return {
            _id: providerA_Id,
            userId: providerA_UserId,
            status: 'ACTIVE',
            capabilities: ['AODAI_RENTAL'],
          };
        }
        if (user.sub === providerB_UserId.toString()) {
          return {
            _id: providerB_Id,
            userId: providerB_UserId,
            status: 'ACTIVE',
            capabilities: ['AODAI_RENTAL'],
          };
        }
        throw new ForbiddenException('PROVIDER_NOT_FOUND');
      }),
    };

    configService = new ProviderContractConfigService(
      true,
      mockConnection,
      mockConfigModel,
      mockAuditModel,
      mockAccess,
    );

    controller = new ContractsController(
      {} as any, // reads
      {} as any, // consents
      {} as any, // providerApproval
      {} as any, // providerPolicy
      configService,
      {} as any, // evidence
    );
  });

  describe('1. Role-Based Access Control (RBAC)', () => {
    it('Customer CANNOT read provider config (throws 403 Forbidden)', async () => {
      await expect(controller.providerConfig(userCustomer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Customer CANNOT update provider config (throws 403 Forbidden)', async () => {
      await expect(
        controller.updateProviderConfig(
          userCustomer,
          { contractMode: ProviderContractMode.AUTO },
          { headers: {}, socket: {} } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Customer CANNOT read provider config audit history (throws 403 Forbidden)', async () => {
      await expect(
        controller.providerConfigAudit(userCustomer, '20'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Admin without PROVIDER role CANNOT call provider config endpoints directly', async () => {
      await expect(controller.providerConfig(userAdmin)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        controller.updateProviderConfig(
          userAdmin,
          { contractMode: ProviderContractMode.AUTO },
          { headers: {}, socket: {} } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Cross-Provider IDOR Defense', () => {
    it('Provider A query derives ProviderId strictly from User token, never from client input', async () => {
      mockConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          providerId: providerA_Id,
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 500000,
          version: 2,
          effectiveFrom: new Date(),
          updatedByUserId: providerA_UserId,
        }),
      });

      const res = await controller.providerConfig(userProviderA);
      expect(res.providerId).toBe(providerA_Id.toString());
      expect(mockAccess.ownProvider).toHaveBeenCalledWith(userProviderA);
      expect(mockConfigModel.findOne).toHaveBeenCalledWith({
        providerId: providerA_Id,
      });
    });

    it('Provider B query is isolated to Provider B and cannot view Provider A config', async () => {
      mockConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          providerId: providerB_Id,
          contractMode: ProviderContractMode.AUTO,
          orderThresholdAmount: null,
          version: 1,
          effectiveFrom: new Date(),
          updatedByUserId: providerB_UserId,
        }),
      });

      const res = await controller.providerConfig(userProviderB);
      expect(res.providerId).toBe(providerB_Id.toString());
      expect(mockAccess.ownProvider).toHaveBeenCalledWith(userProviderB);
      expect(mockConfigModel.findOne).toHaveBeenCalledWith({
        providerId: providerB_Id,
      });
    });

    it('Provider A cannot update Provider B config because providerId is forced from session', async () => {
      mockConfigModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      const createdDoc = {
        providerId: providerA_Id,
        contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
        orderThresholdAmount: 300000,
        version: 1,
        effectiveFrom: new Date(),
        updatedByUserId: providerA_UserId,
      };
      mockConfigModel.create.mockResolvedValue([createdDoc]);
      mockAuditModel.create.mockResolvedValue([]);

      const res = await controller.updateProviderConfig(
        userProviderA,
        {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 300000,
        },
        { headers: { 'x-forwarded-for': '10.0.0.1' }, socket: {} } as any,
      );

      // Provider ID MUST be Provider A, cannot be forged to Provider B
      expect(res.providerId).toBe(providerA_Id.toString());
      expect(mockConfigModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            providerId: providerA_Id,
            updatedByUserId: providerA_UserId,
          }),
        ],
        expect.any(Object),
      );
    });

    it('Audit history queries strictly for caller own providerId', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      mockAuditModel.find.mockReturnValue(mockQuery);

      await controller.providerConfigAudit(userProviderA, '10');
      expect(mockAuditModel.find).toHaveBeenCalledWith({
        providerId: providerA_Id,
      });
      expect(mockAuditModel.find).not.toHaveBeenCalledWith({
        providerId: providerB_Id,
      });
    });
  });

  describe('3. Account Status Defense', () => {
    it('Inactive Provider account is rejected from updating configuration', async () => {
      mockAccess.ownProvider.mockResolvedValueOnce({
        _id: providerA_Id,
        userId: providerA_UserId,
        status: 'SUSPENDED',
        capabilities: ['AODAI_RENTAL'],
      });

      await expect(
        controller.updateProviderConfig(
          userProviderA,
          { contractMode: ProviderContractMode.AUTO },
          { headers: {}, socket: {} } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
