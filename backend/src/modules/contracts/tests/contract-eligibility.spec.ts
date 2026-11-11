import { Types } from 'mongoose';
import { ContractReadService } from '../contract-read.service';
import { ContractScope } from '../../bookings/schemas/digital-contract.schema';
import { parseValidReplacementValue } from '../contract-source.types';

describe('ContractReadService: Early Eligibility Check', () => {
  const provId = new Types.ObjectId('64b0f0000000000000000001');
  const prodId = new Types.ObjectId('64b0f0000000000000000003');

  const createService = (dbOverrides: Record<string, any> = {}) => {
    const mockDb = {
      collection: jest.fn((name: string) => ({
        findOne: jest.fn(async (query: any) => {
          if (name in dbOverrides) {
            return typeof dbOverrides[name] === 'function' ? dbOverrides[name](query) : dbOverrides[name];
          }
          if (name === 'products') {
            return {
              _id: prodId,
              providerId: provId,
              name: 'Áo dài Gấm Đỏ',
              replacementValue: 2000000,
              moderationStatus: 'APPROVED',
            };
          }
          if (name === 'providers') {
            return {
              _id: provId,
              businessName: 'Tiệm Áo Dài Huế',
              status: 'ACTIVE',
              capabilities: ['AODAI_RENTAL'],
            };
          }
          if (name === 'provider_contract_acceptances') {
            return {
              providerId: provId,
              scope: ContractScope.AoDaiRental,
              status: 'ACTIVE',
            };
          }
          return null;
        }),
      })),
    };
    const mockConn = { db: mockDb } as any;
    const mockSnapshots = {
      currentPoliciesForProvider: jest.fn().mockResolvedValue({
        providerDamageCompensation: {
          minorDamageFee: 50000,
          moderateDamagePercent: 20,
          severeDamageOrLossPercent: 100,
        },
      }),
    } as any;

    const readService = new ContractReadService(
      true, // enabled
      {} as any, // contracts
      {} as any, // versions
      {} as any, // consents
      {} as any, // access
      {} as any, // policy
      {} as any, // templates
      mockSnapshots,
      {} as any, // preparation
      mockConn, // connection
    );

    return { readService, mockSnapshots };
  };

  it('1. Item is ELIGIBLE when provider is active, accepted, and product has approved replacement value', async () => {
    const { readService } = createService();
    const result = await readService.checkEligibility([{ productId: prodId.toString() }]);
    expect(result.eligible).toBe(true);
    expect(result.ineligibleItems).toHaveLength(0);
  });

  it('2. Flags PROVIDER_RENTAL_NOT_ACTIVE when provider lacks rental capability or is inactive', async () => {
    const { readService } = createService({
      providers: {
        _id: provId,
        businessName: 'Tiệm Ảnh Huế',
        status: 'PENDING',
        capabilities: ['PHOTOGRAPHY'],
      },
    });

    const result = await readService.checkEligibility([{ productId: prodId.toString() }]);
    expect(result.eligible).toBe(false);
    expect(result.ineligibleItems).toHaveLength(1);
    expect(result.ineligibleItems[0].reason).toBe('PROVIDER_RENTAL_NOT_ACTIVE');
    expect(result.ineligibleItems[0].productName).toBe('Áo dài Gấm Đỏ');
    expect(result.ineligibleItems[0].providerName).toBe('Tiệm Ảnh Huế');
  });

  it('3. Treats shop with no prior acceptance as LEGACY (eligible under legacy flow)', async () => {
    const { readService } = createService({
      provider_contract_acceptances: null,
    });

    const result = await readService.checkEligibility([{ productId: prodId.toString() }]);
    expect(result.eligible).toBe(true);
    expect(result.ineligibleItems).toHaveLength(0);
    expect(result.flow).toBe('LEGACY');
  });

  it('3b. Flags PROVIDER_ACCEPTANCE_SUSPENDED when provider acceptance is REVOKED', async () => {
    const { readService } = createService({
      provider_contract_acceptances: {
        providerId: provId,
        scope: ContractScope.AoDaiRental,
        status: 'REVOKED',
        revokedAt: new Date(Date.now() - 10000),
      },
    });

    const result = await readService.checkEligibility([{ productId: prodId.toString() }]);
    expect(result.eligible).toBe(false);
    expect(result.ineligibleItems[0].reason).toBe('PROVIDER_ACCEPTANCE_SUSPENDED');
  });

  it('4. Flags CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING when replacement value is not set', async () => {
    const { readService } = createService({
      products: {
        _id: prodId,
        providerId: provId,
        name: 'Áo dài Cổ trang',
        replacementValue: null,
      },
    });

    const result = await readService.checkEligibility([{ productId: prodId.toString() }]);
    expect(result.eligible).toBe(false);
    expect(result.ineligibleItems[0].reason).toBe('CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING');
    expect(result.ineligibleItems[0].message).toContain('chưa có Giá trị bồi hoàn');
  });

  it('5. Flags CONTRACT_PRODUCT_REPLACEMENT_VALUE_UNAPPROVED when replacement value is not approved', async () => {
    const { readService } = createService({
      products: {
        _id: prodId,
        providerId: provId,
        name: 'Áo dài Cổ trang',
        replacementValue: 1500000,
        moderationStatus: 'PENDING_REVIEW',
      },
    });

    const result = await readService.checkEligibility([{ productId: prodId.toString() }]);
    expect(result.eligible).toBe(false);
    expect(result.ineligibleItems[0].reason).toBe('CONTRACT_PRODUCT_REPLACEMENT_VALUE_UNAPPROVED');
    expect(result.ineligibleItems[0].message).toContain('đang chờ Quản trị viên sàn phê duyệt');
  });

  it('6. Allows checkout without replacement value if provider policy does not use percentage compensation', async () => {
    const { readService, mockSnapshots } = createService({
      products: {
        _id: prodId,
        providerId: provId,
        name: 'Áo dài Không Tính %',
        replacementValue: null,
      },
    });

    mockSnapshots.currentPoliciesForProvider.mockResolvedValue({
      providerDamageCompensation: {
        minorDamageFee: 50000,
        moderateDamagePercent: 0,
        severeDamageOrLossPercent: 0,
      },
    });

    const result = await readService.checkEligibility([{ productId: prodId.toString() }]);
    expect(result.eligible).toBe(true);
    expect(result.ineligibleItems).toHaveLength(0);
  });

  it('7. Flags PRODUCT_ID_INVALID when productId is not a valid 24-hex ObjectId', async () => {
    const { readService } = createService();
    const result = await readService.checkEligibility([{ productId: 'invalid_id_not_hex' }]);
    expect(result.eligible).toBe(false);
    expect(result.ineligibleItems).toHaveLength(1);
    expect(result.ineligibleItems[0].reason).toBe('PRODUCT_ID_INVALID');
  });

  it('8. Flags PRODUCT_NOT_FOUND when product does not exist in collection', async () => {
    const { readService } = createService({ products: null });
    const nonExistentId = new Types.ObjectId().toString();
    const result = await readService.checkEligibility([{ productId: nonExistentId }]);
    expect(result.eligible).toBe(false);
    expect(result.ineligibleItems).toHaveLength(1);
    expect(result.ineligibleItems[0].reason).toBe('PRODUCT_NOT_FOUND');
  });

  describe('Strict replacementValue parsing & numeric string handling', () => {
    it('accepts valid integers and formatted VND numeric strings', () => {
      expect(parseValidReplacementValue(200000)).toBe(200000);
      expect(parseValidReplacementValue('200000')).toBe(200000);
      expect(parseValidReplacementValue('200.000')).toBe(200000);
      expect(parseValidReplacementValue('2.500.000')).toBe(2500000);
    });

    it('strictly rejects null, undefined, empty string, zero, negative, NaN, Infinity and invalid formats', () => {
      expect(parseValidReplacementValue(null)).toBeNull();
      expect(parseValidReplacementValue(undefined)).toBeNull();
      expect(parseValidReplacementValue('')).toBeNull();
      expect(parseValidReplacementValue('   ')).toBeNull();
      expect(parseValidReplacementValue(0)).toBeNull();
      expect(parseValidReplacementValue('0')).toBeNull();
      expect(parseValidReplacementValue(-100)).toBeNull();
      expect(parseValidReplacementValue('-100')).toBeNull();
      expect(parseValidReplacementValue('abc')).toBeNull();
      expect(parseValidReplacementValue('200k')).toBeNull();
      expect(parseValidReplacementValue(NaN)).toBeNull();
      expect(parseValidReplacementValue('NaN')).toBeNull();
      expect(parseValidReplacementValue(Infinity)).toBeNull();
      expect(parseValidReplacementValue('Infinity')).toBeNull();
    });

    it('allows eligibility when product replacementValue is a valid numeric string in MongoDB', async () => {
      const { readService } = createService({
        products: {
          _id: prodId,
          providerId: provId,
          name: 'Áo dài Chuỗi Số',
          replacementValue: '200000',
          moderationStatus: 'APPROVED',
        },
      });

      const result = await readService.checkEligibility([{ productId: prodId.toString() }]);
      expect(result.eligible).toBe(true);
      expect(result.ineligibleItems).toHaveLength(0);
    });

    it('fails closed when product replacementValue is an invalid non-currency string', async () => {
      const { readService } = createService({
        products: {
          _id: prodId,
          providerId: provId,
          name: 'Áo dài Lỗi Giá',
          replacementValue: 'abc',
          moderationStatus: 'APPROVED',
        },
      });

      const result = await readService.checkEligibility([{ productId: prodId.toString() }]);
      expect(result.eligible).toBe(false);
      expect(result.ineligibleItems[0].reason).toBe('CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING');
    });
  });
});
