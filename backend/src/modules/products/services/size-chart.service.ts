import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersRepository } from '../../users/repositories/users.repository';
import { SaveSizeChartDto } from '../dto/size-chart.dto';
import { Product } from '../schemas/product.schema';
import { SizeChart } from '../schemas/size-chart.schema';
import { ProductsRepository } from '../repositories/products.repository';
import { isSizeChartReady, validateSizeChart } from './size-chart.rules';

@Injectable()
export class SizeChartService {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<Product>,
    private readonly users: UsersRepository,
    private readonly repository: ProductsRepository,
  ) {}

  private async owned(userId: string, productId: string) {
    if (!Types.ObjectId.isValid(productId))
      throw new NotFoundException('Product not found');
    const user = await this.users.findUserById(new Types.ObjectId(userId));
    const product = await this.products.findById(productId).exec();
    if (!product) throw new NotFoundException('Product not found');
    if (
      !user?.provider?.providerId ||
      product.providerId.toString() !== user.provider.providerId.toString()
    ) {
      throw new ForbiddenException('You do not own this product');
    }
    return product;
  }

  private versionFilter(version: number) {
    return version === 0
      ? {
          $or: [
            { sizeChartVersion: 0 },
            { sizeChartVersion: { $exists: false } },
          ],
        }
      : { sizeChartVersion: version };
  }

  async getOwned(userId: string, productId: string) {
    const product = await this.owned(userId, productId);
    return {
      version: product.sizeChartVersion ?? 0,
      sizeChart: product.sizeChart ?? null,
      sizes: product.sizes,
      ready: isSizeChartReady(product.sizeChart, product.sizes),
    };
  }

  async saveDraft(
    userId: string,
    productId: string,
    dto: SaveSizeChartDto,
    trustedImageExtraction = false,
  ) {
    const product = await this.owned(userId, productId);
    const currentVersion = product.sizeChartVersion ?? 0;
    if (currentVersion !== dto.expectedVersion)
      throw new ConflictException('Size chart changed; reload before saving');
    validateSizeChart(dto, product.sizes);
    const previous = product.sizeChart;
    // Image URLs are issued by the server upload path. A normal PATCH may edit
    // extracted measurements, but must not attach another product's image or
    // replace the image while retaining unverified OCR rows.
    if (
      dto.source === 'IMAGE' &&
      !trustedImageExtraction &&
      (previous?.source !== 'IMAGE' || previous.imageUrl !== dto.imageUrl)
    )
      throw new ConflictException(
        'Upload the size chart image before editing its measurements',
      );
    const changedSource =
      previous?.source !== dto.source || previous?.imageUrl !== dto.imageUrl;
    const chart: SizeChart = {
      source: dto.source,
      measurementType: dto.measurementType,
      lengthUnit: dto.lengthUnit,
      weightUnit: dto.weightUnit,
      imageUrl: dto.imageUrl,
      // Replacing an image discards old OCR rows, even if a stale client sends them.
      rows: changedSource && previous && dto.source === 'IMAGE' && !trustedImageExtraction
        ? []
        : dto.rows,
      requiredMeasurements: dto.requiredMeasurements,
      fitRules: dto.fitRules ?? [],
      stretchAllowanceCm: dto.stretchAllowanceCm,
      version: currentVersion + 1,
      sourceRevision: (previous?.sourceRevision ?? 0) + (changedSource ? 1 : 0),
      status: 'DRAFT',
    };
    return this.replace(product, currentVersion, chart);
  }

  async confirm(userId: string, productId: string, expectedVersion: number) {
    const product = await this.owned(userId, productId);
    const chart = product.sizeChart;
    if (!chart || expectedVersion !== (product.sizeChartVersion ?? 0))
      throw new ConflictException(
        'Size chart changed or missing; reload before confirming',
      );
    validateSizeChart(chart, product.sizes, true);
    const plain =
      typeof (chart as any).toObject === 'function'
        ? ((chart as any).toObject() as SizeChart)
        : chart;
    return this.replace(product, expectedVersion, {
      ...plain,
      status: 'CONFIRMED',
      version: expectedVersion + 1,
      confirmedBy: new Types.ObjectId(userId),
      confirmedAt: new Date(),
    });
  }

  private async replace(
    product: {
      _id: Types.ObjectId;
      providerId: Types.ObjectId;
      sizes: string[];
    },
    expectedVersion: number,
    chart: SizeChart,
  ) {
    const updated = await this.products
      .findOneAndUpdate(
        {
          _id: product._id,
          providerId: product.providerId,
          sizes: product.sizes,
          ...this.versionFilter(expectedVersion),
        },
        {
          $set: { sizeChart: chart },
          $inc: { sizeChartVersion: 1 },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated)
      throw new ConflictException(
        'Product or size chart changed; reload and try again',
      );
    return {
      version: updated.sizeChartVersion,
      sizeChart: updated.sizeChart,
      sizes: updated.sizes,
      ready: isSizeChartReady(updated.sizeChart, updated.sizes),
    };
  }

  async getPublic(productId: string) {
    if (!Types.ObjectId.isValid(productId))
      throw new NotFoundException('Product not found');
    const product = await this.repository.findPublicById(
      new Types.ObjectId(productId),
    );
    if (!product) throw new NotFoundException('Product not found');
    if (!isSizeChartReady(product.sizeChart, product.sizes))
      return {
        status: 'UNAVAILABLE',
        reason: 'NO_CONFIRMED_SIZE_CHART',
        sizeChart: null,
      };
    const chart = product.sizeChart!;
    return {
      status: 'READY',
      sizeChart: {
        version: chart.version,
        sourceRevision: chart.sourceRevision,
        measurementType: chart.measurementType,
        lengthUnit: chart.lengthUnit,
        weightUnit: chart.weightUnit,
        rows: chart.rows,
        requiredMeasurements: chart.requiredMeasurements,
        fitRules: chart.fitRules,
        stretchAllowanceCm: chart.stretchAllowanceCm,
        imageUrl: chart.imageUrl,
      },
    };
  }
}
