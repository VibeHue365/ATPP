import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Provider, ProviderSchema } from './schemas/provider.schema';
import {
  ProviderVerification,
  ProviderVerificationSchema,
} from './schemas/provider-verification.schema';

export const providerModels = MongooseModule.forFeature([
  { name: Provider.name, schema: ProviderSchema },
  { name: ProviderVerification.name, schema: ProviderVerificationSchema },
]);

@Module({
  imports: [providerModels],
  exports: [providerModels],
})
export class ProvidersModule {}
