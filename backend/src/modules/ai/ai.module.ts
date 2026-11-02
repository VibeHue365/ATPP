import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { AiController } from './controllers/ai.controller';
import { VisualSearchController } from './controllers/visual-search.controller';
import { AiService } from './services/ai.service';

@Module({
  imports: [AuthModule, ProductsModule],
  controllers: [AiController, VisualSearchController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
