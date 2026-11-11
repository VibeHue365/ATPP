import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemPoliciesModule } from '../system-policies/system-policies.module';
import { StorageModule } from '../storage/storage.module';
import { CONTRACTS_V2_ENABLED } from './contracts.constants';
import { ContractPolicyService } from './contract-policy.service';
import { ContractSnapshotService } from './contract-snapshot.service';
import { ContractTemplateService } from './contract-template';
import { ContractPreparationService } from './contract-preparation.service';
import { ContractAccessService } from './contract-access.service';
import { ContractReadService } from './contract-read.service';
import { ContractConsentService } from './contract-consent.service';
import { ProviderContractApprovalService } from './provider-contract-approval.service';
import { ProviderContractPolicyService } from './provider-contract-policy.service';
import { ContractMechanismService } from './contract-mechanism.service';
import { ContractCheckoutGuard } from './contract-checkout-guard.service';
import { ContractEvidenceService } from './contract-evidence.service';
import { ContractsController } from './contracts.controller';
import { PublicContractsController } from './public-contracts.controller';
import {
  DigitalContract,
  DigitalContractSchema,
} from '../bookings/schemas/digital-contract.schema';
import {
  ContractVersion,
  ContractVersionSchema,
} from './schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentSchema,
} from './schemas/contract-consent.schema';
import {
  ProviderContractAcceptance,
  ProviderContractAcceptanceSchema,
} from './schemas/provider-contract-acceptance.schema';
import {
  ProviderContractPolicyVersion,
  ProviderContractPolicyVersionSchema,
} from './schemas/provider-contract-policy.schema';
import {
  ProviderRentalContractConfig,
  ProviderRentalContractConfigSchema,
} from './schemas/provider-contract-config.schema';
import {
  ProviderRentalContractConfigAudit,
  ProviderRentalContractConfigAuditSchema,
} from './schemas/provider-contract-config-audit.schema';
import { ProviderContractConfigService } from './provider-contract-config.service';
import { ContractTierEvaluator } from './contract-tier-evaluator';

export const contractModels = MongooseModule.forFeature([
  { name: DigitalContract.name, schema: DigitalContractSchema },
  { name: ContractVersion.name, schema: ContractVersionSchema },
  { name: ContractConsent.name, schema: ContractConsentSchema },
  {
    name: ProviderContractAcceptance.name,
    schema: ProviderContractAcceptanceSchema,
  },
  {
    name: ProviderContractPolicyVersion.name,
    schema: ProviderContractPolicyVersionSchema,
  },
  {
    name: ProviderRentalContractConfig.name,
    schema: ProviderRentalContractConfigSchema,
  },
  {
    name: ProviderRentalContractConfigAudit.name,
    schema: ProviderRentalContractConfigAuditSchema,
  },
]);

@Module({
  imports: [contractModels, SystemPoliciesModule, StorageModule],
  controllers: [ContractsController, PublicContractsController],
  providers: [
    ContractPolicyService,
    ContractSnapshotService,
    ContractTemplateService,
    ContractPreparationService,
    ContractAccessService,
    ContractReadService,
    ContractConsentService,
    ProviderContractApprovalService,
    ProviderContractPolicyService,
    ProviderContractConfigService,
    ContractTierEvaluator,
    ContractMechanismService,
    ContractCheckoutGuard,
    ContractEvidenceService,
    {
      provide: CONTRACTS_V2_ENABLED,
      inject: [ConfigService],
      useFactory: (config: ConfigService): boolean =>
        config.get<string>(CONTRACTS_V2_ENABLED, 'false') === 'true',
    },
  ],
  exports: [
    contractModels,
    CONTRACTS_V2_ENABLED,
    ContractPolicyService,
    ContractSnapshotService,
    ContractTemplateService,
    ContractPreparationService,
    ContractAccessService,
    ContractReadService,
    ContractConsentService,
    ProviderContractApprovalService,
    ProviderContractPolicyService,
    ProviderContractConfigService,
    ContractTierEvaluator,
    ContractMechanismService,
    ContractCheckoutGuard,
    ContractEvidenceService,
  ],
})
export class ContractsModule {}
