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
import { AdjustVariantQuantityDto, VariantKeyDto } from '../dto/variant-inventory.dto';
import { ConditionStatus, InventoryItemStatus } from '../schemas/inventory-item.schema';

/** Kết quả một thao tác trên biến thể — luôn nêu rõ đã đụng vào SKU nào để đối tác kiểm chứng được. */
export interface VariantOperationResult {
  message: string;
  quantity: number;
  created: string[];
  retired: string[];
  skipped: Array<{ sku: string; reason: string }>;
}

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

  /** Chất liệu rỗng/khoảng trắng và null được coi là cùng một biến thể. */
  private normalizeMaterial(value?: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private matchesVariant(
    item: InventoryItemDocument,
    sizeVal: string,
    colorVal: string,
    materialVal: string | null,
  ): boolean {
    return (
      item.size.trim().toUpperCase() === sizeVal &&
      this.normalizeColor(item.color) === colorVal &&
      this.normalizeMaterial(item.material) === materialVal
    );
  }

  /**
   * Các hiện vật đang vướng lịch thuê nên không được thanh lý. Điều kiện giữ y hệt
   * `deleteInventoryItem` vốn có để không đổi hành vi của nút "Thanh lý" hiện tại.
   */
  private async findBlockedItemIds(itemIds: Types.ObjectId[], session?: any): Promise<Set<string>> {
    if (itemIds.length === 0) return new Set();
    const query = this.inventoryReservationModel
      .find({
        inventoryItemId: { $in: itemIds },
        status: { $in: ['TEMP_RESERVED', 'CONFIRMED'] },
        reservedTo: { $gte: new Date() },
      } as any)
      .select({ inventoryItemId: 1 });
    if (session) query.session(session);
    const rows = await query.exec();
    return new Set(rows.map((row) => row.inventoryItemId.toString()));
  }

  /** Thứ tự ưu tiên khi phải thanh lý bớt: hàng hỏng/khoá trước, rồi hàng đang giặt/bảo trì, cuối cùng mới tới hàng lành. */
  private retireRank(item: InventoryItemDocument): number {
    if (
      item.conditionStatus === ConditionStatus.MinorDamage ||
      item.conditionStatus === ConditionStatus.Locked
    ) {
      return 0;
    }
    if (
      item.status === InventoryItemStatus.Maintenance ||
      item.status === InventoryItemStatus.Cleaning
    ) {
      return 1;
    }
    return 2;
  }

  /**
   * Sinh SKU nối tiếp rồi tạo `count` hiện vật cho một biến thể.
   * LƯU Ý: cố ý KHÔNG lọc hiện vật đã RETIRED khi dò số thứ tự lớn nhất — hàng đã thanh lý
   * vẫn nằm trong collection và vẫn giữ chỗ trong dãy số; bỏ chúng ra sẽ sinh lại SKU trùng
   * và vi phạm unique index của `sku`.
   */
  private async createItemsInSession(
    session: any,
    productId: Types.ObjectId,
    sizeVal: string,
    colorVal: string,
    materialVal: string | null,
    count: number,
    conditionStatus?: ConditionStatus,
    status?: InventoryItemStatus,
    notes?: string,
  ): Promise<InventoryItemDocument[]> {
    const existingItems = await this.inventoryItemModel
      .find({ productId, size: sizeVal, color: colorVal })
      .session(session);

    let maxSeq = 0;
    existingItems.forEach((item) => {
      const parts = item.sku.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    });

    const created: InventoryItemDocument[] = [];
    for (let i = 0; i < count; i++) {
      const seqStr = (maxSeq + 1 + i).toString().padStart(3, '0');
      const sku = `AD-${productId.toString().slice(-6)}-${sizeVal}-${colorVal}-${seqStr}`.toUpperCase();

      const [newItem] = await this.inventoryItemModel.create([{
        productId,
        sku,
        size: sizeVal,
        color: colorVal,
        material: materialVal,
        conditionStatus: conditionStatus || ConditionStatus.Good,
        status: status || InventoryItemStatus.Available,
        notes: notes || '',
      }], { session });

      created.push(newItem);
    }
    return created;
  }

  /** Bổ sung size/màu/chất liệu vào sản phẩm khi nhập hàng (chỉ thêm, không bao giờ bớt ở đây). */
  private async syncProductAttributes(
    session: any,
    productId: Types.ObjectId,
    sizeVal: string,
    colorVal: string,
    materialVal: string | null,
  ): Promise<void> {
    const addToSet: Record<string, string> = { sizes: sizeVal, colors: colorVal };
    if (materialVal) {
      addToSet.materials = materialVal;
    }
    await this.productModel.updateOne({ _id: productId }, { $addToSet: addToSet }).session(session);
  }

  /** Kiểm quyền sở hữu sản phẩm rồi chuẩn hoá khoá biến thể. */
  private async loadVariantContext(userId: string, dto: VariantKeyDto) {
    const providerId = await this.getProviderId(userId);
    const product = await this.productModel.findById(dto.productId);
    if (!product || product.providerId.toString() !== providerId) {
      throw new NotFoundException('Sản phẩm không tồn tại hoặc không thuộc quyền quản lý của bạn.');
    }
    return {
      product,
      sizeVal: dto.size.trim().toUpperCase(),
      colorVal: this.normalizeColor(dto.color),
      materialVal: this.normalizeMaterial(dto.material),
    };
  }

  private variantLabel(sizeVal: string, colorVal: string, materialVal: string | null): string {
    return materialVal ? `${sizeVal} / ${colorVal} / ${materialVal}` : `${sizeVal} / ${colorVal}`;
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
      const newItems = await this.createItemsInSession(
        session,
        product._id,
        sizeVal,
        colorVal,
        materialVal,
        quantity,
        dto.conditionStatus,
        dto.status,
        dto.notes,
      );
      createdItems.push(...newItems);

      // Sync Product sizes/colors (and materials when provided)
      await this.syncProductAttributes(session, product._id, sizeVal, colorVal, materialVal);
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

    // Thanh lý qua đường cập nhật cũng phải qua cùng một hàng rào như nút "Thanh lý",
    // nếu không đây sẽ là cửa hậu bỏ qua kiểm tra lịch thuê.
    if (dto.conditionStatus === ConditionStatus.Retired) {
      const blocked = await this.findBlockedItemIds([item._id]);
      if (blocked.size > 0) {
        throw new BadRequestException('Áo đang có lịch thuê hoạt động, không thể thanh lý.');
      }
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
    const blocked = await this.findBlockedItemIds([item._id]);
    if (blocked.size > 0) {
      throw new BadRequestException('Áo đang có lịch thuê hoạt động, không thể thanh lý.');
    }

    // Soft delete
    item.conditionStatus = ConditionStatus.Retired;
    await item.save();

    return { message: 'Thanh lý hiện vật thành công.' };
  }

  /**
   * Đặt lại SỐ LƯỢNG của một biến thể.
   * Lớn hơn hiện tại thì nhập thêm, nhỏ hơn thì thanh lý bớt, bằng 0 nghĩa là hết hàng.
   * Cố ý KHÔNG đụng vào product.colors/sizes khi giảm — biến thể vẫn tồn tại và khách vẫn
   * thấy nó ở trạng thái hết hàng, để sau này nhập thêm là bán lại được ngay.
   */
  async adjustVariantQuantity(userId: string, dto: AdjustVariantQuantityDto): Promise<VariantOperationResult> {
    const { product, sizeVal, colorVal, materialVal } = await this.loadVariantContext(userId, dto);
    const target = dto.targetQuantity;
    const label = this.variantLabel(sizeVal, colorVal, materialVal);

    return this.runInTransaction(async (session) => {
      const productItems = await this.inventoryItemModel
        .find({ productId: product._id })
        .session(session);
      const live = productItems.filter(
        (item) =>
          item.conditionStatus !== ConditionStatus.Retired &&
          this.matchesVariant(item, sizeVal, colorVal, materialVal),
      );
      const current = live.length;

      if (target === current) {
        return { message: 'Số lượng không thay đổi.', quantity: current, created: [], retired: [], skipped: [] };
      }

      if (target > current) {
        const created = await this.createItemsInSession(
          session,
          product._id,
          sizeVal,
          colorVal,
          materialVal,
          target - current,
        );
        await this.syncProductAttributes(session, product._id, sizeVal, colorVal, materialVal);
        return {
          message: `Đã nhập thêm ${created.length} chiếc cho biến thể ${label}.`,
          quantity: current + created.length,
          created: created.map((item) => item.sku),
          retired: [],
          skipped: [],
        };
      }

      const blocked = await this.findBlockedItemIds(live.map((item) => item._id), session);
      const skipped = live
        .filter((item) => blocked.has(item._id.toString()))
        .map((item) => ({ sku: item.sku, reason: 'Đang có lịch thuê' }));
      const candidates = live
        .filter((item) => !blocked.has(item._id.toString()))
        .sort((a, b) => {
          const rankDiff = this.retireRank(a) - this.retireRank(b);
          if (rankDiff !== 0) return rankDiff;
          const aTime = new Date((a as any).createdAt ?? 0).getTime();
          const bTime = new Date((b as any).createdAt ?? 0).getTime();
          return bTime - aTime;
        });

      const chosen = candidates.slice(0, current - target);
      if (chosen.length > 0) {
        const result = await this.inventoryItemModel
          .updateMany(
            { _id: { $in: chosen.map((item) => item._id) }, conditionStatus: { $ne: ConditionStatus.Retired } },
            { $set: { conditionStatus: ConditionStatus.Retired } },
          )
          .session(session);
        if (result.modifiedCount !== chosen.length) {
          throw new BadRequestException('Dữ liệu tồn kho vừa thay đổi, vui lòng tải lại trang và thử lại.');
        }
      }

      const newQuantity = current - chosen.length;
      const shortfall = current - target - chosen.length;
      return {
        message:
          shortfall > 0
            ? `Đã thanh lý ${chosen.length} chiếc. Còn ${shortfall} chiếc không thể thanh lý vì đang có lịch thuê.`
            : `Đã thanh lý ${chosen.length} chiếc của biến thể ${label}.`,
        quantity: newQuantity,
        created: [],
        retired: chosen.map((item) => item.sku),
        skipped,
      };
    });
  }

  /**
   * XOÁ HẲN một biến thể: thanh lý toàn bộ hiện vật rồi gỡ size/màu/chất liệu khỏi sản phẩm
   * để khách không còn nhìn thấy lựa chọn đó nữa.
   * Chỉ gỡ đúng giá trị được yêu cầu và chỉ khi không còn hiện vật sống nào dùng tới nó —
   * cố ý không tính lại toàn bộ mảng từ tồn kho, tránh xoá oan dữ liệu của sản phẩm cũ.
   */
  async removeVariant(userId: string, dto: VariantKeyDto): Promise<VariantOperationResult> {
    const { product, sizeVal, colorVal, materialVal } = await this.loadVariantContext(userId, dto);
    const label = this.variantLabel(sizeVal, colorVal, materialVal);

    const currentColors = ((product.colors as string[]) || []).slice();
    const currentSizes = ((product.sizes as string[]) || []).slice();
    const currentMaterials = ((product.materials as string[]) || []).slice();

    return this.runInTransaction(async (session) => {
      const productItems = await this.inventoryItemModel
        .find({ productId: product._id })
        .session(session);
      const liveItems = productItems.filter((item) => item.conditionStatus !== ConditionStatus.Retired);
      const targetItems = liveItems.filter((item) => this.matchesVariant(item, sizeVal, colorVal, materialVal));
      const otherItems = liveItems.filter((item) => !this.matchesVariant(item, sizeVal, colorVal, materialVal));

      const declaresColor = currentColors.some((color) => this.normalizeColor(color) === colorVal);
      if (targetItems.length === 0 && !declaresColor) {
        throw new NotFoundException(`Biến thể ${label} không tồn tại trên sản phẩm này.`);
      }

      const blocked = await this.findBlockedItemIds(targetItems.map((item) => item._id), session);
      if (blocked.size > 0) {
        const skus = targetItems
          .filter((item) => blocked.has(item._id.toString()))
          .map((item) => item.sku);
        throw new BadRequestException(
          `Không thể xoá biến thể ${label}: ${skus.length} chiếc đang có lịch thuê (${skus.join(', ')}). Hãy chờ khách trả hoặc dùng "Sửa số lượng" để giảm bớt.`,
        );
      }

      const liveColors = new Set(otherItems.map((item) => this.normalizeColor(item.color)));
      const liveSizes = new Set(otherItems.map((item) => item.size.trim().toUpperCase()));
      const liveMaterials = new Set(
        otherItems
          .map((item) => this.normalizeMaterial(item.material))
          .filter((material): material is string => material !== null),
      );

      const nextColors = liveColors.has(colorVal)
        ? currentColors
        : currentColors.filter((color) => this.normalizeColor(color) !== colorVal);
      const nextSizes = liveSizes.has(sizeVal)
        ? currentSizes
        : currentSizes.filter((size) => size.trim().toUpperCase() !== sizeVal);
      const nextMaterials =
        materialVal === null || liveMaterials.has(materialVal)
          ? currentMaterials
          : currentMaterials.filter((material) => this.normalizeMaterial(material) !== materialVal);

      if (nextColors.length === 0 || nextSizes.length === 0) {
        throw new BadRequestException(
          'Sản phẩm phải còn ít nhất một biến thể. Hãy gỡ đăng sản phẩm nếu muốn ngừng cho thuê.',
        );
      }

      if (targetItems.length > 0) {
        const result = await this.inventoryItemModel
          .updateMany(
            { _id: { $in: targetItems.map((item) => item._id) }, conditionStatus: { $ne: ConditionStatus.Retired } },
            { $set: { conditionStatus: ConditionStatus.Retired } },
          )
          .session(session);
        if (result.modifiedCount !== targetItems.length) {
          throw new BadRequestException('Dữ liệu tồn kho vừa thay đổi, vui lòng tải lại trang và thử lại.');
        }
      }

      await this.productModel
        .updateOne(
          { _id: product._id },
          { $set: { colors: nextColors, sizes: nextSizes, materials: nextMaterials } },
        )
        .session(session);

      return {
        message: `Đã xoá biến thể ${label} khỏi sản phẩm.`,
        quantity: 0,
        created: [],
        retired: targetItems.map((item) => item.sku),
        skipped: [],
      };
    });
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
