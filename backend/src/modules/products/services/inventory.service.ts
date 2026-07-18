import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { InventoryItem, InventoryItemDocument } from '../schemas/inventory-item.schema';
import { InventoryReservation } from '../schemas/inventory-reservation.schema';
import { Product } from '../schemas/product.schema';
import { Provider } from '../../providers/schemas/provider.schema';
import { UsersRepository } from '../../users/repositories/users.repository';
import { CreateInventoryItemDto } from '../dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from '../dto/update-inventory-item.dto';
import { ConditionStatus, InventoryItemStatus } from '../schemas/inventory-item.schema';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name) private readonly inventoryItemModel: Model<InventoryItemDocument>,
    @InjectModel(InventoryReservation.name) private readonly inventoryReservationModel: Model<InventoryReservation>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    private readonly usersRepository: UsersRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private async getProviderId(userId: string): Promise<string> {
    const user = await this.usersRepository.findUserById(new Types.ObjectId(userId));
    if (!user || !user.provider || !user.provider.providerId) {
      throw new ForbiddenException('Tài khoản không phải là đối tác hoặc không có ID đối tác.');
    }
    return user.provider.providerId.toString();
  }

  private normalizeColor(colorStr?: string | null): string {
    if (!colorStr) return 'WHITE';
    const norm = colorStr.trim().toUpperCase();
    if (norm === 'ĐỎ' || norm === 'RED') return 'RED';
    if (norm === 'TRẮNG' || norm === 'WHITE') return 'WHITE';
    if (norm === 'VÀNG' || norm === 'GOLD') return 'GOLD';
    if (norm === 'ĐEN' || norm === 'BLACK') return 'BLACK';
    return norm;
  }

  async getInventory(
    userId: string,
    productId?: string,
    search?: string,
    status?: string,
    conditionStatus?: string,
    sortBy?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ items: any[]; total: number }> {
    const providerId = await this.getProviderId(userId);

    const filter: any = {};
    const products = await this.productModel.find({ providerId: new Types.ObjectId(providerId) });
    let productIds = products.map((p) => p._id);

    if (productId) {
      if (!Types.ObjectId.isValid(productId)) {
        throw new BadRequestException('Mã sản phẩm không hợp lệ.');
      }
      const prodId = new Types.ObjectId(productId);
      if (!productIds.some((id) => id.toString() === prodId.toString())) {
        throw new NotFoundException('Sản phẩm không tồn tại hoặc không thuộc quyền quản lý của bạn.');
      }
      productIds = [prodId];
    }

    filter.productId = { $in: productIds };

    if (status) {
      filter.status = status;
    }

    if (conditionStatus) {
      filter.conditionStatus = conditionStatus;
    }

    if (search) {
      const escaped = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      const matchingProducts = products.filter((p) => searchRegex.test(p.name));
      const matchingProductIds = matchingProducts.map((p) => p._id);

      filter.$or = [
        { sku: { $regex: searchRegex } },
        { productId: { $in: matchingProductIds } },
      ];
    }

    const total = await this.inventoryItemModel.countDocuments(filter);

    let query = this.inventoryItemModel
      .find(filter)
      .populate('productId', 'name')
      .skip((page - 1) * limit)
      .limit(limit);

    if (sortBy === 'sku_asc') {
      query = query.sort({ sku: 1 });
    } else if (sortBy === 'sku_desc') {
      query = query.sort({ sku: -1 });
    } else if (sortBy === 'oldest') {
      query = query.sort({ createdAt: 1 });
    } else {
      query = query.sort({ createdAt: -1 });
    }

    const items = await query.exec();
    return { items, total };
  }

  async getInventorySummary(userId: string): Promise<any[]> {
    const providerId = await this.getProviderId(userId);
    const products = await this.productModel.find({ providerId: new Types.ObjectId(providerId) });
    const productIds = products.map((p) => p._id);

    const items = await this.inventoryItemModel.find({
      productId: { $in: productIds },
      conditionStatus: { $ne: ConditionStatus.Retired },
    });

    // Grouping by productId, size, color
    const summaryMap = new Map<string, {
      productId: string;
      productName: string;
      size: string;
      color: string;
      material: string | null;
      total: number;
      available: number;
      rented: number;
      maintenance: number;
    }>();

    items.forEach((item) => {
      const prod = products.find((p) => p._id.toString() === item.productId.toString());
      const productName = prod ? prod.name : 'Sản phẩm không tên';
      const materialVal = item.material ? item.material.trim() : null;
      const key = `${item.productId.toString()}_${item.size.toUpperCase()}_${this.normalizeColor(item.color)}_${materialVal || ''}`;

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          productId: item.productId.toString(),
          productName,
          size: item.size.toUpperCase(),
          color: this.normalizeColor(item.color),
          material: materialVal,
          total: 0,
          available: 0,
          rented: 0,
          maintenance: 0,
        });
      }

      const summary = summaryMap.get(key)!;
      summary.total++;
      if (item.status === InventoryItemStatus.Available && item.conditionStatus !== ConditionStatus.Locked) {
        summary.available++;
      } else if (item.status === InventoryItemStatus.Rented) {
        summary.rented++;
      } else if (
        item.status === InventoryItemStatus.Maintenance ||
        item.status === InventoryItemStatus.Cleaning ||
        item.conditionStatus === ConditionStatus.Locked
      ) {
        summary.maintenance++;
      }
    });

    return Array.from(summaryMap.values());
  }

  /**
   * Tồn kho khả dụng cho KHÁCH xem (public): đếm theo size+màu số chiếc còn trống
   * trong khoảng ngày yêu cầu — loại LOCKED/RETIRED và các chiếc đã có reservation
   * (TEMP_RESERVED / CONFIRMED) giao với khoảng ngày đó. Không lộ SKU/ghi chú nội bộ.
   */
  async getPublicAvailability(productId: string, from?: string, to?: string): Promise<{
    productId: string;
    from: string;
    to: string;
    totalAvailable: number;
    variants: Array<{ size: string; color: string; material: string | null; total: number; available: number }>;
  }> {
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Mã sản phẩm không hợp lệ.');
    }
    const parseDay = (value: string | undefined, fallback: Date): Date => {
      if (!value) return new Date(fallback);
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('Ngày không hợp lệ (định dạng YYYY-MM-DD).');
      }
      return parsed;
    };
    const now = new Date();
    const fromDate = parseDay(from, now);
    const toDate = parseDay(to, fromDate);
    const rangeFrom = new Date(fromDate); rangeFrom.setHours(0, 0, 0, 0);
    const rangeTo = new Date(toDate); rangeTo.setHours(23, 59, 59, 999);
    if (rangeTo < rangeFrom) {
      throw new BadRequestException('Khoảng ngày không hợp lệ (ngày kết thúc trước ngày bắt đầu).');
    }

    const prodId = new Types.ObjectId(productId);
    const items = await this.inventoryItemModel.find({
      productId: prodId,
      conditionStatus: { $nin: [ConditionStatus.Locked, ConditionStatus.Retired] },
    });

    const emptyResult = {
      productId,
      from: rangeFrom.toISOString(),
      to: rangeTo.toISOString(),
      totalAvailable: 0,
      variants: [] as Array<{ size: string; color: string; material: string | null; total: number; available: number }>,
    };
    if (items.length === 0) return emptyResult;

    const conflicts = await this.inventoryReservationModel.find({
      inventoryItemId: { $in: items.map((i) => i._id) },
      status: { $in: ['TEMP_RESERVED', 'CONFIRMED'] },
      reservedFrom: { $lte: rangeTo },
      reservedTo: { $gte: rangeFrom },
    } as any).select({ inventoryItemId: 1 });
    const busyIds = new Set(conflicts.map((r) => r.inventoryItemId.toString()));

    const grouped = new Map<string, { size: string; color: string; material: string | null; total: number; available: number }>();
    for (const item of items) {
      const size = item.size.toUpperCase();
      const color = this.normalizeColor(item.color);
      const key = `${size}|${color}`;
      if (!grouped.has(key)) {
        grouped.set(key, { size, color, material: item.material || null, total: 0, available: 0 });
      }
      const group = grouped.get(key)!;
      group.total++;
      if (!busyIds.has(item._id.toString())) group.available++;
    }
    const variants = Array.from(grouped.values());
    return {
      ...emptyResult,
      totalAvailable: variants.reduce((sum, v) => sum + v.available, 0),
      variants,
    };
  }

  async createInventoryItems(userId: string, dto: CreateInventoryItemDto): Promise<InventoryItem[]> {
    const providerId = await this.getProviderId(userId);

    const product = await this.productModel.findById(dto.productId);
    if (!product || product.providerId.toString() !== providerId) {
      throw new NotFoundException('Sản phẩm không tồn tại hoặc không thuộc quyền quản lý của bạn.');
    }

    const sizeVal = dto.size.trim().toUpperCase();
    const colorVal = this.normalizeColor(dto.color);
    const materialVal = dto.material ? dto.material.trim() : null;
    const quantity = dto.quantity && dto.quantity > 0 ? dto.quantity : 1;

    const createdItems: InventoryItem[] = [];

    await this.runInTransaction(async (session) => {
      // Find current max sequence suffix for SKU generation
      const existingItems = await this.inventoryItemModel
        .find({
          productId: product._id,
          size: sizeVal,
          color: colorVal,
        })
        .session(session);

      let maxSeq = 0;
      existingItems.forEach((item) => {
        const parts = item.sku.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      });

      for (let i = 0; i < quantity; i++) {
        const nextSeq = maxSeq + 1 + i;
        const seqStr = nextSeq.toString().padStart(3, '0');
        const sku = `AD-${product._id.toString().slice(-6)}-${sizeVal}-${colorVal}-${seqStr}`.toUpperCase();

        const [newItem] = await this.inventoryItemModel.create([{
          productId: product._id,
          sku,
          size: sizeVal,
          color: colorVal,
          material: materialVal,
          conditionStatus: dto.conditionStatus || ConditionStatus.Good,
          status: dto.status || InventoryItemStatus.Available,
          notes: dto.notes || '',
        }], { session });

        createdItems.push(newItem);
      }

      // Sync Product sizes/colors (and materials when provided)
      const addToSet: Record<string, string> = {
        sizes: sizeVal,
        colors: colorVal,
      };
      if (materialVal) {
        addToSet.materials = materialVal;
      }
      await this.productModel.updateOne(
        { _id: product._id },
        { $addToSet: addToSet },
      ).session(session);
    });

    return createdItems;
  }

  async updateInventoryItem(userId: string, itemId: string, dto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const providerId = await this.getProviderId(userId);

    const item = await this.inventoryItemModel.findById(itemId);
    if (!item) {
      throw new NotFoundException('Không tìm thấy hiện vật tồn kho.');
    }

    if (item.conditionStatus === ConditionStatus.Retired) {
      throw new BadRequestException('Hiện vật đã thanh lý, không thể cập nhật.');
    }

    const product = await this.productModel.findById(item.productId);
    if (!product || product.providerId.toString() !== providerId) {
      throw new ForbiddenException('Bạn không có quyền quản lý hiện vật tồn kho này.');
    }

    if (dto.status === InventoryItemStatus.Rented) {
      throw new BadRequestException('Không được tự động đặt trạng thái RENTED bằng tay.');
    }

    if (dto.status !== undefined) {
      item.status = dto.status;
    }
    if (dto.conditionStatus !== undefined) {
      item.conditionStatus = dto.conditionStatus;
    }
    if (dto.notes !== undefined) {
      item.notes = dto.notes;
    }

    return item.save();
  }

  async deleteInventoryItem(userId: string, itemId: string): Promise<Record<string, unknown>> {
    const providerId = await this.getProviderId(userId);

    const item = await this.inventoryItemModel.findById(itemId);
    if (!item) {
      throw new NotFoundException('Không tìm thấy hiện vật tồn kho.');
    }

    const product = await this.productModel.findById(item.productId);
    if (!product || product.providerId.toString() !== providerId) {
      throw new ForbiddenException('Bạn không có quyền quản lý hiện vật tồn kho này.');
    }

    // Check if there are active bookings/reservations in future
    const activeReservationsCount = await this.inventoryReservationModel.countDocuments({
      inventoryItemId: item._id,
      status: { $in: ['TEMP_RESERVED', 'CONFIRMED'] },
      reservedTo: { $gte: new Date() },
    } as any);

    if (activeReservationsCount > 0) {
      throw new BadRequestException('Áo đang có lịch thuê hoạt động, không thể thanh lý.');
    }

    // Soft delete
    item.conditionStatus = ConditionStatus.Retired;
    await item.save();

    return { message: 'Thanh lý hiện vật thành công.' };
  }

  private async runInTransaction<T>(work: (session: any) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const result = await work(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
