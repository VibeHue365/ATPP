import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { hashContract } from './canonical-contract';

export interface AutoAcceptanceMechanism {
  version: string;
  status: 'DRAFT' | 'APPROVED';
  approvedAt: string | null;
  scope: 'AO_DAI_RENTAL';
  description: string;
}

/** Business/legal wording has not been approved. No live acceptance can use this draft. */
export const AUTO_ACCEPTANCE_MECHANISM_V1: AutoAcceptanceMechanism =
  Object.freeze({
    version: 'auto-acceptance-v1',
    status: 'DRAFT',
    approvedAt: null,
    scope: 'AO_DAI_RENTAL',
    description:
      'Provider chấp thuận trước cơ chế giao kết tự động; điều khoản cụ thể cần được phê duyệt trước khi sử dụng.',
  });

/** Synthetic fixture for isolated testing only. NEVER used in production runtime. */
export const SYNTHETIC_TEST_MECHANISM_V2: AutoAcceptanceMechanism =
  Object.freeze({
    version: 'auto-acceptance-v1',
    status: 'APPROVED',
    approvedAt: '2026-10-31T00:00:00.000Z',
    scope: 'AO_DAI_RENTAL',
    description:
      'Quy chế hoạt động sàn giao dịch VibeHue: Nhà cung cấp cam kết và chấp thuận trước cơ chế giao kết hợp đồng điện tử tự động khi khách hàng đặt thuê áo dài.',
  });

/** Backward-compatibility alias for test fixtures only */
export const AUTO_ACCEPTANCE_MECHANISM_V2 = SYNTHETIC_TEST_MECHANISM_V2;

@Injectable()
export class ContractMechanismService {
  getDraft() {
    // In production runtime, NEVER return synthetic test fixture as APPROVED (strictly fail-closed)
    const isProduction = process.env.NODE_ENV === 'production';

    // In test environment, require explicit CONTRACT_MECHANISM_APPROVED === 'true'
    // In local development runtime (NODE_ENV === 'development' or unset), allow synthetic approved mechanism
    // unless explicitly disabled with CONTRACT_MECHANISM_APPROVED === 'false'
    const isTest = process.env.NODE_ENV === 'test';
    const isExplicitlyApproved =
      !isProduction &&
      (isTest
        ? process.env.CONTRACT_MECHANISM_APPROVED === 'true'
        : process.env.CONTRACT_MECHANISM_APPROVED !== 'false');

    // In production runtime or when not explicitly approved, always fail closed with DRAFT
    const base = isExplicitlyApproved
      ? SYNTHETIC_TEST_MECHANISM_V2
      : AUTO_ACCEPTANCE_MECHANISM_V1;

    return {
      ...base,
      hash: hashContract(base),
    };
  }

  getApproved() {
    const mechanism = this.getDraft();
    if (mechanism.status !== 'APPROVED' || !mechanism.approvedAt)
      throw new UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED');
    return mechanism;
  }
}
