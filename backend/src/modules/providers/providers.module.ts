import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Provider, ProviderSchema } from './schemas/provider.schema';
import {
  ProviderVerification,
  ProviderVerificationSchema,
} from './schemas/provider-verification.schema';
import { ProductsModule } from '../products/products.module';
import { PhotographersService } from './services/photographers.service';
import { PhotographersController } from './controllers/photographers.controller';

export const providerModels = MongooseModule.forFeature([
  { name: Provider.name, schema: ProviderSchema },
  { name: ProviderVerification.name, schema: ProviderVerificationSchema },
]);

@Module({
  imports: [providerModels, ProductsModule],
  controllers: [PhotographersController],
  providers: [PhotographersService],
  exports: [providerModels, PhotographersService],
})
export class ProvidersModule {}
