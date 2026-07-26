import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SMART_TAG_TAXONOMY_SCOPE,
  SmartTagDefinitionStatus,
  SmartTagEntityType,
} from '../constants/smart-tag.constants';
import {
  SmartTagDefinition,
  SmartTagDefinitionDocument,
} from '../schemas/smart-tag-definition.schema';
import { SmartTagTaxonomyMetadata } from '../schemas/smart-tag-taxonomy-metadata.schema';

export interface ActiveSmartTagTaxonomy {
  revision: number;
  definitions: SmartTagDefinitionDocument[];
}

@Injectable()
export class SmartTagTaxonomyService {
  constructor(
    @InjectModel(SmartTagDefinition.name)
    private readonly definitionModel: Model<SmartTagDefinition>,
    @InjectModel(SmartTagTaxonomyMetadata.name)
    private readonly metadataModel: Model<SmartTagTaxonomyMetadata>,
  ) {}

  async getActiveTaxonomy(
    entityType: SmartTagEntityType,
  ): Promise<ActiveSmartTagTaxonomy> {
    const [metadata, definitions] = await Promise.all([
      this.metadataModel
        .findOne({ scope: SMART_TAG_TAXONOMY_SCOPE })
        .lean()
        .exec(),
      this.definitionModel
        .find({
          status: SmartTagDefinitionStatus.Active,
          entityTypes: entityType,
        })
        .sort({ displayPriority: 1, code: 1 })
        .exec(),
    ]);

    if (!metadata || definitions.length === 0) {
      throw new ServiceUnavailableException(
        'Smart tag taxonomy has not been initialized',
      );
    }

    return { revision: metadata.taxonomyRevision, definitions };
  }

  async listActiveDefinitions(
    entityType: SmartTagEntityType,
  ): Promise<SmartTagDefinitionDocument[]> {
    return this.definitionModel
      .find({
        status: SmartTagDefinitionStatus.Active,
        entityTypes: entityType,
      })
      .sort({ displayPriority: 1, code: 1 })
      .exec();
  }
}
