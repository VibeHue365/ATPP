import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Provider, ProviderSchema } from './schemas/provider.schema';
import {
  ProviderVerification,
  ProviderVerificationSchema,
} from './schemas/provider-verification.schema';
import { ProvidersController } from './controllers/providers.controller';
import { ProvidersService } from './services/providers.service';
import { ProvidersRepository } from './repositories/providers.repository';
import { ProductsModule } from '../products/products.module';

export const providerModels = MongooseModule.forFeature([
  { name: Provider.name, schema: ProviderSchema },
  { name: ProviderVerification.name, schema: ProviderVerificationSchema },
]);

@Module({
  imports: [providerModels, ProductsModule],
  controllers: [ProvidersController],
  providers: [ProvidersService, ProvidersRepository],
  exports: [providerModels, ProvidersService, ProvidersRepository],
})
export class ProvidersModule {}
