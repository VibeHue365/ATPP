import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Provider,
  ProviderCapability,
  ProviderDocument,
  ProviderStatus,
} from '../../providers/schemas/provider.schema';
import { PackageStatus, PhotographyPackage } from '../../products/schemas/photography-package.schema';
import { Category, CategoryStatus, ServiceCategoryType } from '../../categories/schemas/category.schema';
import {
  ProviderSchedule,
  ScheduleCapability,
  ScheduleType,
} from '../../products/schemas/provider-schedule.schema';
import { PortfolioItem } from '../../providers/schemas/portfolio-item.schema';
import { ProductModerationStatus } from '../../products/schemas/product.schema';
import { SmartTagPublicProjectionService, type PublicSmartTagBadge } from '../../smart-tagging/services/smart-tag-public-projection.service';
import { PhotographerDiscoveryQueryDto, PhotographerSortOption } from '../dto/photographer-discovery-query.dto';

const DISCOVERY_LOCATION_KEY = '__locationForDiscovery';

@Injectable()
export class PhotographersService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(PhotographyPackage.name)
    private readonly packageModel: Model<PhotographyPackage>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    @InjectModel(PortfolioItem.name)
    private readonly portfolioItemModel: Model<PortfolioItem>,
    @InjectModel(ProviderSchedule.name)
    private readonly providerScheduleModel: Model<ProviderSchedule>,
    private readonly smartTagPublicProjectionService: SmartTagPublicProjectionService,
  ) {
    void this.getPublicPhotographers().catch(() => undefined);
  }

  private publicPhotographersCache?: {
    value: Record<string, unknown>[];
    expiresAt: number;
  };
  private publicPhotographersInFlight?: Promise<Record<string, unknown>[]>;

  private async getPublicPhotographers(): Promise<Record<string, unknown>[]> {
    const now = Date.now();
    if (this.publicPhotographersCache && this.publicPhotographersCache.expiresAt > now) {
      return this.publicPhotographersCache.value;
    }
    if (this.publicPhotographersInFlight) return this.publicPhotographersInFlight;

    this.publicPhotographersInFlight = this.loadPublicPhotographers()
      .then((value) => {
        this.publicPhotographersCache = { value, expiresAt: Date.now() + 120_000 };
        return value;
      })
      .finally(() => {
        this.publicPhotographersInFlight = undefined;
      });
    return this.publicPhotographersInFlight;
  }
  
  async findAll(query: PhotographerDiscoveryQueryDto = {}) {
    const publicPhotographers = await this.getPublicPhotographers();
    const normalizedQuery = this.normalizeDiscoveryQuery(query);
    const matchingPhotographers = publicPhotographers
      .filter((photographer) => this.matchesDiscoveryQuery(photographer, normalizedQuery))
      .sort((left, right) => this.comparePhotographers(left, right, normalizedQuery.sort));

    const total = matchingPhotographers.length;
    const totalPages = Math.max(1, Math.ceil(total / normalizedQuery.limit));
    const page = Math.min(normalizedQuery.page, totalPages);
    const start = (page - 1) * normalizedQuery.limit;

    return {
      data: matchingPhotographers
        .slice(start, start + normalizedQuery.limit)
        .map((photographer) => {
          const { [DISCOVERY_LOCATION_KEY]: _privateLocation, ...publicPhotographer } =
            photographer;
          return publicPhotographer;
        }),
      meta: {
        page,
        limit: normalizedQuery.limit,
        total,
        totalPages,
      },
    };
  }

  async findPackageCategories() {
    const [categories, counts] = await Promise.all([
      this.categoryModel
        .find({
          type: ServiceCategoryType.PhotographyCategory,
          status: CategoryStatus.Active,
        })
        .sort({ displayOrder: 1, name: 1 })
        .lean()
        .exec(),
      this.packageModel.aggregate<{ _id: Types.ObjectId; packageCount: number }>([
        {
          $match: {
            status: PackageStatus.Active,
            categoryId: { $ne: null },
          },
        },
        { $group: { _id: '$categoryId', packageCount: { $sum: 1 } } },
      ]).exec(),
    ]);

    const packageCountByCategory = new Map(
      counts.map((item) => [String(item._id), item.packageCount]),
    );

    return {
      data: categories.map((category) => ({
        id: String(category._id),
        name: category.name,
        slug: category.slug,
        type: category.type,
        description: category.description ?? null,
        iconUrl: category.iconUrl ?? null,
        coverImageUrl: category.coverImageUrl ?? null,
        parentId: category.parentId ? String(category.parentId) : null,
        status: category.status,
        displayOrder: category.displayOrder,
        metadata: category.metadata ?? null,
        packageCount: packageCountByCategory.get(String(category._id)) ?? 0,
      })),
    };
  }
  async findConcepts() {
    const photographers = await this.getPublicPhotographers();
    const concepts = new Map<
      string,
      {
        code: string;
        label: string;
        photographerIds: Set<string>;
        coverImage: string | null;
      }
    >();

    for (const photographer of photographers) {
      const photographerId = String(photographer._id);
      const portfolioItems = photographer.portfolioItems as Array<{
        images: string[];
        badges?: Array<{ code?: string; label?: string }>;
      }>;
      for (const item of portfolioItems) {
        for (const badge of item.badges ?? []) {
          if (!badge.code || !badge.label) continue;
          const concept = concepts.get(badge.code) ?? {
            code: badge.code,
            label: badge.label,
            photographerIds: new Set<string>(),
            coverImage: item.images[0] ?? null,
          };
          concept.photographerIds.add(photographerId);
          if (!concept.coverImage && item.images[0]) {
            concept.coverImage = item.images[0];
          }
          concepts.set(badge.code, concept);
        }
      }
    }

    return {
      data: [...concepts.values()]
        .map((concept) => ({
          code: concept.code,
          label: concept.label,
          photographerCount: concept.photographerIds.size,
          coverImage: concept.coverImage,
        }))
        .sort(
          (left, right) =>
            right.photographerCount - left.photographerCount ||
            left.label.localeCompare(right.label, 'vi'),
        ),
    };
  }

  async findOne(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('ID nhiáº¿p áº£nh gia khÃ´ng há»£p lá»‡');
    }
    const photographer = await this.providerModel.findOne({
      _id: new Types.ObjectId(id),
      capabilities: ProviderCapability.Photography,
      status: ProviderStatus.Active,
    }).exec();
    if (!photographer) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y nhiáº¿p áº£nh gia vá»›i ID: ${id}`);
    }

    const packages = await this.packageModel
      .find({
        providerId: photographer._id,
        status: PackageStatus.Active,
      })
      .sort({ price: 1, updatedAt: -1 })
      .exec();
    const publicPhotographer = await this.toPublicPhotographer(
      photographer,
      packages,
    );
    const portfolioItems = publicPhotographer.portfolioItems as unknown[];
    if (packages.length === 0 && portfolioItems.length === 0) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y nhiáº¿p áº£nh gia cÃ´ng khai');
    }
    return publicPhotographer;
  }

  async findPackages(providerId: string): Promise<PhotographyPackage[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw new NotFoundException('ID nhÃ  cung cáº¥p khÃ´ng há»£p lá»‡');
    }
    const photographer = await this.providerModel.exists({
      _id: new Types.ObjectId(providerId),
      capabilities: ProviderCapability.Photography,
      status: ProviderStatus.Active,
    });
    if (!photographer) {
      throw new NotFoundException('Active photographer not found');
    }
    return this.packageModel.find({
      providerId: new Types.ObjectId(providerId),
      status: PackageStatus.Active,
    }).sort({ updatedAt: -1 }).exec();
  }

  async findAvailability(providerId: string, date: string): Promise<{
    date: string;
    timeRanges: Array<{ start: string; end: string }>;
  }> {
    if (!Types.ObjectId.isValid(providerId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new NotFoundException('ThÃ´ng tin lá»‹ch lÃ m viá»‡c khÃ´ng há»£p lá»‡');
    }

    const photographer = await this.providerModel.findOne({
      _id: new Types.ObjectId(providerId),
      capabilities: ProviderCapability.Photography,
      status: ProviderStatus.Active,
    });
    if (!photographer) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y nhiáº¿p áº£nh gia Ä‘ang hoáº¡t Ä‘á»™ng');
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      throw new NotFoundException('ThÃ´ng tin lá»‹ch lÃ m viá»‡c khÃ´ng há»£p lá»‡');
    }

    const specificSchedule = await this.providerScheduleModel.findOne({
      providerId: photographer._id,
      scheduleType: ScheduleType.SpecificDate,
      specificDate: selectedDate,
      $or: [{ capability: null }, { capability: ScheduleCapability.Photography }],
    });
    const isOffDay = specificSchedule?.offDays.some(
      (offDay: Date) => offDay.toISOString().slice(0, 10) === date,
    );
    if (isOffDay) {
      return { date, timeRanges: [] };
    }

    if (specificSchedule?.customSlots.length) {
      return {
        date,
        timeRanges: specificSchedule.customSlots
          .filter((slot: { timeSlot: string; status: string }) => slot.status === 'AVAILABLE')
          .map((slot: { timeSlot: string; status: string }) => {
            const [start, end] = slot.timeSlot.split('-').map((value: string) => value.trim());
            return { start, end };
          })
          .filter((slot: { start: string; end: string }) => slot.start && slot.end),
      };
    }

    const recurringSchedule = await this.providerScheduleModel.findOne({
      providerId: photographer._id,
      scheduleType: ScheduleType.Recurring,
      dayOfWeek: selectedDate.getDay(),
      $or: [{ capability: null }, { capability: ScheduleCapability.Photography }],
    });

    return {
      date,
      timeRanges: recurringSchedule?.workingHours || [],
    };
  }
  private async loadPublicPhotographers(): Promise<Record<string, unknown>[]> {
    const [activePackages, approvedPortfolioItems] = await Promise.all([
      this.packageModel
        .find({ status: PackageStatus.Active })
        .select('providerId categoryId conceptCategoryIds styleCategoryIds eventCategoryIds name slug description price durationHours pricingUnit includedDurationMinutes includedSessionCount includedDayCount additionalSessionFee editedPhotosCount rawPhotosCount deliveryDays travelFeeNotes overtimeFeePerHour overtimeIncrementMinutes maxOvertimeMinutes bufferBeforeMinutes bufferAfterMinutes images status maxPeople rating createdAt updatedAt')
        .sort({ price: 1, updatedAt: -1 })
        .lean()
        .exec(),
      this.portfolioItemModel
        .find({ moderationStatus: ProductModerationStatus.Approved })
        .select('providerId title description images taggingRevision createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .lean()
        .exec(),
    ]);

    const publicProviderIds = [
      ...new Set([
        ...activePackages.map((item) => item.providerId.toString()),
        ...approvedPortfolioItems.map((item) => item.providerId.toString()),
      ]),
    ]
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!publicProviderIds.length) return [];

    const photographers = await this.providerModel
      .find({
        capabilities: ProviderCapability.Photography,
        _id: { $in: publicProviderIds },
        status: ProviderStatus.Active,
      })
      .select('businessName status address media photographySettings rating quote equipment policies portfolio createdAt updatedAt')
      .lean()
      .exec();
    const visibleProviderIds = new Set(photographers.map((item) => item._id.toString()));
    const packagesByProvider = new Map<string, any[]>();
    const portfolioByProvider = new Map<string, typeof approvedPortfolioItems>();

    for (const item of activePackages) {
      const providerId = item.providerId.toString();
      if (!visibleProviderIds.has(providerId)) continue;
      const packages = packagesByProvider.get(providerId) || [];
      packages.push(item);
      packagesByProvider.set(providerId, packages);
    }
    for (const item of approvedPortfolioItems) {
      const providerId = item.providerId.toString();
      if (!visibleProviderIds.has(providerId)) continue;
      const portfolioItems = portfolioByProvider.get(providerId) || [];
      portfolioItems.push(item);
      portfolioByProvider.set(providerId, portfolioItems);
    }

    const portfolioBadgeMap = await this.smartTagPublicProjectionService.projectPortfolioBadges(
      approvedPortfolioItems.filter((item) => visibleProviderIds.has(item.providerId.toString())),
    );

    return Promise.all(
      photographers.map(async (photographer) => {
        const providerId = photographer._id.toString();
        const publicPhotographer = await this.toPublicPhotographer(
          photographer,
          packagesByProvider.get(providerId) || [],
          portfolioByProvider.get(providerId) || [],
          portfolioBadgeMap,
        );
        return {
          ...publicPhotographer,
          [DISCOVERY_LOCATION_KEY]: {
            coordinates: photographer.address?.geo?.coordinates ?? null,
            serviceRadiusKm:
              photographer.photographySettings?.serviceRadiusKm ?? null,
          },
        };
      }),
    );
  }
  private normalizeDiscoveryQuery(query: PhotographerDiscoveryQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(48, Math.max(1, query.limit ?? 12));
    const minPrice = query.minPrice;
    const maxPrice = query.maxPrice;
    const proximityValues = [
      query.latitude,
      query.longitude,
      query.searchRadiusKm,
    ];
    const usesProximityFilter = proximityValues.some((value) => value !== undefined);
    if (
      usesProximityFilter &&
      proximityValues.some((value) => value === undefined)
    ) {
      throw new BadRequestException(
        'latitude, longitude and searchRadiusKm must be supplied together.',
      );
    }
    return {
      q: this.normalizeText(query.q),      concept: query.concept?.trim().toUpperCase() ?? '',
      packageCategoryId: Types.ObjectId.isValid(query.packageCategoryId ?? '') ? query.packageCategoryId ?? '' : '',
      conceptCategoryIds: this.toObjectIdList(query.conceptCategoryIds),
      styleCategoryIds: this.toObjectIdList(query.styleCategoryIds),
      eventCategoryIds: this.toObjectIdList(query.eventCategoryIds),      location: this.normalizeText(query.location),
      proximity: usesProximityFilter
        ? {
            latitude: query.latitude as number,
            longitude: query.longitude as number,
            searchRadiusKm: query.searchRadiusKm as number,
          }
        : null,
      minPrice,
      maxPrice: maxPrice !== undefined && minPrice !== undefined && maxPrice < minPrice ? minPrice : maxPrice,
      minRating: query.minRating,
      sort: query.sort ?? 'rating_desc',
      page,
      limit,
    };
  }

  private matchesDiscoveryQuery(
    photographer: Record<string, unknown>,
    query: ReturnType<PhotographersService['normalizeDiscoveryQuery']>,
  ): boolean {
    const defaultPackage = photographer.defaultPackage as { price?: number } | null;
    const packages = photographer.packages as Array<{
      price?: number;
      categoryId?: unknown;
      conceptCategoryIds?: unknown[];
      styleCategoryIds?: unknown[];
      eventCategoryIds?: unknown[];
    }>;
    const hasPackageCategoryFilters = Boolean(
      query.packageCategoryId ||
      query.conceptCategoryIds.length ||
      query.styleCategoryIds.length ||
      query.eventCategoryIds.length,
    );
    const matchingPackages = packages.filter((item) =>
      this.matchesPackageCategoryFilters(item, query),
    );
    const packagesForPrice = hasPackageCategoryFilters
      ? matchingPackages
      : packages;
    const rating = photographer.rating as { averageRating?: number } | undefined;
    const address = photographer.address as { city?: string; district?: string } | undefined;
    const businessName = String(photographer.businessName ?? '');
    const portfolioItems = photographer.portfolioItems as Array<{
      badges?: Array<{ code?: string; label?: string }>;
    }>;
    const concepts = portfolioItems.flatMap((item) => item.badges ?? []);
    const discoveryLocation = photographer[DISCOVERY_LOCATION_KEY] as
      | {
          coordinates?: [number, number] | null;
          serviceRadiusKm?: number | null;
        }
      | undefined;

    if (query.proximity) {
      const coordinates = discoveryLocation?.coordinates;
      const serviceRadiusKm = discoveryLocation?.serviceRadiusKm;
      if (
        !coordinates ||
        coordinates.length !== 2 ||
        !Number.isFinite(serviceRadiusKm) ||
        serviceRadiusKm === null
      ) {
        return false;
      }
      const distanceKm = this.distanceKm(
        query.proximity.latitude,
        query.proximity.longitude,
        coordinates[1],
        coordinates[0],
      );
      if (
        distanceKm > query.proximity.searchRadiusKm ||
        distanceKm > (serviceRadiusKm as number)
      ) {
        return false;
      }
    }

    if (query.q) {
      const searchableText = [
        businessName,
        address?.city ?? '',
        address?.district ?? '',
        ...concepts.map((badge) => badge.label ?? ''),
      ]
        .map((value) => this.normalizeText(value))
        .join(' ');
      if (!searchableText.includes(query.q)) return false;
    }
    if (query.location) {
      const location = this.normalizeText(
        `${address?.district ?? ''} ${address?.city ?? ''}`,
      );
      if (!location.includes(query.location)) return false;
    }
    if (
      query.concept &&
      !concepts.some((badge) => badge.code?.toUpperCase() === query.concept)
    ) {
      return false;
    }
    if (hasPackageCategoryFilters && matchingPackages.length === 0) {
      return false;
    }
    if (
      query.minPrice !== undefined &&
      !packagesForPrice.some((item) => (item.price ?? 0) >= query.minPrice!)
    ) {
      return false;
    }
    if (
      query.maxPrice !== undefined &&
      !packagesForPrice.some((item) => (item.price ?? Number.POSITIVE_INFINITY) <= query.maxPrice!)
    ) {
      return false;
    }
    if (
      query.minRating !== undefined &&
      (rating?.averageRating ?? 0) < query.minRating
    ) {
      return false;
    }
    return true;
  }

  private distanceKm(
    latitudeA: number,
    longitudeA: number,
    latitudeB: number,
    longitudeB: number,
  ): number {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latitudeDelta = toRadians(latitudeB - latitudeA);
    const longitudeDelta = toRadians(longitudeB - longitudeA);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(latitudeA)) *
        Math.cos(toRadians(latitudeB)) *
        Math.sin(longitudeDelta / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  }
  private comparePhotographers(
    left: Record<string, unknown>,
    right: Record<string, unknown>,
    sort: PhotographerSortOption,
  ): number {
    const leftRating = (left.rating as { averageRating?: number } | undefined)?.averageRating ?? 0;
    const rightRating = (right.rating as { averageRating?: number } | undefined)?.averageRating ?? 0;
    const leftReviewCount = (left.rating as { totalReviews?: number } | undefined)?.totalReviews ?? 0;
    const rightReviewCount = (right.rating as { totalReviews?: number } | undefined)?.totalReviews ?? 0;
    const leftPrice = (left.defaultPackage as { price?: number } | null)?.price ?? Number.POSITIVE_INFINITY;
    const rightPrice = (right.defaultPackage as { price?: number } | null)?.price ?? Number.POSITIVE_INFINITY;

    const comparison =
      sort === 'reviews_desc'
        ? rightReviewCount - leftReviewCount
        : sort === 'price_asc'
          ? leftPrice - rightPrice
          : sort === 'price_desc'
            ? rightPrice - leftPrice
            : rightRating - leftRating;
    return comparison || String(left.businessName ?? '').localeCompare(String(right.businessName ?? ''), 'vi');
  }


  private toObjectIdList(value?: string): string[] {
    return [...new Set((value ?? '').split(',').map((id) => id.trim()).filter((id) => Types.ObjectId.isValid(id)))];
  }

  private matchesPackageCategoryFilters(
    item: {
      categoryId?: unknown;
      conceptCategoryIds?: unknown[];
      styleCategoryIds?: unknown[];
      eventCategoryIds?: unknown[];
    },
    query: {
      packageCategoryId: string;
      conceptCategoryIds: string[];
      styleCategoryIds: string[];
      eventCategoryIds: string[];
    },
  ): boolean {
    const includesAll = (assigned: unknown[] | undefined, selected: string[]) => {
      if (selected.length === 0) return true;
      const assignedIds = new Set((assigned ?? []).map((id) => String(id)));
      return selected.every((id) => assignedIds.has(id));
    };

    return (
      (!query.packageCategoryId || String(item.categoryId) === query.packageCategoryId) &&
      includesAll(item.conceptCategoryIds, query.conceptCategoryIds) &&
      includesAll(item.styleCategoryIds, query.styleCategoryIds) &&
      includesAll(item.eventCategoryIds, query.eventCategoryIds)
    );
  }
  private normalizeText(value?: string): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('vi')
      .replace(/Ä‘/g, 'd')
      .trim();
  }
  private async toPublicPhotographer(
    photographer: ProviderDocument | Record<string, any>,
    packages: any[],
    portfolioItemsOverride?: Array<{ _id: Types.ObjectId; title: string; description?: string | null; images: string[]; taggingRevision: number }>,
    badgeMapOverride?: Map<string, PublicSmartTagBadge[]>,
  ): Promise<Record<string, unknown>> {
    const portfolioItems = portfolioItemsOverride ?? await this.portfolioItemModel
      .find({
        providerId: photographer._id,
        moderationStatus: ProductModerationStatus.Approved,
      })
      .select('_id title description images taggingRevision createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
    const provider = typeof (photographer as any).toObject === 'function'
      ? (photographer as any).toObject()
      : photographer;
    const {
      address: providerAddress,
      rentalSettings: _rentalSettings,
      photographySettings,
      ...publicProvider
    } = provider;
    const address = providerAddress
      ? {
          ward: providerAddress.ward ?? null,
          district: providerAddress.district ?? null,
          city: providerAddress.city ?? null,
        }
      : null;
    const media = { ...provider.media, images: provider.media?.images || [] };
    const badgeMap = badgeMapOverride ??
      await this.smartTagPublicProjectionService.projectPortfolioBadges(portfolioItems);
    const publicPortfolioItems = portfolioItems.map((item) => ({
      _id: item._id,
      title: item.title,
      description: item.description ?? null,
      images: item.images,
      badges: badgeMap.get(item._id.toString()) || [],
    }));

    return {
      ...publicProvider,
      address,
      serviceRadiusKm: photographySettings?.serviceRadiusKm ?? null,
      media,
      portfolioItems: publicPortfolioItems,
      packages,
      defaultPackage: packages[0] || null,
      activePackageCount: packages.length,
      isBookable: packages.length > 0,
      coverImage:
        packages[0]?.images?.[0] ||
        media.coverUrl ||
        media.images[0] ||
        publicPortfolioItems[0]?.images?.[0] ||
        null,
    };
  }
}
