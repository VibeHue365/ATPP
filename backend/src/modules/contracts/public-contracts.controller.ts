import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProviderContractPolicyService } from './provider-contract-policy.service';
import { contractObjectId } from './contract-source.types';

@Controller(['contracts/public', 'api/contracts/public'])
export class PublicContractsController {
  constructor(
    private readonly providerPolicy: ProviderContractPolicyService,
  ) {}

  @Get('provider/:providerId/active-policy')
  async getPublicProviderActivePolicy(@Param('providerId') providerId: string) {
    let provObjectId: Types.ObjectId;
    try {
      provObjectId = contractObjectId(providerId);
    } catch {
      throw new NotFoundException('PROVIDER_NOT_FOUND');
    }

    const policy = await this.providerPolicy.getActiveApprovedPolicy(provObjectId);
    if (!policy) {
      return null;
    }

    // Return sanitized public policy view (no internal review audit metadata)
    return {
      versionNumber: policy.versionNumber,
      garmentCare: policy.garmentCare,
      lateReturn: policy.lateReturn,
      damageCompensation: policy.damageCompensation,
      cancellationPolicy: policy.cancellationPolicy,
      supportContact: policy.supportContact,
      customTermsText: policy.customTermsText,
      approvedAt: policy.approvedAt,
    };
  }
}
