import { BadRequestException, Injectable } from '@nestjs/common';
import { PolicyCode } from '../constants/policy-code.enum';
import { PolicyErrorCode } from '../constants/policy-error-codes';
import { PolicyType } from '../constants/policy-type.enum';
import { POLICY_CODE_TYPE_MAP } from './default-policy-values';

@Injectable()
export class PolicyValidationService {
  validateCodeAndType(code: PolicyCode, type: PolicyType): void {
    if (POLICY_CODE_TYPE_MAP[code] !== type) {
      throw new BadRequestException(PolicyErrorCode.CodeTypeMismatch);
    }
  }

  validatePolicyValue(
    code: PolicyCode,
    value: Record<string, unknown>,
  ): void {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new BadRequestException(PolicyErrorCode.ValueInvalid);
    }

    switch (code) {
      case PolicyCode.BookingHoldPolicy:
        this.validateBookingHoldPolicy(value);
        return;
      case PolicyCode.CommissionPolicy:
        this.validateCommissionPolicy(value);
        return;
      case PolicyCode.CancellationPolicy:
        this.validateCancellationPolicy(value);
        return;
      case PolicyCode.RefundPolicy:
        this.validateRefundPolicy(value);
        return;
      case PolicyCode.ProviderViolationPolicy:
        this.validateProviderViolationPolicy(value);
        return;
      case PolicyCode.DisputePolicy:
        this.validateDisputePolicy(value);
        return;
      default:
        throw new BadRequestException(PolicyErrorCode.ValueInvalid);
    }
  }

  private validateBookingHoldPolicy(value: Record<string, unknown>): void {
    this.assertNumberInRange(value.holdMinutes, 'holdMinutes', 1, 120);
    this.assertBoolean(value.autoExpireEnabled, 'autoExpireEnabled');
  }

  private validateCommissionPolicy(value: Record<string, unknown>): void {
    this.assertNumberInRange(
      value.defaultCommissionRate,
      'defaultCommissionRate',
      0,
      1,
    );
    this.assertNumberInRange(
      value.sameProviderComboCommissionRate,
      'sameProviderComboCommissionRate',
      0,
      1,
    );
    this.assertNumberInRange(
      value.crossProviderComboCommissionRate,
      'crossProviderComboCommissionRate',
      0,
      1,
    );
    this.assertNumberAtLeast(value.fixedPlatformFee, 'fixedPlatformFee', 0);
    this.assertNumberAtLeast(value.minCommissionAmount, 'minCommissionAmount', 0);
  }

  private validateCancellationPolicy(value: Record<string, unknown>): void {
    this.assertNumberAtLeast(
      value.freeCancelBeforeHours,
      'freeCancelBeforeHours',
      0,
    );
    this.assertNumberAtLeast(
      value.urgentBookingBeforeHours,
      'urgentBookingBeforeHours',
      0,
    );
    this.assertNumberAtLeast(
      value.gracePeriodMinutesNormal,
      'gracePeriodMinutesNormal',
      0,
    );
    this.assertNumberAtLeast(
      value.gracePeriodMinutesUrgent,
      'gracePeriodMinutesUrgent',
      0,
    );
    this.assertNumberInRange(
      value.productLateCancelPenaltyRate,
      'productLateCancelPenaltyRate',
      0,
      1,
    );
    this.assertNumberInRange(
      value.photographyLateCancelPenaltyRate,
      'photographyLateCancelPenaltyRate',
      0,
      1,
    );
  }

  private validateRefundPolicy(value: Record<string, unknown>): void {
    this.assertBoolean(
      value.autoApproveFreeCancelRefund,
      'autoApproveFreeCancelRefund',
    );
    this.assertNumberAtLeast(
      value.manualReviewThresholdAmount,
      'manualReviewThresholdAmount',
      0,
    );
    if (!['SIMULATED', 'MANUAL', 'GATEWAY'].includes(String(value.refundProcessingMode))) {
      throw new BadRequestException(
        `${PolicyErrorCode.ValueInvalid}: refundProcessingMode`,
      );
    }
  }

  private validateProviderViolationPolicy(
    value: Record<string, unknown>,
  ): void {
    this.assertNumberAtLeast(
      value.maxWarningsBeforeSuspend,
      'maxWarningsBeforeSuspend',
      1,
    );
    this.assertNumberAtLeast(
      value.lateCancelViolationPoint,
      'lateCancelViolationPoint',
      0,
    );
    this.assertNumberAtLeast(value.noShowViolationPoint, 'noShowViolationPoint', 0);
    this.assertBoolean(value.autoSuspendEnabled, 'autoSuspendEnabled');
  }

  private validateDisputePolicy(value: Record<string, unknown>): void {
    this.assertNumberAtLeast(
      value.allowDisputeAfterCompletedHours,
      'allowDisputeAfterCompletedHours',
      0,
    );
    this.assertBoolean(value.requireEvidence, 'requireEvidence');
    this.assertBoolean(
      value.holdSettlementWhenDisputed,
      'holdSettlementWhenDisputed',
    );
  }

  private assertNumberInRange(
    value: unknown,
    field: string,
    min: number,
    max: number,
  ): void {
    this.assertNumber(value, field);
    const numberValue = value as number;
    if (numberValue < min || numberValue > max) {
      throw new BadRequestException(`${PolicyErrorCode.ValueInvalid}: ${field}`);
    }
  }

  private assertNumberAtLeast(value: unknown, field: string, min: number): void {
    this.assertNumber(value, field);
    if ((value as number) < min) {
      throw new BadRequestException(`${PolicyErrorCode.ValueInvalid}: ${field}`);
    }
  }

  private assertNumber(value: unknown, field: string): void {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new BadRequestException(`${PolicyErrorCode.ValueInvalid}: ${field}`);
    }
  }

  private assertBoolean(value: unknown, field: string): void {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`${PolicyErrorCode.ValueInvalid}: ${field}`);
    }
  }
}
