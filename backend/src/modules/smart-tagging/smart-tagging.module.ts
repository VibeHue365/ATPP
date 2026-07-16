import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';
import {
  PortfolioItem,
  PortfolioItemSchema,
} from '../providers/schemas/portfolio-item.schema';
import { ProviderSmartTagsController } from './controllers/provider-smart-tags.controller';
import { ProviderPortfolioSmartTagsController } from './controllers/provider-portfolio-smart-tags.controller';
import { AdminSmartTagsController } from './controllers/admin-smart-tags.controller';
import {
  SmartTagAssignment,
  SmartTagAssignmentSchema,
} from './schemas/smart-tag-assignment.schema';
import {
  SmartTagDecision,
  SmartTagDecisionSchema,
} from './schemas/smart-tag-decision.schema';
import {
  SmartTagDefinition,
  SmartTagDefinitionSchema,
} from './schemas/smart-tag-definition.schema';
import {
  SmartTagGenerationRun,
  SmartTagGenerationRunSchema,
} from './schemas/smart-tag-generation-run.schema';
import {
  SmartTagTaxonomyMetadata,
  SmartTagTaxonomyMetadataSchema,
} from './schemas/smart-tag-taxonomy-metadata.schema';
import { RuleBasedTaggingService } from './services/rule-based-tagging.service';
import { AiTaggingClientService } from './services/ai-tagging-client.service';
import { SmartTagPublicProjectionService } from './services/smart-tag-public-projection.service';
import { SmartTagTaxonomyService } from './services/smart-tag-taxonomy.service';
import { SmartTaggingService } from './services/smart-tagging.service';

export const smartTaggingModels = MongooseModule.forFeature([
  { name: SmartTagDefinition.name, schema: SmartTagDefinitionSchema },
  {
    name: SmartTagTaxonomyMetadata.name,
    schema: SmartTagTaxonomyMetadataSchema,
  },
  { name: SmartTagGenerationRun.name, schema: SmartTagGenerationRunSchema },
  { name: SmartTagAssignment.name, schema: SmartTagAssignmentSchema },
  { name: SmartTagDecision.name, schema: SmartTagDecisionSchema },
  { name: Product.name, schema: ProductSchema },
  { name: Provider.name, schema: ProviderSchema },
  { name: PortfolioItem.name, schema: PortfolioItemSchema },
]);

@Module({
  imports: [smartTaggingModels, AuthModule],
  controllers: [
    ProviderSmartTagsController,
    ProviderPortfolioSmartTagsController,
    AdminSmartTagsController,
  ],
  providers: [
    RuleBasedTaggingService,
    AiTaggingClientService,
    SmartTagTaxonomyService,
    SmartTaggingService,
    SmartTagPublicProjectionService,
  ],
  exports: [
    smartTaggingModels,
    SmartTaggingService,
    SmartTagPublicProjectionService,
  ],
})
export class SmartTaggingModule {}
