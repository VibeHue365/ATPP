import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Provider, ProviderSchema } from './schemas/provider.schema';
import {
  ProviderVerification,
  ProviderVerificationSchema,
} from './schemas/provider-verification.schema';
import { ProductsModule } from '../products/products.module';
import { ProvidersController } from './controllers/providers.controller';
import { ProvidersService } from './services/providers.service';
import { ProvidersRepository } from './repositories/providers.repository';
import { PhotographersController } from './controllers/photographers.controller';
import { PhotographersService } from './services/photographers.service';

export const providerModels = MongooseModule.forFeature([
  { name: Provider.name, schema: ProviderSchema },
  { name: ProviderVerification.name, schema: ProviderVerificationSchema },
]);

@Module({
  imports: [providerModels, ProductsModule],
  controllers: [ProvidersController, PhotographersController],
  providers: [ProvidersService, ProvidersRepository, PhotographersService],
  exports: [providerModels, ProvidersService, ProvidersRepository, PhotographersService],
})
export class ProvidersModule {}
