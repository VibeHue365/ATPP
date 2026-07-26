import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SmartTagAssignmentStatus,
  SmartTagDefinitionStatus,
  SmartTagEntityType,
} from '../constants/smart-tag.constants';
import { SmartTagAssignment } from '../schemas/smart-tag-assignment.schema';
import { SmartTagDefinition } from '../schemas/smart-tag-definition.schema';

export interface PublicSmartTagBadge {
  code: string;
  label: string;
  description: string;
  displayPriority: number;
  displayConfig: {
    color: string;
    backgroundColor: string;
    icon?: string | null;
  };
}

interface TaggableProduct {
  _id: Types.ObjectId;
  taggingRevision: number;
}

@Injectable()
export class SmartTagPublicProjectionService {
  constructor(
    @InjectModel(SmartTagAssignment.name)
    private readonly assignmentModel: Model<SmartTagAssignment>,
    @InjectModel(SmartTagDefinition.name)
    private readonly definitionModel: Model<SmartTagDefinition>,
  ) {}

  async projectProductBadges(
    products: TaggableProduct[],
  ): Promise<Map<string, PublicSmartTagBadge[]>> {
    return this.projectBadges(SmartTagEntityType.Product, products);
  }

  async projectPortfolioBadges(
    items: TaggableProduct[],
  ): Promise<Map<string, PublicSmartTagBadge[]>> {
    return this.projectBadges(SmartTagEntityType.Portfolio, items);
  }

  private async projectBadges(
    entityType: SmartTagEntityType,
    entities: TaggableProduct[],
  ): Promise<Map<string, PublicSmartTagBadge[]>> {
    const result = new Map<string, PublicSmartTagBadge[]>();
    if (!entities.length) return result;

    const entityRevisionById = new Map(
      entities.map((entity) => [entity._id.toString(), entity.taggingRevision]),
    );
    const assignments = await this.assignmentModel
      .find({
        entityType,
        entityId: { $in: entities.map((entity) => entity._id) },
        status: SmartTagAssignmentStatus.Active,
      })
      .lean()
      .exec();
    const currentAssignments = assignments.filter(
      (assignment) =>
        entityRevisionById.get(assignment.entityId.toString()) ===
        assignment.entityRevision,
    );
    if (!currentAssignments.length) return result;

    const definitions = await this.definitionModel
      .find({
        code: {
          $in: [...new Set(currentAssignments.map((item) => item.tagCode))],
        },
        status: SmartTagDefinitionStatus.Active,
        isPublicBadge: true,
        entityTypes: entityType,
      })
      .lean()
      .exec();
    const definitionByCode = new Map(
      definitions.map((definition) => [definition.code, definition]),
    );

    for (const assignment of currentAssignments) {
      const definition = definitionByCode.get(assignment.tagCode);
      if (!definition) continue;
      const id = assignment.entityId.toString();
      const badges = result.get(id) || [];
      badges.push({
        code: definition.code,
        label: definition.label,
        description: definition.description,
        displayPriority: definition.displayPriority,
        displayConfig: definition.displayConfig,
      });
      result.set(id, badges);
    }

    for (const badges of result.values()) {
      badges.sort(
        (first, second) =>
          first.displayPriority - second.displayPriority ||
          first.code.localeCompare(second.code),
      );
    }
    return result;
  }
}
