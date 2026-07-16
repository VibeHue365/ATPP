import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import {
  SMART_TAG_PIPELINE_VERSION,
  SmartTagActorRole,
  SmartTagAssignmentStatus,
  SmartTagDecisionAction,
  SmartTagEntityType,
  SmartTagGenerationRunStatus,
  SmartTagSignalSource,
  SmartTagSourceStatus,
} from '../constants/smart-tag.constants';
import {
  SmartTagDecisionDto,
  SmartTagSelectionDto,
} from '../dto/smart-tag.dto';
import {
  SmartTagAssignment,
  SmartTagAssignmentDocument,
} from '../schemas/smart-tag-assignment.schema';
import { SmartTagDecision } from '../schemas/smart-tag-decision.schema';
import {
  SmartTagGenerationRun,
  SmartTagGenerationRunDocument,
} from '../schemas/smart-tag-generation-run.schema';
import {
  Product,
  ProductDocument,
} from '../../products/schemas/product.schema';
import { Provider } from '../../providers/schemas/provider.schema';
import {
  PortfolioItem,
  PortfolioItemDocument,
} from '../../providers/schemas/portfolio-item.schema';
import { RuleBasedTaggingService } from './rule-based-tagging.service';
import { AiTaggingClientService } from './ai-tagging-client.service';
import { SmartTagTaxonomyService } from './smart-tag-taxonomy.service';
import { RateLimitService } from '../../auth/services/rate-limit.service';

const GENERATION_LOCK_MS = 30_000;
const GENERATION_RATE_LIMIT_MAX_ATTEMPTS = 10;
const GENERATION_RATE_LIMIT_WINDOW_SECONDS = 60;

@Injectable()
export class SmartTaggingService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(PortfolioItem.name)
    private readonly portfolioItemModel: Model<PortfolioItem>,
    @InjectModel(SmartTagAssignment.name)
    private readonly assignmentModel: Model<SmartTagAssignment>,
    @InjectModel(SmartTagGenerationRun.name)
    private readonly generationRunModel: Model<SmartTagGenerationRun>,
    @InjectModel(SmartTagDecision.name)
    private readonly decisionModel: Model<SmartTagDecision>,
    private readonly taxonomyService: SmartTagTaxonomyService,
    private readonly ruleEngine: RuleBasedTaggingService,
    private readonly aiTaggingClient: AiTaggingClientService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async generateForOwnedProduct(userId: string, productId: string) {
    await this.assertGenerationRateLimit(userId);
    const product = await this.requireOwnedProduct(userId, productId);
    const taxonomy = await this.taxonomyService.getActiveTaxonomy(
      SmartTagEntityType.Product,
    );
    const fingerprint = this.createProductFingerprint(
      product,
      taxonomy.revision,
    );
    const existingRun = await this.createOrGetRun({
      entityType: SmartTagEntityType.Product,
      entityId: product._id,
      entityRevision: product.taggingRevision,
      userId,
      fingerprint,
      taxonomyRevision: taxonomy.revision,
    });

    if (!existingRun.created) {
      return this.buildGenerationResponse(
        existingRun.run,
        SmartTagEntityType.Product,
        product._id,
      );
    }

    const suggestions = this.ruleEngine.suggestForProduct(
      {
        name: product.name,
        description: product.description,
        colors: product.colors,
        materials: product.materials,
        style: product.style,
        occasions: product.occasions,
      },
      taxonomy.definitions,
    );
    const aiResult = await this.aiTaggingClient.suggest({
      entityType: SmartTagEntityType.Product,
      title: product.name,
      description: product.description,
      structuredAttributes: {
        colors: product.colors,
        materials: product.materials,
        style: product.style,
        occasions: product.occasions,
      },
      definitions: taxonomy.definitions,
      taxonomyVersion: taxonomy.revision,
    });

    const currentProduct = await this.productModel
      .findById(product._id)
      .select({ taggingRevision: 1 })
      .lean()
      .exec();
    if (
      !currentProduct ||
      currentProduct.taggingRevision !== product.taggingRevision
    ) {
      const staleRun = await this.generationRunModel
        .findByIdAndUpdate(
          existingRun.run._id,
          {
            $set: {
              status: SmartTagGenerationRunStatus.StaleInput,
              completedAt: new Date(),
              errorCode: 'ENTITY_REVISION_CHANGED',
            },
          },
          { new: true },
        )
        .exec();
      return this.buildGenerationResponse(
        staleRun!,
        SmartTagEntityType.Product,
        product._id,
      );
    }

    for (const suggestion of suggestions) {
      await this.upsertSuggestion({
        entity: product,
        entityType: SmartTagEntityType.Product,
        tagCode: suggestion.tagCode,
        signal: suggestion.signal,
        fingerprint,
        taxonomyRevision: taxonomy.revision,
      });
    }
    for (const suggestion of aiResult.suggestions) {
      await this.upsertSuggestion({
        entity: product,
        entityType: SmartTagEntityType.Product,
        tagCode: suggestion.tagCode,
        signal: {
          source: suggestion.source,
          confidence: suggestion.confidence,
          evidence: { explanation: suggestion.explanation },
          modelMetadata: suggestion.modelMetadata,
        },
        fingerprint,
        taxonomyRevision: taxonomy.revision,
      });
    }

    const completedRun = await this.generationRunModel
      .findByIdAndUpdate(
        existingRun.run._id,
        {
          $set: {
            status: SmartTagGenerationRunStatus.Succeeded,
            sourceStatus: {
              rule: SmartTagSourceStatus.Success,
              aiText: aiResult.status,
              aiImage: SmartTagSourceStatus.Skipped,
            },
            resultTagCodes: Array.from(
              new Set([
                ...suggestions.map((suggestion) => suggestion.tagCode),
                ...aiResult.suggestions.map((suggestion) => suggestion.tagCode),
              ]),
            ),
            completedAt: new Date(),
            errorCode: null,
          },
        },
        { new: true },
      )
      .exec();

    return this.buildGenerationResponse(
      completedRun!,
      SmartTagEntityType.Product,
      product._id,
    );
  }

  async getOwnedProductTags(userId: string, productId: string) {
    const product = await this.requireOwnedProduct(userId, productId);
    return this.getEntityTagState(
      SmartTagEntityType.Product,
      product._id,
      product.taggingRevision,
    );
  }

  async generateForOwnedPortfolio(userId: string, itemId: string) {
    await this.assertGenerationRateLimit(userId);
    const item = await this.requireOwnedPortfolio(userId, itemId);
    const taxonomy = await this.taxonomyService.getActiveTaxonomy(
      SmartTagEntityType.Portfolio,
    );
    const fingerprint = this.createPortfolioFingerprint(
      item,
      taxonomy.revision,
    );
    const existingRun = await this.createOrGetRun({
      entityType: SmartTagEntityType.Portfolio,
      entityId: item._id,
      entityRevision: item.taggingRevision,
      userId,
      fingerprint,
      taxonomyRevision: taxonomy.revision,
    });
    if (!existingRun.created) {
      return this.buildGenerationResponse(
        existingRun.run,
        SmartTagEntityType.Portfolio,
        item._id,
      );
    }

    const suggestions = this.ruleEngine.suggestForProduct(
      {
        name: item.title,
        description: item.description,
        colors: [],
        materials: [],
        style: null,
        occasions: [],
      },
      taxonomy.definitions,
    );
    const aiResult = await this.aiTaggingClient.suggest({
      entityType: SmartTagEntityType.Portfolio,
      title: item.title,
      description: item.description,
      structuredAttributes: {},
      definitions: taxonomy.definitions,
      taxonomyVersion: taxonomy.revision,
    });
    const currentItem = await this.portfolioItemModel
      .findById(item._id)
      .select({ taggingRevision: 1 })
      .lean()
      .exec();
    if (!currentItem || currentItem.taggingRevision !== item.taggingRevision) {
      const staleRun = await this.generationRunModel
        .findByIdAndUpdate(
          existingRun.run._id,
          {
            $set: {
              status: SmartTagGenerationRunStatus.StaleInput,
              completedAt: new Date(),
              errorCode: 'ENTITY_REVISION_CHANGED',
            },
          },
          { new: true },
        )
        .exec();
      return this.buildGenerationResponse(
        staleRun!,
        SmartTagEntityType.Portfolio,
        item._id,
      );
    }

    for (const suggestion of suggestions) {
      await this.upsertSuggestion({
        entity: item,
        entityType: SmartTagEntityType.Portfolio,
        tagCode: suggestion.tagCode,
        signal: suggestion.signal,
        fingerprint,
        taxonomyRevision: taxonomy.revision,
      });
    }
    for (const suggestion of aiResult.suggestions) {
      await this.upsertSuggestion({
        entity: item,
        entityType: SmartTagEntityType.Portfolio,
        tagCode: suggestion.tagCode,
        signal: {
          source: suggestion.source,
          confidence: suggestion.confidence,
          evidence: { explanation: suggestion.explanation },
          modelMetadata: suggestion.modelMetadata,
        },
        fingerprint,
        taxonomyRevision: taxonomy.revision,
      });
    }
    const completedRun = await this.generationRunModel
      .findByIdAndUpdate(
        existingRun.run._id,
        {
          $set: {
            status: SmartTagGenerationRunStatus.Succeeded,
            sourceStatus: {
              rule: SmartTagSourceStatus.Success,
              aiText: aiResult.status,
              aiImage: SmartTagSourceStatus.Skipped,
            },
            resultTagCodes: Array.from(
              new Set([
                ...suggestions.map((suggestion) => suggestion.tagCode),
                ...aiResult.suggestions.map((suggestion) => suggestion.tagCode),
              ]),
            ),
            completedAt: new Date(),
            errorCode: null,
          },
        },
        { new: true },
      )
      .exec();
    return this.buildGenerationResponse(
      completedRun!,
      SmartTagEntityType.Portfolio,
      item._id,
    );
  }

  async getOwnedPortfolioTags(userId: string, itemId: string) {
    const item = await this.requireOwnedPortfolio(userId, itemId);
    return this.getEntityTagState(
      SmartTagEntityType.Portfolio,
      item._id,
      item.taggingRevision,
    );
  }

  async decideOwnedPortfolioTag(
    userId: string,
    itemId: string,
    tagCode: string,
    dto: SmartTagDecisionDto,
  ) {
    const item = await this.requireOwnedPortfolio(userId, itemId);
    const assignment = await this.assignmentModel
      .findOne({
        entityType: SmartTagEntityType.Portfolio,
        entityId: item._id,
        entityRevision: item.taggingRevision,
        tagCode: tagCode.toUpperCase(),
      })
      .exec();
    if (!assignment)
      throw new NotFoundException('Smart tag assignment not found');

    const transition = this.getTransition(assignment.status, dto.action);
    const reserved = await this.portfolioItemModel
      .findOneAndUpdate(
        {
          _id: item._id,
          taggingRevision: item.taggingRevision,
          taggingDecisionVersion: dto.expectedDecisionVersion,
        },
        { $inc: { taggingDecisionVersion: 1 } },
        { new: true },
      )
      .exec();
    if (!reserved) {
      throw new ConflictException('Smart tag decision version is stale');
    }

    const updatedAssignment = await this.assignmentModel
      .findOneAndUpdate(
        { _id: assignment._id, status: assignment.status },
        {
          $set: {
            status: transition.status,
            decidedBy: new Types.ObjectId(userId),
            decidedByRole: SmartTagActorRole.Provider,
            decidedAt: new Date(),
            decisionReason: transition.requiresReason
              ? dto.reason!.trim()
              : null,
          },
        },
        { new: true },
      )
      .exec();
    if (!updatedAssignment) {
      throw new ConflictException('Smart tag state was already changed');
    }
    await this.decisionModel.create({
      assignmentId: assignment._id,
      entityType: SmartTagEntityType.Portfolio,
      entityId: item._id,
      entityRevision: item.taggingRevision,
      action: dto.action,
      actorId: new Types.ObjectId(userId),
      actorRole: SmartTagActorRole.Provider,
      reason: transition.requiresReason ? dto.reason!.trim() : null,
      decisionVersion: dto.expectedDecisionVersion + 1,
    });
    return updatedAssignment;
  }

  async getAdminEntityTags(entityType: SmartTagEntityType, entityId: string) {
    const entity = await this.requireEntity(entityType, entityId);
    const assignments = await this.getEntityTagState(
      entityType,
      entity._id,
      entity.taggingRevision,
    );
    return {
      taggingRevision: entity.taggingRevision,
      taggingDecisionVersion: entity.taggingDecisionVersion,
      assignments,
    };
  }

  async decideAdminTag(
    adminId: string,
    entityType: SmartTagEntityType,
    entityId: string,
    tagCode: string,
    dto: SmartTagDecisionDto,
  ) {
    const entity = await this.requireEntity(entityType, entityId);
    const assignment = await this.assignmentModel
      .findOne({
        entityType,
        entityId: entity._id,
        entityRevision: entity.taggingRevision,
        tagCode: tagCode.toUpperCase(),
      })
      .exec();
    if (!assignment)
      throw new NotFoundException('Smart tag assignment not found');

    const transition = this.getTransition(assignment.status, dto.action);
    await this.reserveEntityDecisionVersion(
      entityType,
      entity._id,
      entity.taggingRevision,
      dto.expectedDecisionVersion,
    );
    const updatedAssignment = await this.assignmentModel
      .findOneAndUpdate(
        { _id: assignment._id, status: assignment.status },
        {
          $set: {
            status: transition.status,
            decidedBy: new Types.ObjectId(adminId),
            decidedByRole: SmartTagActorRole.Admin,
            decidedAt: new Date(),
            decisionReason: transition.requiresReason
              ? dto.reason!.trim()
              : null,
          },
        },
        { new: true },
      )
      .exec();
    if (!updatedAssignment) {
      throw new ConflictException('Smart tag state was already changed');
    }
    await this.decisionModel.create({
      assignmentId: assignment._id,
      entityType,
      entityId: entity._id,
      entityRevision: entity.taggingRevision,
      action: dto.action,
      actorId: new Types.ObjectId(adminId),
      actorRole: SmartTagActorRole.Admin,
      reason: transition.requiresReason ? dto.reason!.trim() : null,
      decisionVersion: dto.expectedDecisionVersion + 1,
    });
    return updatedAssignment;
  }

  async decideOwnedProductTag(
    userId: string,
    productId: string,
    tagCode: string,
    dto: SmartTagDecisionDto,
  ) {
    const product = await this.requireOwnedProduct(userId, productId);
    const assignment = await this.assignmentModel
      .findOne({
        entityType: SmartTagEntityType.Product,
        entityId: product._id,
        entityRevision: product.taggingRevision,
        tagCode: tagCode.toUpperCase(),
      })
      .exec();
    if (!assignment)
      throw new NotFoundException('Smart tag assignment not found');

    const transition = this.getTransition(assignment.status, dto.action);
    await this.reserveDecisionVersion(product, dto.expectedDecisionVersion);

    const updatedAssignment = await this.assignmentModel
      .findOneAndUpdate(
        { _id: assignment._id, status: assignment.status },
        {
          $set: {
            status: transition.status,
            decidedBy: new Types.ObjectId(userId),
            decidedByRole: SmartTagActorRole.Provider,
            decidedAt: new Date(),
            decisionReason: transition.requiresReason
              ? dto.reason!.trim()
              : null,
          },
        },
        { new: true },
      )
      .exec();
    if (!updatedAssignment) {
      throw new ConflictException('Smart tag state was already changed');
    }

    await this.decisionModel.create({
      assignmentId: assignment._id,
      entityType: SmartTagEntityType.Product,
      entityId: product._id,
      entityRevision: product.taggingRevision,
      action: dto.action,
      actorId: new Types.ObjectId(userId),
      actorRole: SmartTagActorRole.Provider,
      reason: transition.requiresReason ? dto.reason!.trim() : null,
      decisionVersion: dto.expectedDecisionVersion + 1,
    });

    return updatedAssignment;
  }

  async selectOwnedProductTags(
    userId: string,
    productId: string,
    dto: SmartTagSelectionDto,
  ) {
    const product = await this.requireOwnedProduct(userId, productId);
    const requestedCodes = [
      ...new Set(dto.activeTagCodes.map((code) => code.toUpperCase())),
    ];
    const validDefinitions = await this.taxonomyService.listActiveDefinitions(
      SmartTagEntityType.Product,
    );
    const validCodes = new Set(
      validDefinitions.map((definition) => definition.code),
    );
    const invalidCodes = requestedCodes.filter((code) => !validCodes.has(code));
    if (invalidCodes.length) {
      throw new BadRequestException(
        `Unknown or inactive tags: ${invalidCodes.join(', ')}`,
      );
    }

    await this.reserveDecisionVersion(product, dto.expectedDecisionVersion);
    const taxonomy = await this.taxonomyService.getActiveTaxonomy(
      SmartTagEntityType.Product,
    );
    const fingerprint = this.createProductFingerprint(
      product,
      taxonomy.revision,
    );
    const existingAssignments = await this.assignmentModel
      .find({
        entityType: SmartTagEntityType.Product,
        entityId: product._id,
        entityRevision: product.taggingRevision,
      })
      .exec();
    const byCode = new Map(
      existingAssignments.map((item) => [item.tagCode, item]),
    );

    for (const code of requestedCodes) {
      const existing = byCode.get(code);
      if (existing) {
        await this.assignmentModel.updateOne(
          { _id: existing._id },
          {
            $set: {
              status: SmartTagAssignmentStatus.Active,
              decidedBy: new Types.ObjectId(userId),
              decidedByRole: SmartTagActorRole.Provider,
              decidedAt: new Date(),
              decisionReason: null,
            },
            $addToSet: {
              signals: { source: SmartTagSignalSource.Manual },
            },
          },
        );
      } else {
        await this.assignmentModel.create({
          entityType: SmartTagEntityType.Product,
          entityId: product._id,
          tagCode: code,
          entityRevision: product.taggingRevision,
          taxonomyRevision: taxonomy.revision,
          lastInputFingerprint: fingerprint,
          signals: [{ source: SmartTagSignalSource.Manual }],
          status: SmartTagAssignmentStatus.Active,
          decidedBy: new Types.ObjectId(userId),
          decidedByRole: SmartTagActorRole.Provider,
          decidedAt: new Date(),
        });
      }
    }

    const toRemove = existingAssignments.filter(
      (assignment) =>
        assignment.status === SmartTagAssignmentStatus.Active &&
        !requestedCodes.includes(assignment.tagCode),
    );
    if (toRemove.length) {
      await this.assignmentModel.updateMany(
        { _id: { $in: toRemove.map((assignment) => assignment._id) } },
        {
          $set: {
            status: SmartTagAssignmentStatus.Removed,
            decidedBy: new Types.ObjectId(userId),
            decidedByRole: SmartTagActorRole.Provider,
            decidedAt: new Date(),
            decisionReason: null,
          },
        },
      );
    }

    await this.decisionModel.create({
      entityType: SmartTagEntityType.Product,
      entityId: product._id,
      entityRevision: product.taggingRevision,
      action: SmartTagDecisionAction.BulkSelection,
      actorId: new Types.ObjectId(userId),
      actorRole: SmartTagActorRole.Provider,
      decisionVersion: dto.expectedDecisionVersion + 1,
    });

    return this.getEntityTagState(
      SmartTagEntityType.Product,
      product._id,
      product.taggingRevision,
    );
  }

  async selectOwnedPortfolioTags(
    userId: string,
    itemId: string,
    dto: SmartTagSelectionDto,
  ) {
    const item = await this.requireOwnedPortfolio(userId, itemId);
    const requestedCodes = [
      ...new Set(dto.activeTagCodes.map((code) => code.toUpperCase())),
    ];
    const taxonomy = await this.taxonomyService.getActiveTaxonomy(
      SmartTagEntityType.Portfolio,
    );
    const validCodes = new Set(
      taxonomy.definitions.map((definition) => definition.code),
    );
    const invalidCodes = requestedCodes.filter((code) => !validCodes.has(code));
    if (invalidCodes.length) {
      throw new BadRequestException(
        `Unknown or inactive tags: ${invalidCodes.join(', ')}`,
      );
    }

    await this.reserveEntityDecisionVersion(
      SmartTagEntityType.Portfolio,
      item._id,
      item.taggingRevision,
      dto.expectedDecisionVersion,
    );
    const fingerprint = this.createPortfolioFingerprint(
      item,
      taxonomy.revision,
    );
    const existingAssignments = await this.assignmentModel
      .find({
        entityType: SmartTagEntityType.Portfolio,
        entityId: item._id,
        entityRevision: item.taggingRevision,
      })
      .exec();
    const assignmentsByCode = new Map(
      existingAssignments.map((assignment) => [assignment.tagCode, assignment]),
    );

    for (const tagCode of requestedCodes) {
      const existing = assignmentsByCode.get(tagCode);
      if (existing) {
        await this.assignmentModel.updateOne(
          { _id: existing._id },
          {
            $set: {
              status: SmartTagAssignmentStatus.Active,
              decidedBy: new Types.ObjectId(userId),
              decidedByRole: SmartTagActorRole.Provider,
              decidedAt: new Date(),
              decisionReason: null,
            },
            $addToSet: { signals: { source: SmartTagSignalSource.Manual } },
          },
        );
      } else {
        await this.assignmentModel.create({
          entityType: SmartTagEntityType.Portfolio,
          entityId: item._id,
          tagCode,
          entityRevision: item.taggingRevision,
          taxonomyRevision: taxonomy.revision,
          lastInputFingerprint: fingerprint,
          signals: [{ source: SmartTagSignalSource.Manual }],
          status: SmartTagAssignmentStatus.Active,
          decidedBy: new Types.ObjectId(userId),
          decidedByRole: SmartTagActorRole.Provider,
          decidedAt: new Date(),
        });
      }
    }

    const removedAssignments = existingAssignments.filter(
      (assignment) =>
        assignment.status === SmartTagAssignmentStatus.Active &&
        !requestedCodes.includes(assignment.tagCode),
    );
    if (removedAssignments.length) {
      await this.assignmentModel.updateMany(
        {
          _id: { $in: removedAssignments.map((assignment) => assignment._id) },
        },
        {
          $set: {
            status: SmartTagAssignmentStatus.Removed,
            decidedBy: new Types.ObjectId(userId),
            decidedByRole: SmartTagActorRole.Provider,
            decidedAt: new Date(),
            decisionReason: null,
          },
        },
      );
    }

    await this.decisionModel.create({
      entityType: SmartTagEntityType.Portfolio,
      entityId: item._id,
      entityRevision: item.taggingRevision,
      action: SmartTagDecisionAction.BulkSelection,
      actorId: new Types.ObjectId(userId),
      actorRole: SmartTagActorRole.Provider,
      decisionVersion: dto.expectedDecisionVersion + 1,
    });

    return this.getEntityTagState(
      SmartTagEntityType.Portfolio,
      item._id,
      item.taggingRevision,
    );
  }

  private async getEntityTagState(
    entityType: SmartTagEntityType,
    entityId: Types.ObjectId,
    revision: number,
  ) {
    const [assignments, definitions] = await Promise.all([
      this.assignmentModel
        .find({
          entityType,
          entityId,
          entityRevision: revision,
        })
        .sort({ updatedAt: -1 })
        .lean()
        .exec(),
      this.taxonomyService.listActiveDefinitions(entityType),
    ]);
    const definitionsByCode = new Map(
      definitions.map((definition) => [definition.code, definition]),
    );
    return assignments.map((assignment) => ({
      ...assignment,
      definition: definitionsByCode.get(assignment.tagCode) || null,
    }));
  }

  private async createOrGetRun(input: {
    entityType: SmartTagEntityType;
    entityId: Types.ObjectId;
    entityRevision: number;
    userId: string;
    fingerprint: string;
    taxonomyRevision: number;
  }): Promise<{ run: SmartTagGenerationRunDocument; created: boolean }> {
    const now = new Date();
    try {
      const run = await this.generationRunModel.create({
        entityType: input.entityType,
        entityId: input.entityId,
        entityRevision: input.entityRevision,
        inputFingerprint: input.fingerprint,
        pipelineVersion: SMART_TAG_PIPELINE_VERSION,
        taxonomyRevision: input.taxonomyRevision,
        status: SmartTagGenerationRunStatus.Processing,
        sourceStatus: {
          rule: SmartTagSourceStatus.Skipped,
          aiText: SmartTagSourceStatus.Skipped,
          aiImage: SmartTagSourceStatus.Skipped,
        },
        resultTagCodes: [],
        initiatedBy: new Types.ObjectId(input.userId),
        startedAt: now,
        lockExpiresAt: new Date(now.getTime() + GENERATION_LOCK_MS),
        attemptCount: 1,
      });
      return { run, created: true };
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const run = await this.generationRunModel
        .findOne({
          entityType: input.entityType,
          entityId: input.entityId,
          inputFingerprint: input.fingerprint,
        })
        .exec();
      if (!run) throw error;

      const now = new Date();
      const retryableStatuses = [
        SmartTagGenerationRunStatus.Failed,
        SmartTagGenerationRunStatus.StaleInput,
      ];
      const retryFilter =
        run.status === SmartTagGenerationRunStatus.Processing
          ? {
              status: SmartTagGenerationRunStatus.Processing,
              lockExpiresAt: { $lte: now },
            }
          : { status: { $in: retryableStatuses } };
      const takeover = await this.generationRunModel
        .findOneAndUpdate(
          { _id: run._id, ...retryFilter },
          {
            $set: {
              status: SmartTagGenerationRunStatus.Processing,
              sourceStatus: {
                rule: SmartTagSourceStatus.Skipped,
                aiText: SmartTagSourceStatus.Skipped,
                aiImage: SmartTagSourceStatus.Skipped,
              },
              resultTagCodes: [],
              errorCode: null,
              startedAt: now,
              completedAt: null,
              lockExpiresAt: new Date(now.getTime() + GENERATION_LOCK_MS),
            },
            $inc: { attemptCount: 1 },
          },
          { new: true },
        )
        .exec();
      if (takeover) return { run: takeover, created: true };
      return { run, created: false };
    }
  }

  private assertGenerationRateLimit(userId: string): Promise<void> {
    return this.rateLimitService.assertRateLimit(
      `smart-tag:generate:user:${userId}`,
      GENERATION_RATE_LIMIT_MAX_ATTEMPTS,
      GENERATION_RATE_LIMIT_WINDOW_SECONDS,
    );
  }

  private async buildGenerationResponse(
    run: SmartTagGenerationRunDocument,
    entityType: SmartTagEntityType,
    entityId: Types.ObjectId,
  ) {
    return {
      run,
      assignments: await this.getEntityTagState(
        entityType,
        entityId,
        run.entityRevision,
      ),
    };
  }

  private async upsertSuggestion(input: {
    entity: { _id: Types.ObjectId; taggingRevision: number };
    entityType: SmartTagEntityType;
    tagCode: string;
    signal: any;
    fingerprint: string;
    taxonomyRevision: number;
  }) {
    const existing = await this.assignmentModel
      .findOne({
        entityType: input.entityType,
        entityId: input.entity._id,
        tagCode: input.tagCode,
      })
      .exec();
    const signal = input.signal;

    if (!existing) {
      await this.assignmentModel.create({
        entityType: input.entityType,
        entityId: input.entity._id,
        tagCode: input.tagCode,
        entityRevision: input.entity.taggingRevision,
        taxonomyRevision: input.taxonomyRevision,
        lastInputFingerprint: input.fingerprint,
          signals: [signal],
        status: SmartTagAssignmentStatus.Suggested,
        suggestedAt: new Date(),
      });
      return;
    }

    const preserveDecision =
      existing.entityRevision === input.entity.taggingRevision &&
      [
        SmartTagAssignmentStatus.Active,
        SmartTagAssignmentStatus.Rejected,
        SmartTagAssignmentStatus.Removed,
      ].includes(existing.status);
    const signals = [
      ...existing.signals.filter(
        (existingSignal) => existingSignal.source !== signal.source,
      ),
      signal,
    ];
    await this.assignmentModel.updateOne(
      { _id: existing._id },
      {
        $set: {
          entityRevision: input.entity.taggingRevision,
          taxonomyRevision: input.taxonomyRevision,
          lastInputFingerprint: input.fingerprint,
          signals,
          status: preserveDecision
            ? existing.status
            : SmartTagAssignmentStatus.Suggested,
          suggestedAt: preserveDecision ? existing.suggestedAt : new Date(),
          ...(preserveDecision
            ? {}
            : {
                decidedBy: null,
                decidedByRole: null,
                decidedAt: null,
                decisionReason: null,
              }),
        },
      },
    );
  }

  private async requireOwnedProduct(userId: string, productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException('Product not found');
    }
    const [provider, product] = await Promise.all([
      this.providerModel
        .findOne({ userId: new Types.ObjectId(userId) })
        .lean()
        .exec(),
      this.productModel.findById(productId).exec(),
    ]);
    if (
      !product ||
      !provider ||
      product.providerId.toString() !== provider._id.toString()
    ) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private async requireOwnedPortfolio(userId: string, itemId: string) {
    if (!Types.ObjectId.isValid(itemId)) {
      throw new NotFoundException('Portfolio item not found');
    }
    const [provider, item] = await Promise.all([
      this.providerModel
        .findOne({ userId: new Types.ObjectId(userId) })
        .lean()
        .exec(),
      this.portfolioItemModel.findById(itemId).exec(),
    ]);
    if (
      !item ||
      !provider ||
      item.providerId.toString() !== provider._id.toString()
    ) {
      throw new NotFoundException('Portfolio item not found');
    }
    return item;
  }

  private async requireEntity(
    entityType: SmartTagEntityType,
    entityId: string,
  ) {
    if (!Types.ObjectId.isValid(entityId)) {
      throw new NotFoundException('Content not found');
    }
    const entity =
      entityType === SmartTagEntityType.Product
        ? await this.productModel.findById(entityId).exec()
        : await this.portfolioItemModel.findById(entityId).exec();
    if (!entity) throw new NotFoundException('Content not found');
    return entity;
  }

  async markAssignmentsStale(
    entityType: SmartTagEntityType,
    entityId: Types.ObjectId,
    currentRevision: number,
  ) {
    // A provider's explicit selection remains valid for the saved revision.
    await this.assignmentModel.updateMany(
      {
        entityType,
        entityId,
        entityRevision: { $lt: currentRevision },
        status: SmartTagAssignmentStatus.Active,
        decidedByRole: SmartTagActorRole.Provider,
      },
      { $set: { entityRevision: currentRevision } },
    );

    // Unconfirmed AI suggestions and non-provider decisions must be regenerated.
    await this.assignmentModel.updateMany(
      {
        entityType,
        entityId,
        entityRevision: { $lt: currentRevision },
        status: { $ne: SmartTagAssignmentStatus.Stale },
      },
      { $set: { status: SmartTagAssignmentStatus.Stale } },
    );
  }

  private async reserveDecisionVersion(
    product: ProductDocument,
    expectedDecisionVersion: number,
  ) {
    const reserved = await this.productModel
      .findOneAndUpdate(
        {
          _id: product._id,
          taggingRevision: product.taggingRevision,
          taggingDecisionVersion: expectedDecisionVersion,
        },
        { $inc: { taggingDecisionVersion: 1 } },
        { new: true },
      )
      .exec();
    if (!reserved) {
      throw new ConflictException('Smart tag decision version is stale');
    }
  }

  private async reserveEntityDecisionVersion(
    entityType: SmartTagEntityType,
    entityId: Types.ObjectId,
    taggingRevision: number,
    expectedDecisionVersion: number,
  ) {
    const filter = {
      _id: entityId,
      taggingRevision,
      taggingDecisionVersion: expectedDecisionVersion,
    };
    const update = { $inc: { taggingDecisionVersion: 1 } };
    const reserved =
      entityType === SmartTagEntityType.Product
        ? await this.productModel
            .findOneAndUpdate(filter, update, { new: true })
            .exec()
        : await this.portfolioItemModel
            .findOneAndUpdate(filter, update, { new: true })
            .exec();
    if (!reserved) {
      throw new ConflictException('Smart tag decision version is stale');
    }
  }

  private getTransition(
    status: SmartTagAssignmentStatus,
    action: SmartTagDecisionAction,
  ): { status: SmartTagAssignmentStatus; requiresReason: boolean } {
    if (
      action === SmartTagDecisionAction.Activate &&
      [
        SmartTagAssignmentStatus.Suggested,
        SmartTagAssignmentStatus.Rejected,
        SmartTagAssignmentStatus.Removed,
      ].includes(status)
    ) {
      return { status: SmartTagAssignmentStatus.Active, requiresReason: false };
    }
    if (
      action === SmartTagDecisionAction.Reject &&
      status === SmartTagAssignmentStatus.Suggested
    ) {
      return {
        status: SmartTagAssignmentStatus.Rejected,
        requiresReason: true,
      };
    }
    if (
      action === SmartTagDecisionAction.Remove &&
      status === SmartTagAssignmentStatus.Active
    ) {
      return { status: SmartTagAssignmentStatus.Removed, requiresReason: true };
    }
    if (
      action === SmartTagDecisionAction.Restore &&
      [
        SmartTagAssignmentStatus.Rejected,
        SmartTagAssignmentStatus.Removed,
      ].includes(status)
    ) {
      return { status: SmartTagAssignmentStatus.Active, requiresReason: false };
    }
    throw new ConflictException('Smart tag transition is not allowed');
  }

  private createProductFingerprint(
    product: ProductDocument,
    taxonomyRevision: number,
  ) {
    const payload = {
      entityType: SmartTagEntityType.Product,
      entityId: product._id.toString(),
      entityRevision: product.taggingRevision,
      taxonomyRevision,
      pipelineVersion: SMART_TAG_PIPELINE_VERSION,
      name: normalizeForFingerprint(product.name),
      description: normalizeForFingerprint(product.description || ''),
      colors: normalizeArray(product.colors),
      materials: normalizeArray(product.materials),
      style: normalizeForFingerprint(product.style || ''),
      occasions: normalizeArray(product.occasions),
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private createPortfolioFingerprint(
    item: PortfolioItemDocument,
    taxonomyRevision: number,
  ) {
    const payload = {
      entityType: SmartTagEntityType.Portfolio,
      entityId: item._id.toString(),
      entityRevision: item.taggingRevision,
      taxonomyRevision,
      pipelineVersion: SMART_TAG_PIPELINE_VERSION,
      title: normalizeForFingerprint(item.title),
      description: normalizeForFingerprint(item.description || ''),
      images: normalizeArray(item.images),
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}

function normalizeForFingerprint(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeArray(values: string[] = []): string[] {
  return values.map(normalizeForFingerprint).sort();
}

