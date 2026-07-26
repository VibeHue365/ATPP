import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityLogModule } from '../auth/security-log.module';
import { AdminSystemPoliciesController } from './controllers/admin-system-policies.controller';
import {
  SystemPolicy,
  SystemPolicySchema,
} from './schemas/system-policy.schema';
import { PolicyActivationLockService } from './services/policy-activation-lock.service';
import { PolicyResolverService } from './services/policy-resolver.service';
import { PolicyValidationService } from './services/policy-validation.service';
import { SystemPoliciesService } from './services/system-policies.service';

export const systemPolicyModels = MongooseModule.forFeature([
  { name: SystemPolicy.name, schema: SystemPolicySchema },
]);

@Module({
  imports: [ConfigModule, systemPolicyModels, SecurityLogModule],
  controllers: [AdminSystemPoliciesController],
  providers: [
    PolicyActivationLockService,
    PolicyResolverService,
    PolicyValidationService,
    SystemPoliciesService,
  ],
  exports: [
    systemPolicyModels,
    PolicyResolverService,
    PolicyValidationService,
    SystemPoliciesService,
  ],
})
export class SystemPoliciesModule {}
