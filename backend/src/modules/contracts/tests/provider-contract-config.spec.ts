import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ProviderContractConfigService } from '../provider-contract-config.service';
import { ProviderContractMode } from '../schemas/provider-contract-config.schema';

describe('Phase 2A: ProviderContractConfigService Unit Tests', () => {
  let service: ProviderContractConfigService;
  let mockConfigModel: any;
  let mockAuditModel: any;
  let mockAccess: any;
  let mockConnection: any;
  let mockSession: any;

  const mockProviderId = new Types.ObjectId('650000000000000000000001');
  const mockUserId = new Types.ObjectId('650000000000000000000002');

  const mockUser: AuthUser = {
    sub: mockUserId.toString(),
    roles: ['PROVIDER'],
    permissions: ['provider:manage'],
    email: 'shop@vibehue.com',
    sessionId: 'session-123',
  };

  beforeEach(() => {
    mockSession = {
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
      ownProvider: jest.fn().mockResolvedValue({
        _id: mockProviderId,
        userId: mockUserId,
        status: 'ACTIVE',
        capabilities: ['AODAI_RENTAL'],
      }),
    };

    service = new ProviderContractConfigService(
      true, // enabled
      mockConnection,
      mockConfigModel,
      mockAuditModel,
      mockAccess,
    );
  });

  describe('1. getConfig', () => {
    it('returns default config when provider has no saved record', async () => {
      mockConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const config = await service.getConfig(mockUser);
      expect(config.isDefault).toBe(true);
      expect(config.contractMode).toBe(ProviderContractMode.AUTO);
      expect(config.orderThresholdAmount).toBeNull();
      expect(config.version).toBe(1);
      expect(config.providerId).toBe(mockProviderId.toString());
      expect(mockAccess.ownProvider).toHaveBeenCalledWith(mockUser);
    });

    it('returns saved config when record exists', async () => {
      mockConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          providerId: mockProviderId,
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 500000,
          version: 3,
          effectiveFrom: new Date('2026-11-01'),
          updatedByUserId: mockUserId,
        }),
      });

      const config = await service.getConfig(mockUser);
      expect(config.isDefault).toBe(false);
      expect(config.contractMode).toBe(ProviderContractMode.CUSTOM_ORDER_THRESHOLD);
      expect(config.orderThresholdAmount).toBe(500000);
      expect(config.version).toBe(3);
    });

    it('throws ServiceUnavailableException when CONTRACTS_V2_ENABLED is false', async () => {
      const disabledService = new ProviderContractConfigService(
        false,
        mockConnection,
        mockConfigModel,
        mockAuditModel,
        mockAccess,
      );

      await expect(disabledService.getConfig(mockUser)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ForbiddenException when caller does not have PROVIDER role (e.g. Customer)', async () => {
      const customerUser: AuthUser = {
        sub: '650000000000000000000099',
        roles: ['CUSTOMER'],
        permissions: [],
        email: 'customer@vibehue.com',
        sessionId: 'session-cust',
      };

      await expect(service.getConfig(customerUser)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.updateConfig(customerUser, {
          contractMode: ProviderContractMode.AUTO,
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.getAuditHistory(customerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when provider account is not ACTIVE on updateConfig', async () => {
      mockAccess.ownProvider.mockResolvedValueOnce({
        _id: mockProviderId,
        userId: mockUserId,
        status: 'PENDING_APPROVAL',
        capabilities: ['AODAI_RENTAL'],
      });

      await expect(
        service.updateConfig(mockUser, {
          contractMode: ProviderContractMode.AUTO,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. updateConfig & Validation', () => {
    it('validates and saves CUSTOM_ORDER_THRESHOLD with positive integer threshold', async () => {
      mockConfigModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null), // no existing doc yet
      });

      const createdDoc = {
        providerId: mockProviderId,
        contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
        orderThresholdAmount: 600000,
        version: 1,
        effectiveFrom: new Date(),
        updatedByUserId: mockUserId,
      };
      mockConfigModel.create.mockResolvedValue([createdDoc]);
      mockAuditModel.create.mockResolvedValue([]);

      const result = await service.updateConfig(
        mockUser,
        {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 600000,
          changeNote: 'Thử nghiệm ngưỡng 600k',
        },
        { ipAddress: '127.0.0.1', userAgent: 'JestTestAgent' },
      );

      expect(result.contractMode).toBe(ProviderContractMode.CUSTOM_ORDER_THRESHOLD);
      expect(result.orderThresholdAmount).toBe(600000);
      expect(result.version).toBe(1);

      // Verify audit creation
      expect(mockAuditModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            providerId: mockProviderId,
            contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
            orderThresholdAmount: 600000,
            version: 1,
            ipAddress: '127.0.0.1',
            userAgent: 'JestTestAgent',
            changeNote: 'Thử nghiệm ngưỡng 600k',
          }),
        ],
        expect.any(Object),
      );
    });

    it('bumps version when updating existing config', async () => {
      const existingDoc = {
        providerId: mockProviderId,
        contractMode: ProviderContractMode.AUTO,
        orderThresholdAmount: null,
        version: 2,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      mockConfigModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(existingDoc),
      });
      mockAuditModel.create.mockResolvedValue([]);

      const result = await service.updateConfig(mockUser, {
        contractMode: ProviderContractMode.ALWAYS_DETAILED,
      });

      expect(existingDoc.contractMode).toBe(ProviderContractMode.ALWAYS_DETAILED);
      expect(existingDoc.orderThresholdAmount).toBeNull();
      expect(existingDoc.version).toBe(3); // Bumped from 2 to 3
      expect(result.version).toBe(3);
    });

    it('rejects negative threshold amount', async () => {
      await expect(
        service.updateConfig(mockUser, {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: -50000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects threshold exceeding 100,000,000 VNĐ limit', async () => {
      await expect(
        service.updateConfig(mockUser, {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 150_000_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('normalizes orderThresholdAmount to null when switching to AUTO', async () => {
      const existingDoc = {
        providerId: mockProviderId,
        contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
        orderThresholdAmount: 500000,
        version: 1,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      mockConfigModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(existingDoc),
      });
      mockAuditModel.create.mockResolvedValue([]);

      const result = await service.updateConfig(mockUser, {
        contractMode: ProviderContractMode.AUTO,
        orderThresholdAmount: 500000, // Should be ignored and set to null
      });

      expect(existingDoc.orderThresholdAmount).toBeNull();
      expect(result.orderThresholdAmount).toBeNull();
    });
  });

  describe('3. getAuditHistory', () => {
    it('fetches audit history limited and sorted descending', async () => {
      const mockAuditQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { version: 2, contractMode: 'CUSTOM_ORDER_THRESHOLD' },
          { version: 1, contractMode: 'AUTO' },
        ]),
      };
      mockAuditModel.find.mockReturnValue(mockAuditQuery);

      const history = await service.getAuditHistory(mockUser, 10);
      expect(history).toHaveLength(2);
      expect(mockAuditModel.find).toHaveBeenCalledWith({
        providerId: mockProviderId,
      });
      expect(mockAuditQuery.sort).toHaveBeenCalledWith({ version: -1 });
      expect(mockAuditQuery.limit).toHaveBeenCalledWith(10);
    });
  });
});
