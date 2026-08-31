import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { InventoryItem, InventoryItemDocument } from '../schemas/inventory-item.schema';
import { InventoryReservation, ReservationStatus } from '../schemas/inventory-reservation.schema';
import { Product } from '../schemas/product.schema';
import { Provider } from '../../providers/schemas/provider.schema';
import { UsersRepository } from '../../users/repositories/users.repository';
import { CreateInventoryItemDto } from '../dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from '../dto/update-inventory-item.dto';
import { AdjustVariantQuantityDto, VariantKeyDto } from '../dto/variant-inventory.dto';
import { normalizeColor } from '../utils/color.util';
import { PublicMediaService } from '../../storage/services/public-media.service';
import { ConditionStatus, InventoryItemStatus } from '../schemas/inventory-item.schema';

/** Kết quả một thao tác trên biến thể — luôn nêu rõ đã đụng vào SKU nào để đối tác kiểm chứng được. */
export interface VariantOperationResult {
  message: string;
  quantity: number;
  created: string[];
  retired: string[];
  skipped: Array<{ sku: string; reason: string }>;
  /** So chiec con thieu so voi muc tieu vi khong the thanh ly. 0 = da dat dung yeu cau. */
  shortfall: number;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name) private readonly inventoryItemModel: Model<InventoryItemDocument>,
    @InjectModel(InventoryReservation.name) private readonly inventoryReservationModel: Model<InventoryReservation>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    private readonly usersRepository: UsersRepository,
    private readonly publicMedia: PublicMediaService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private async getProviderId(userId: string): Promise<string> {
    const user = await this.usersRepository.findUserById(new Types.ObjectId(userId));
    if (!user || !user.provider || !user.provider.providerId) {
      throw new ForbiddenException('Tài khoản không phải là đối tác hoặc không có ID đối tác.');
    }
    return user.provider.providerId.toString();
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
      normalizeColor(item.color) === colorVal &&
      this.normalizeMaterial(item.material) === materialVal
    );
  }

  /** Biến thể này có còn được sản phẩm khai báo không (size + màu + chất liệu đều nằm trong sản phẩm). */
  private isDeclaredVariant(
    product: any,
    sizeVal: string,
    colorVal: string,
    materialVal: string | null,
  ): boolean {
    const colors = (product.colors as string[]) || [];
    const sizes = (product.sizes as string[]) || [];
    const materials = (product.materials as string[]) || [];
    const hasColor = colors.some((color) => normalizeColor(color) === colorVal);
    const hasSize = sizes.some((size) => size.trim().toUpperCase() === sizeVal);
    const hasMaterial =
      materialVal === null || materials.some((material) => this.normalizeMaterial(material) === materialVal);
    return hasColor && hasSize && hasMaterial;
  }

  /**
   * Các hiện vật KHÔNG được thanh lý: đang vướng lịch thuê, hoặc đang nằm ngoài tiệm
   * (status RENTED) kể cả khi lịch đã quá hạn mà khách chưa trả.
   */
  private async findBlockedItemIds(
    items: Array<{ _id: Types.ObjectId; status?: InventoryItemStatus }>,
    session?: any,
  ): Promise<Set<string>> {
    if (items.length === 0) return new Set();
    const blocked = new Set(
      items
        .filter((item) => item.status === InventoryItemStatus.Rented)
        .map((item) => item._id.toString()),
    );
    const query = this.inventoryReservationModel
      .find({
        inventoryItemId: { $in: items.map((item) => item._id) },
        status: { $in: ['TEMP_RESERVED', 'CONFIRMED'] },
        reservedTo: { $gte: new Date() },
      } as any)
      .select({ inventoryItemId: 1 });
    if (session) query.session(session);
    const rows = await query.exec();
    rows.forEach((row) => blocked.add(row.inventoryItemId.toString()));
    return blocked;
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
    const sizeVal = dto.size.trim().toUpperCase();
    const colorVal = normalizeColor(dto.color);
    // @IsNotEmpty của class-validator vẫn cho lọt chuỗi toàn khoảng trắng
    if (!sizeVal || !colorVal) {
      throw new BadRequestException('Size và màu của biến thể không được để trống.');
    }
    return {
      product,
      sizeVal,
      colorVal,
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

    // Lấy CẢ hiện vật đã thanh lý: biến thể bị đưa về 0 chiếc vẫn phải hiện một dòng
    // "hết hàng" để đối tác còn đường nhập lại. Biến thể đã bị XOÁ thì sản phẩm không
    // còn khai báo size/màu đó nữa nên sẽ bị loại ở dưới.
    const items = await this.inventoryItemModel.find({
      productId: { $in: productIds },
    });

    const itemIds = items.map((i) => i._id);
    const now = new Date();

    // Lấy các hiện vật đang có lịch đặt/cho thuê hoạt động (TEMP_RESERVED hoặc CONFIRMED, đã/đang tới ngày thuê)
    const activeReservations =
      itemIds.length > 0
        ? await this.inventoryReservationModel
            .find({
              inventoryItemId: { $in: itemIds },
              status: { $in: [ReservationStatus.TempReserved, ReservationStatus.Confirmed] },
              reservedFrom: { $lte: now },
            })
            .select({ inventoryItemId: 1, bookingId: 1, bookingItemId: 1 })
            .lean()
            .exec()
        : [];

    let activeRentedItemIds = new Set<string>();

    if (activeReservations.length > 0) {
      const bookingModel = this.connection.model('Booking');
      const bookingItemModel = this.connection.model('BookingItem');

      const bookingIds = Array.from(new Set(activeReservations.map((r) => r.bookingId?.toString()).filter(Boolean)));
      const bookingItemIds = Array.from(new Set(activeReservations.map((r) => r.bookingItemId?.toString()).filter(Boolean)));

      const inactiveBookings = bookingIds.length > 0
        ? await bookingModel
            .find({
              _id: { $in: bookingIds.map((id) => new Types.ObjectId(id)) },
              status: { $in: ['RETURNED', 'COMPLETED', 'CANCELLED', 'REFUNDED'] },
            })
            .select({ _id: 1 })
            .lean()
            .exec()
        : [];
      const inactiveBookingIds = new Set(inactiveBookings.map((b: any) => b._id.toString()));

      const inactiveBookingItems = bookingItemIds.length > 0
        ? await bookingItemModel
            .find({
              _id: { $in: bookingItemIds.map((id) => new Types.ObjectId(id)) },
              'rentalFulfillment.status': { $in: ['Returned', 'Completed'] },
            })
            .select({ _id: 1 })
            .lean()
            .exec()
        : [];
      const inactiveBookingItemIds = new Set(inactiveBookingItems.map((bi: any) => bi._id.toString()));

      activeReservations.forEach((r) => {
        const isBookingInactive = r.bookingId && inactiveBookingIds.has(r.bookingId.toString());
        const isItemInactive = r.bookingItemId && inactiveBookingItemIds.has(r.bookingItemId.toString());
        if (!isBookingInactive && !isItemInactive) {
          activeRentedItemIds.add(r.inventoryItemId.toString());
        }
      });
    }

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
      const sizeVal = item.size.trim().toUpperCase();
      const colorVal = normalizeColor(item.color);
      const materialVal = this.normalizeMaterial(item.material);
      const isRetired = item.conditionStatus === ConditionStatus.Retired;

      // Hiện vật đã thanh lý chỉ dùng để đánh dấu biến thể "còn đăng bán nhưng hết hàng".
      // Bỏ qua nếu biến thể đã bị xoá hẳn (có dấu variantRemovedAt) hoặc sản phẩm không
      // còn khai báo size/màu/chất liệu đó nữa.
      if (isRetired && (item.variantRemovedAt || !prod || !this.isDeclaredVariant(prod, sizeVal, colorVal, materialVal))) {
        return;
      }

      const key = `${item.productId.toString()}_${sizeVal}_${colorVal}_${materialVal || ''}`;

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          productId: item.productId.toString(),
          productName,
          size: sizeVal,
          color: colorVal,
          material: materialVal,
          total: 0,
          available: 0,
          rented: 0,
          maintenance: 0,
        });
      }

      if (isRetired) return;

      const summary = summaryMap.get(key)!;
      summary.total++;
      if (
        item.status === InventoryItemStatus.Maintenance ||
        item.status === InventoryItemStatus.Cleaning ||
        item.conditionStatus === ConditionStatus.Locked
      ) {
        summary.maintenance++;
      } else if (
        item.status === InventoryItemStatus.Rented ||
        activeRentedItemIds.has(item._id.toString())
      ) {
        summary.rented++;
      } else {
        summary.available++;
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
    const colorVal = normalizeColor(dto.color);
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
      const blocked = await this.findBlockedItemIds([item]);
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
    const blocked = await this.findBlockedItemIds([item]);
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
        return { message: 'Số lượng không thay đổi.', quantity: current, created: [], retired: [], skipped: [], shortfall: 0 };
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
          shortfall: 0,
        };
      }

      const blocked = await this.findBlockedItemIds(live, session);
      const skipped = live
        .filter((item) => blocked.has(item._id.toString()))
        .map((item) => ({ sku: item.sku, reason: 'Đang có lịch thuê' }));
      const candidates = live
        .filter((item) => !blocked.has(item._id.toString()))
        .sort((a, b) => {
          const rankDiff = this.retireRank(a) - this.retireRank(b);
          if (rankDiff !== 0) return rankDiff;
          // ObjectId luon chua thoi diem tao nen dung lam nguon du phong khi thieu createdAt
          const aTime = new Date((a as any).createdAt ?? a._id.getTimestamp()).getTime();
          const bTime = new Date((b as any).createdAt ?? b._id.getTimestamp()).getTime();
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
        // Chỉ báo "bỏ qua" khi thực sự không đạt được mục tiêu — nếu đã giảm đủ số lượng
        // thì việc còn chiếc đang cho thuê là bình thường, không phải lỗi.
        skipped: shortfall > 0 ? skipped : [],
        shortfall,
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

    // Xoá file chỉ được làm SAU khi transaction commit — nếu transaction abort mà file đã bay
    // thì mất ảnh trong khi dữ liệu vẫn còn.
    let imagesToDelete: string[] = [];

    const result = await this.runInTransaction(async (session) => {
      // Đọc lại sản phẩm BÊN TRONG transaction: nếu đọc ngoài rồi $set đè cả mảng thì
      // thay đổi của request chạy song song sẽ bị ghi mất (lost update).
      const fresh = await this.productModel.findById(product._id).session(session);
      if (!fresh) {
        throw new NotFoundException('Sản phẩm không tồn tại hoặc không thuộc quyền quản lý của bạn.');
      }
      const currentColors = ((fresh.colors as string[]) || []).slice();
      const currentSizes = ((fresh.sizes as string[]) || []).slice();
      const currentMaterials = ((fresh.materials as string[]) || []).slice();

      const productItems = await this.inventoryItemModel
        .find({ productId: product._id })
        .session(session);
      const matching = productItems.filter((item) => this.matchesVariant(item, sizeVal, colorVal, materialVal));
      const targetItems = matching.filter((item) => item.conditionStatus !== ConditionStatus.Retired);
      // Các biến thể KHÁC, tính cả hiện vật đã thanh lý: một biến thể đang để "hết hàng"
      // (0 chiếc sống) vẫn đang được đăng bán nên size/màu/chất liệu của nó phải được giữ lại.
      // Hiện vật của biến thể đã bị xoá thì không được giữ hộ nữa.
      const otherItems = productItems.filter(
        (item) => !this.matchesVariant(item, sizeVal, colorVal, materialVal) && !item.variantRemovedAt,
      );

      // Biến thể còn tồn tại khi: còn hiện vật chưa bị đánh dấu xoá, hoặc chưa từng có hiện vật
      // nào nhưng sản phẩm vẫn khai báo (sản phẩm cũ tạo trước khi có quản lý tồn kho).
      const stillExists =
        matching.some((item) => !item.variantRemovedAt) ||
        (matching.length === 0 && this.isDeclaredVariant(fresh, sizeVal, colorVal, materialVal));
      if (!stillExists) {
        throw new NotFoundException(`Biến thể ${label} không tồn tại trên sản phẩm này.`);
      }

      const blocked = await this.findBlockedItemIds(targetItems, session);
      if (blocked.size > 0) {
        const skus = targetItems
          .filter((item) => blocked.has(item._id.toString()))
          .map((item) => item.sku);
        throw new BadRequestException(
          `Không thể xoá biến thể ${label}: ${skus.length} chiếc đang có lịch thuê (${skus.join(', ')}). Hãy chờ khách trả hoặc dùng "Sửa số lượng" để giảm bớt.`,
        );
      }

      // Chỉ tính các biến thể khác mà sản phẩm VẪN đang khai báo — hiện vật của biến thể
      // đã bị xoá trước đó không được phép giữ hộ màu/size nữa.
      const declaredOthers = otherItems.filter((item) =>
        this.isDeclaredVariant(
          fresh,
          item.size.trim().toUpperCase(),
          normalizeColor(item.color),
          this.normalizeMaterial(item.material),
        ),
      );
      const liveColors = new Set(declaredOthers.map((item) => normalizeColor(item.color)));
      const liveSizes = new Set(declaredOthers.map((item) => item.size.trim().toUpperCase()));
      const liveMaterials = new Set(
        declaredOthers
          .map((item) => this.normalizeMaterial(item.material))
          .filter((material): material is string => material !== null),
      );

      const nextColors = liveColors.has(colorVal)
        ? currentColors
        : currentColors.filter((color) => normalizeColor(color) !== colorVal);
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
            { $set: { conditionStatus: ConditionStatus.Retired, variantRemovedAt: new Date() } },
          )
          .session(session);
        if (result.modifiedCount !== targetItems.length) {
          throw new BadRequestException('Dữ liệu tồn kho vừa thay đổi, vui lòng tải lại trang và thử lại.');
        }
      }
      // Hiện vật đã thanh lý trước đó của chính biến thể này cũng phải mang dấu đã xoá,
      // nếu không nó sẽ tiếp tục hiện dòng "hết hàng" sau khi biến thể đã bị gỡ.
      const alreadyRetired = matching.filter(
        (item) => item.conditionStatus === ConditionStatus.Retired && !item.variantRemovedAt,
      );
      if (alreadyRetired.length > 0) {
        await this.inventoryItemModel
          .updateMany(
            { _id: { $in: alreadyRetired.map((item) => item._id) } },
            { $set: { variantRemovedAt: new Date() } },
          )
          .session(session);
      }

      // Màu bị gỡ hẳn khỏi sản phẩm thì ảnh riêng của nó cũng phải đi theo, nếu không
      // ảnh nằm lại vĩnh viễn: cron dọn rác thấy URL còn trong document nên không bao giờ thu hồi.
      const colorRemoved = !liveColors.has(colorVal);
      const currentColorImages = ((fresh.colorImages as { color: string; images: string[] }[]) || []).map(
        (entry) => ({ color: entry.color, images: [...(entry.images || [])] }),
      );
      const nextColorImages = colorRemoved
        ? currentColorImages.filter((entry) => normalizeColor(entry.color) !== colorVal)
        : currentColorImages;

      const orphanUrls = colorRemoved
        ? currentColorImages
            .filter((entry) => normalizeColor(entry.color) === colorVal)
            .flatMap((entry) => entry.images)
        : [];
      // Chỉ xoá ảnh không còn ai dùng: màu khác có thể đang dùng chung tấm ảnh đó.
      const stillUsed = new Set(nextColorImages.flatMap((entry) => entry.images));
      const droppedUrls = orphanUrls.filter((url) => !stillUsed.has(url));
      const nextImages = ((fresh.images as string[]) || []).filter((url) => !droppedUrls.includes(url));
      imagesToDelete = droppedUrls;

      await this.productModel
        .updateOne(
          { _id: product._id },
          {
            $set: {
              colors: nextColors,
              sizes: nextSizes,
              materials: nextMaterials,
              colorImages: nextColorImages,
              images: nextImages,
            },
          },
        )
        .session(session);

      return {
        message: `Đã xoá biến thể ${label} khỏi sản phẩm.`,
        quantity: 0,
        created: [],
        retired: targetItems.map((item) => item.sku),
        skipped: [],
        shortfall: 0,
      };
    });

    if (imagesToDelete.length > 0) {
      await Promise.all(
        imagesToDelete.map((url) => this.publicMedia.deleteByUrl(url).catch(() => undefined)),
      );
    }
    return result;
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
