import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PolicyCode } from '../constants/policy-code.enum';
import { PolicyStatus } from '../constants/policy-status.enum';
import {
  SystemPolicy,
  SystemPolicyDocument,
} from '../schemas/system-policy.schema';
import {
  BookingHoldPolicyValue,
  CancellationPolicyValue,
  CommissionPolicyValue,
  DEFAULT_POLICY_VALUES,
  DisputePolicyValue,
  PolicyValue,
  ProviderViolationPolicyValue,
  RefundPolicyValue,
} from './default-policy-values';
import { PolicyValidationService } from './policy-validation.service';

interface CacheEntry {
  expiresAt: number;
  policy: SystemPolicyDocument;
}

@Injectable()
export class PolicyResolverService {
  private readonly cache = new Map<PolicyCode, CacheEntry>();
  private readonly ttlMs = 60_000;

  constructor(
    @InjectModel(SystemPolicy.name)
    private readonly policyModel: Model<SystemPolicy>,
    private readonly validationService: PolicyValidationService,
  ) {}

  async getActivePolicyByCode(
    code: PolicyCode,
  ): Promise<SystemPolicyDocument> {
    const cached = this.cache.get(code);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.policy;
    }

    const policy = await this.policyModel.findOne({
      code,
      status: PolicyStatus.Active,
    });

    if (!policy) {
      throw new NotFoundException('SYSTEM_POLICY_NOT_FOUND');
    }

    this.validationService.validatePolicyValue(code, policy.value);
    this.cache.set(code, { policy, expiresAt: now + this.ttlMs });
    return policy;
  }

  async getBookingHoldPolicy(): Promise<BookingHoldPolicyValue> {
    return this.getPolicyValueOrDefault<BookingHoldPolicyValue>(
      PolicyCode.BookingHoldPolicy,
    );
  }

  async getCommissionPolicy(): Promise<CommissionPolicyValue> {
    return this.getPolicyValueOrDefault<CommissionPolicyValue>(
      PolicyCode.CommissionPolicy,
    );
  }

  async getCancellationPolicy(): Promise<CancellationPolicyValue> {
    return this.getPolicyValueOrDefault<CancellationPolicyValue>(
      PolicyCode.CancellationPolicy,
    );
  }

  async getRefundPolicy(): Promise<RefundPolicyValue> {
    return this.getPolicyValueOrDefault<RefundPolicyValue>(
      PolicyCode.RefundPolicy,
    );
  }

  async getProviderViolationPolicy(): Promise<ProviderViolationPolicyValue> {
    return this.getPolicyValueOrDefault<ProviderViolationPolicyValue>(
      PolicyCode.ProviderViolationPolicy,
    );
  }

  async getDisputePolicy(): Promise<DisputePolicyValue> {
    return this.getPolicyValueOrDefault<DisputePolicyValue>(
      PolicyCode.DisputePolicy,
    );
  }

  clearCache(code?: PolicyCode): void {
    if (code) {
      this.cache.delete(code);
      return;
    }

    this.cache.clear();
  }

  private async getPolicyValueOrDefault<T extends PolicyValue>(
    code: PolicyCode,
  ): Promise<T> {
    try {
      const policy = await this.getActivePolicyByCode(code);
      return policy.value as T;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return DEFAULT_POLICY_VALUES[code] as T;
      }
      throw error;
    }
  }
}
