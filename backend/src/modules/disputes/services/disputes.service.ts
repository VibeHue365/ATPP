/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  IncidentReport,
  IncidentStatus,
} from '../schemas/incident-report.schema';
import { PrivateEvidenceUpload } from '../schemas/private-evidence-upload.schema';
import {
  Dispute,
  DisputeStatus,
  DisputeDecision,
  FaultParty,
} from '../schemas/dispute.schema';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import { BookingItem } from '../../bookings/schemas/booking-item.schema';
import {
  InventoryItem,
  InventoryItemStatus,
} from '../../products/schemas/inventory-item.schema';
import { PaymentsService } from '../../payments/services/payments.service';
import { RefundWorkflowService } from '../../payments/services/refund-workflow.service';
import { RefundType } from '../../payments/schemas/refund-request.schema';
import { MockBankingService } from '../../payments/services/mock-banking.service';
import { EscrowStatus } from '../../payments/schemas/booking-escrow.schema';
import { SettlementsService } from '../../settlements/services/settlements.service';
import { PolicyResolverService } from '../../system-policies/services/policy-resolver.service';
import { PrivateStorageService } from '../../storage/services/private-storage.service';

@Injectable()
export class DisputesService {
  constructor(
    @InjectModel(IncidentReport.name)
    private readonly incidentModel: Model<IncidentReport>,
    @InjectModel(Dispute.name)
    private readonly disputeModel: Model<Dispute>,
    @InjectModel(PrivateEvidenceUpload.name)
    private readonly privateEvidenceUploadModel: Model<PrivateEvidenceUpload>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItem>,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => RefundWorkflowService))
    private readonly refundWorkflowService: RefundWorkflowService,
    private readonly bankingService: MockBankingService,
    private readonly settlementsService: SettlementsService,
    private readonly policyResolverService: PolicyResolverService,
    private readonly privateStorage: PrivateStorageService,
  ) {}

  async createIncidentReport(
    providerUserId: string,
    dto: {
      bookingId: string;
      bookingItemId: string;
      description: string;
      evidencePhotos: string[];
      requestedAmount: number;
      actionType: 'MAINTENANCE' | 'CLEANING';
    },
  ): Promise<IncidentReport> {
    const booking = await this.bookingModel.findById(dto.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const bookingItem = await this.bookingItemModel.findById(dto.bookingItemId);
    if (!bookingItem) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong đơn hàng');
    }
    if (bookingItem.bookingId.toString() !== booking._id.toString()) {
      throw new BadRequestException('Sản phẩm không thuộc đơn đặt lịch này');
    }

    // Kiểm tra xem đã có incident report cho sản phẩm này của đơn hàng chưa
    const existing = await this.incidentModel.findOne({
      bookingId: booking._id,
      bookingItemId: bookingItem._id,
    });
    if (existing) {
      throw new ConflictException(
        'Sự cố của sản phẩm này đã được báo cáo trước đó',
      );
    }

    if (dto.requestedAmount > booking.pricingSummary.depositTotal) {
      throw new BadRequestException(
        `Số tiền yêu cầu đền bù (${dto.requestedAmount.toLocaleString()}đ) không được vượt quá số tiền cọc giữ đồ (${booking.pricingSummary.depositTotal.toLocaleString()}đ)`,
      );
    }

    // Tìm Provider ID của User
    if (!Types.ObjectId.isValid(providerUserId)) {
      throw new ForbiddenException('Thông tin tài khoản provider không hợp lệ');
    }
    const provider = await this.bookingModel.db
      .model('Provider')
      .findOne({ userId: new Types.ObjectId(providerUserId) });
    if (!provider) {
      throw new NotFoundException('Không tìm thấy thông tin đối tác của bạn');
    }
    if (bookingItem.providerId.toString() !== provider._id.toString()) {
      throw new ForbiddenException(
        'Bạn không có quyền báo cáo sản phẩm của provider khác',
      );
    }

    this.validateEvidenceReferences(dto.evidencePhotos);

    await this.assertEvidenceReferencesOwnedBy(
      providerUserId,
      dto.evidencePhotos,
    );

    const policy = await this.policyResolverService.getDisputePolicy();
    if (policy.requireEvidence && dto.evidencePhotos.length === 0) {
      throw new BadRequestException('Vui lòng cung cấp ít nhất một bằng chứng');
    }

    const allowedStatuses = [
      BookingStatus.PickedUp,
      BookingStatus.ReturnPending,
      BookingStatus.Returned,
      BookingStatus.Completed,
    ];
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        'Trạng thái đơn hàng chưa cho phép báo cáo sự cố',
      );
    }
    if (booking.status === BookingStatus.Completed) {
      const completedEntry = [...booking.statusTimeline]
        .reverse()
        .find((entry) => entry.status === BookingStatus.Completed);
      if (
        completedEntry &&
        Date.now() - new Date(completedEntry.changedAt).getTime() >
          policy.allowDisputeAfterCompletedHours * 60 * 60 * 1000
      ) {
        throw new BadRequestException('Đã quá thời hạn mở khiếu nại');
      }
    }

    // Tạo báo cáo sự cố
    let incident: IncidentReport;
    try {
      incident = await this.incidentModel.create({
        bookingId: booking._id,
        bookingItemId: bookingItem._id,
        productId: bookingItem.productId as any,
        reportedBy: provider._id,
        description: dto.description,
        actionType: dto.actionType,
        evidencePhotos: dto.evidencePhotos,
        requestedAmount: dto.requestedAmount,
        status: IncidentStatus.PendingCustomer,
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException(
          'Sự cố của sản phẩm này đã được báo cáo trước đó',
        );
      }
      throw error;
    }

    // Cập nhật trạng thái áo dài (InventoryItem) tương ứng
    await this.attachPrivateEvidenceUploads(
      providerUserId,
      dto.evidencePhotos,
      (incident as any)._id,
    );

    if (bookingItem.inventoryItemId) {
      const inventoryStatus =
        dto.actionType === 'CLEANING'
          ? InventoryItemStatus.Cleaning
          : InventoryItemStatus.Maintenance;

      await this.inventoryModel.findByIdAndUpdate(bookingItem.inventoryItemId, {
        $set: { status: inventoryStatus },
      });
    }

    // Cập nhật trạng thái booking tạm thời để khách hàng phản hồi
    booking.status = BookingStatus.ReturnPending;
    booking.statusTimeline.push({
      status: BookingStatus.ReturnPending,
      changedAt: new Date(),
      note: `Shop ${provider.businessName} báo cáo sự cố hỏng đồ và yêu cầu đền bù ${dto.requestedAmount.toLocaleString()}đ`,
    });
    await booking.save();

    return incident;
  }

  async getIncidentByBooking(
    bookingId: string,
    userId: string,
    roles: string[],
  ): Promise<IncidentReport | null> {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException('Mã đơn đặt lịch không hợp lệ');
    }

    const incident = await this.incidentModel
      .findOne({ bookingId: new Types.ObjectId(bookingId) })
      .populate('bookingItemId')
      .populate('productId')
      .exec();

    if (!incident) {
      return null;
    }

    if (roles.some((role) => role.toUpperCase() === 'ADMIN')) {
      return incident;
    }

    const booking = await this.bookingModel.findById(incident.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }
    if (this.getCustomerIdStr(booking) === userId) {
      return incident;
    }

    if (roles.some((role) => role.toUpperCase() === 'PROVIDER')) {
      if (!Types.ObjectId.isValid(userId)) {
        throw new ForbiddenException(
          'Bạn không có quyền xem báo cáo sự cố này',
        );
      }
      const provider = await this.bookingModel.db
        .model('Provider')
        .findOne({ userId: new Types.ObjectId(userId) });
      if (
        provider &&
        incident.reportedBy.toString() === provider._id.toString()
      ) {
        return incident;
      }
    }

    throw new ForbiddenException('Bạn không có quyền xem báo cáo sự cố này');
  }

  async registerEvidenceUploads(
    uploaderId: string,
    references: string[],
  ): Promise<void> {
    if (!Types.ObjectId.isValid(uploaderId)) {
      throw new ForbiddenException('Tài khoản provider không hợp lệ');
    }
    const expiresAt = new Date(
      Date.now() + this.evidenceUploadTtlHours() * 60 * 60 * 1000,
    );
    await this.privateEvidenceUploadModel.insertMany(
      references.map((reference) => ({
        reference,
        uploaderId: new Types.ObjectId(uploaderId),
        expiresAt,
      })),
      { ordered: true },
    );
  }
  async viewEvidence(
    userId: string,
    roles: string[],
    reference: string,
  ): Promise<{
    file: import('stream').Readable;
    mimeType: string;
    fileName: string;
  }> {
    console.log('[DEBUG] viewEvidence request:', { userId, roles, reference });
    const { bucket, storageKey } =
      this.parsePrivateEvidenceReference(reference);
    const incident = await this.incidentModel.findOne({
      evidencePhotos: reference,
    });
    console.log('[DEBUG] viewEvidence incident query:', {
      incidentExists: !!incident,
      incidentId: incident?._id,
    });

    if (!incident) {
      if (
        !Types.ObjectId.isValid(userId) ||
        !roles?.some((role) => role.toUpperCase() === 'PROVIDER')
      ) {
        console.log(
          '[DEBUG] viewEvidence failed because no incident and user is not provider:',
          { userId, isValidId: Types.ObjectId.isValid(userId) },
        );
        throw new NotFoundException('Không tìm thấy ảnh bằng chứng');
      }
      const upload = await this.privateEvidenceUploadModel.findOne({
        reference,
        uploaderId: new Types.ObjectId(userId),
        incidentId: null,
        expiresAt: { $gt: new Date() },
      });
      if (!upload) {
        console.log(
          '[DEBUG] viewEvidence failed because private upload not found or expired:',
          { reference, userId },
        );
        throw new NotFoundException('Không tìm thấy ảnh bằng chứng');
      }
      return this.readEvidenceFile(bucket, storageKey);
    }

    if (!roles?.some((role) => role.toUpperCase() === 'ADMIN')) {
      const booking = await this.bookingModel.findById(incident.bookingId);
      if (!booking) {
        console.log(
          '[DEBUG] viewEvidence failed because booking not found:',
          incident.bookingId,
        );
        throw new NotFoundException('Không tìm thấy đơn đặt lịch');
      }
      const isCustomer = this.getCustomerIdStr(booking) === userId;
      let isReportingProvider = false;
      if (
        !isCustomer &&
        roles?.some((role) => role.toUpperCase() === 'PROVIDER') &&
        Types.ObjectId.isValid(userId)
      ) {
        const provider = await this.bookingModel.db
          .model('Provider')
          .findOne({ userId: new Types.ObjectId(userId) });
        isReportingProvider = Boolean(
          provider &&
          incident.reportedBy.toString() === provider._id.toString(),
        );
      }
      console.log('[DEBUG] viewEvidence permission evaluation:', {
        customerId: this.getCustomerIdStr(booking),
        userId,
        isCustomer,
        isReportingProvider,
      });
      if (!isCustomer && !isReportingProvider) {
        throw new ForbiddenException(
          'Bạn không có quyền xem ảnh bằng chứng này',
        );
      }
    }

    return this.readEvidenceFile(bucket, storageKey);
  }

  private async assertEvidenceReferencesOwnedBy(
    uploaderId: string,
    references: string[],
  ): Promise<void> {
    const privateReferences = (references ?? []).filter((reference) =>
      reference.startsWith('private://'),
    );
    if (privateReferences.length === 0) return;
    if (!Types.ObjectId.isValid(uploaderId)) {
      throw new ForbiddenException('Tài khoản provider không hợp lệ');
    }
    const count = await this.privateEvidenceUploadModel.countDocuments({
      reference: { $in: privateReferences },
      uploaderId: new Types.ObjectId(uploaderId),
      incidentId: null,
      expiresAt: { $gt: new Date() },
    });
    if (count !== privateReferences.length) {
      throw new BadRequestException(
        'Một hoặc nhiều ảnh bằng chứng đã hết hạn hoặc không thuộc tài khoản của bạn',
      );
    }
  }

  private async attachPrivateEvidenceUploads(
    uploaderId: string,
    references: string[],
    incidentId: Types.ObjectId,
  ): Promise<void> {
    const privateReferences = (references ?? []).filter((reference) =>
      reference.startsWith('private://'),
    );
    if (privateReferences.length === 0) return;
    const result = await this.privateEvidenceUploadModel.updateMany(
      {
        reference: { $in: privateReferences },
        uploaderId: new Types.ObjectId(uploaderId),
        incidentId: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { incidentId, expiresAt: null } },
    );
    if (result.modifiedCount !== privateReferences.length) {
      throw new ConflictException(
        'Ảnh bằng chứng vừa được sử dụng hoặc đã hết hạn, vui lòng tải lại',
      );
    }
  }

  private async readEvidenceFile(
    bucket: string,
    storageKey: string,
  ): Promise<{
    file: import('stream').Readable;
    mimeType: string;
    fileName: string;
  }> {
    return {
      file: await this.privateStorage.readPrivateFile(bucket, storageKey),
      mimeType: this.mimeTypeForEvidence(storageKey),
      fileName: storageKey.split('/').pop() || 'evidence',
    };
  }
  private evidenceUploadTtlHours(): number {
    const value = Number(process.env.PRIVATE_EVIDENCE_UPLOAD_TTL_HOURS ?? 24);
    return Number.isFinite(value) && value >= 1 ? value : 24;
  }
  private validateEvidenceReferences(references: string[]): void {
    for (const reference of references ?? []) {
      if (reference.startsWith('private://')) {
        this.parsePrivateEvidenceReference(reference);
        continue;
      }
      if (!reference.startsWith('/uploads/dispute-evidence/')) {
        throw new BadRequestException('Tham chiếu ảnh bằng chứng không hợp lệ');
      }
    }
  }

  private parsePrivateEvidenceReference(reference: string): {
    bucket: string;
    storageKey: string;
  } {
    const prefix = 'private://dispute-evidence-private/';
    if (!reference?.startsWith(prefix)) {
      throw new BadRequestException(
        'Tham chiếu ảnh bằng chứng private không hợp lệ',
      );
    }
    const storageKey = reference.slice(prefix.length);
    if (
      !storageKey.startsWith('dispute-evidence/') ||
      storageKey.includes('..')
    ) {
      throw new BadRequestException('Khóa ảnh bằng chứng không hợp lệ');
    }
    return { bucket: 'dispute-evidence-private', storageKey };
  }

  private mimeTypeForEvidence(storageKey: string): string {
    const extension = storageKey.split('.').pop()?.toLowerCase();
    if (extension === 'png') return 'image/png';
    if (extension === 'webp') return 'image/webp';
    return 'image/jpeg';
  }
  async customerAgreeIncident(
    incidentId: string,
    customerUserId: string,
  ): Promise<any> {
    const incident = await this.incidentModel.findById(incidentId);
    if (!incident) {
      throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    }

    if (incident.status !== IncidentStatus.PendingCustomer) {
      throw new ConflictException(
        'Sự cố này đã được xử lý hoặc đang tranh chấp',
      );
    }

    const booking = await this.bookingModel.findById(incident.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }

    if (this.getCustomerIdStr(booking) !== customerUserId) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    // 1. Cập nhật trạng thái Escrow sang DisputedResolved một cách atomic trước để tránh double click/double split
    const escrow = await this.bookingModel.db
      .model('BookingEscrow')
      .findOneAndUpdate(
        { bookingId: booking._id, status: EscrowStatus.Held },
        { $set: { status: EscrowStatus.DisputedResolved } },
        { new: false },
      );

    if (!escrow) {
      throw new ConflictException(
        'Đơn hàng đã được đối soát hoặc không tìm thấy thông tin ký quỹ hợp lệ',
      );
    }

    let transferResult = null;
    let refundResult = null;

    try {
      // 2. Chuyển khoản trực tiếp số tiền đền bù sang tài khoản ngân hàng của Shop
      const provider = await this.bookingModel.db
        .model('Provider')
        .findById(incident.reportedBy);
      if (!provider) {
        throw new NotFoundException('Không tìm thấy thông tin shop');
      }

      let bankName = 'VietinBank';
      let accountNumber = '1029384756';
      let accountHolder = 'PROVIDER STUDIO';

      if (provider.paymentAccounts && provider.paymentAccounts.length > 0) {
        const activeAccount =
          provider.paymentAccounts.find((a: any) => a.isDefault) ||
          provider.paymentAccounts[0];
        bankName = activeAccount.bankName || bankName;
        accountNumber = activeAccount.accountNumberMasked
          ? activeAccount.accountNumberMasked.replace(/\*/g, '8')
          : accountNumber;
        accountHolder = activeAccount.accountHolder || accountHolder;
      }

      const transferRef = `COMPENSATION_${booking.bookingCode}`;
      transferResult = await this.executeCompensationTransfer({
        bookingId: booking._id,
        providerId: provider._id,
        amount: incident.requestedAmount,
        bankName,
        accountNumber,
        accountHolder,
        transferRef,
      });

      if (!transferResult.success) {
        throw new BadRequestException(
          `Chuyển tiền đền bù cho Shop thất bại: ${transferResult.error}`,
        );
      }

      // 3. Hoàn trả số tiền cọc giữ đồ còn lại cho Khách hàng
      const remainingRefund =
        booking.pricingSummary.depositTotal - incident.requestedAmount;
      if (remainingRefund > 0) {
        refundResult = await this.refundWorkflowService.createFromDispute({
          bookingId: booking._id.toString(),
          requestedBy: this.getCustomerIdStr(booking),
          amount: remainingRefund,
          reason: 'Refund after customer accepted dispute resolution',
          type: RefundType.Dispute,
          sourceEventId: `refund:dispute:${incident._id}:customer-agree`,
        });
      }

      incident.status = IncidentStatus.Accepted;
      await incident.save();

      (booking as any).rentalDepositRefund = {
        status: remainingRefund > 0 ? 'REFUNDED' : 'NO_REFUND',
        amount: remainingRefund > 0 ? remainingRefund : 0,
        completedAt: new Date(),
        refundRequestId: refundResult?._id || null,
      };

      await this.bookingItemModel.updateMany(
        { bookingId: booking._id },
        {
          $set: {
            'rentalFulfillment.depositSettlementStatus':
              remainingRefund > 0 ? 'PARTIALLY_DEDUCTED' : 'FULLY_DEDUCTED',
            'rentalFulfillment.depositDeductedAmount': incident.requestedAmount,
            'rentalFulfillment.depositRefundAmount': remainingRefund > 0 ? remainingRefund : 0,
          },
        },
      );

      booking.status = BookingStatus.Completed;
      booking.statusTimeline.push({
        status: BookingStatus.Completed,
        changedAt: new Date(),
        note: `Khách hàng đồng ý đền bù ${incident.requestedAmount.toLocaleString()}đ. Đơn đặt lịch hoàn tất thành công.`,
      });
      await booking.save();

      await this.paymentsService.executeProfitSplit(booking);
    } catch (err) {
      // Revert lại trạng thái Held nếu gặp lỗi
      await this.bookingModel.db
        .model('BookingEscrow')
        .updateOne(
          { bookingId: booking._id },
          { $set: { status: EscrowStatus.Held } },
        );
      throw err;
    }

    return {
      success: true,
      message: 'Xử lý đền bù thành công',
      transferResult,
      refundResult,
    };
  }

  async customerDisagreeIncident(
    incidentId: string,
    customerUserId: string,
  ): Promise<any> {
    const incident = await this.incidentModel.findById(incidentId);
    if (!incident) {
      throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    }

    if (incident.status !== IncidentStatus.PendingCustomer) {
      throw new ConflictException(
        'Sự cố này đã được xử lý hoặc đang tranh chấp',
      );
    }

    const booking = await this.bookingModel.findById(incident.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }

    if (this.getCustomerIdStr(booking) !== customerUserId) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    // Chuyển incident sang trạng thái tranh chấp
    const transitioned = await this.incidentModel.findOneAndUpdate(
      { _id: incident._id, status: IncidentStatus.PendingCustomer },
      { $set: { status: IncidentStatus.Disputed } },
      { new: true },
    );
    if (!transitioned) {
      throw new ConflictException('Sự cố đã được xử lý bởi thao tác khác');
    }

    // Chuyển booking sang trạng thái tranh chấp
    booking.status = BookingStatus.Disputed;
    booking.statusTimeline.push({
      status: BookingStatus.Disputed,
      changedAt: new Date(),
      note: 'Khách hàng từ chối đền bù. Đơn đặt lịch chuyển sang trạng thái tranh chấp chờ Admin xử lý.',
    });
    await booking.save();

    const policy = await this.policyResolverService.getDisputePolicy();
    if (policy.holdSettlementWhenDisputed) {
      await this.settlementsService.holdSettlementsForBooking(
        booking._id.toString(),
        'Booking is under dispute',
      );
    }

    // Tạo Dispute record
    await this.disputeModel.findOneAndUpdate(
      { bookingId: booking._id },
      {
        $setOnInsert: {
          bookingId: booking._id,
          bookingItemId: incident.bookingItemId,
          openedBy: new Types.ObjectId(customerUserId),
          againstProviderId: incident.reportedBy,
          reason: `Khách hàng khiếu nại yêu cầu đền bù của Shop: ${incident.description}`,
          evidencePhotos: incident.evidencePhotos,
          status: DisputeStatus.Open,
        },
      },
      { upsert: true, new: true },
    );

    return {
      success: true,
      message:
        'Đơn hàng đã được chuyển sang trạng thái tranh chấp cho Admin xử lý.',
    };
  }

  async adminResolveIncident(
    bookingIdStr: string,
    decision: 'SHOP_RIGHT' | 'CUSTOMER_RIGHT' | 'SPLIT',
    adminUserId: string,
    notes: string,
    splitRefundAmount?: number,
    splitCompensationAmount?: number,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(bookingIdStr)) {
      throw new BadRequestException('Mã đơn đặt lịch không hợp lệ');
    }
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }

    let incident = await this.incidentModel.findOne({ bookingId });
    let isDirectDispute = false;
    let reportedBy: any = null;
    let requestedAmount = 0;

    if (!incident) {
      const dispute = await this.disputeModel.findOne({
        bookingId,
        status: { $in: [DisputeStatus.Open, DisputeStatus.UnderReview] },
      });
      if (!dispute) {
        if (booking.status === BookingStatus.Disputed) {
          isDirectDispute = true;
          reportedBy = booking.providerIds?.[0] || null;
          requestedAmount =
            booking.pricingSummary?.grandTotal ||
            booking.pricingSummary?.subTotal ||
            0;
        } else {
          throw new NotFoundException(
            'Không tìm thấy báo cáo sự cố hay hồ sơ tranh chấp cho đơn hàng này',
          );
        }
      } else {
        isDirectDispute = true;
        reportedBy = dispute.againstProviderId;
        requestedAmount =
          booking.pricingSummary.grandTotal ||
          booking.pricingSummary?.subTotal ||
          0;
      }
    } else {
      if (incident.status !== IncidentStatus.Disputed) {
        throw new ConflictException('Sự cố này không ở trạng thái tranh chấp');
      }
      reportedBy = incident.reportedBy;
      requestedAmount = incident.requestedAmount;
    }

    const depositTotal = booking.pricingSummary?.depositTotal || 0;
    const grandTotal = booking.pricingSummary?.grandTotal || booking.pricingSummary?.subTotal || 0;
    // Tiền thuê = tổng đơn hàng trừ tiền cọc
    const rentalFee = Math.max(grandTotal - depositTotal, 0);

    // Tính số tiền thực sự đã thanh toán (loại bỏ refund đã thực hiện)
    let actualPaidTotal = grandTotal;
    try {
      const paidPayments = await this.bookingModel.db.model('Payment').find({
        bookingId: booking._id,
        status: { $in: ['SUCCESS', 'success', 'CONFIRMED'] },
        purpose: { $nin: ['DEPOSIT_REFUND', 'COMPENSATION'] },
      }).lean() as any[];
      actualPaidTotal = Math.max(
        paidPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0)
          - paidPayments.reduce((s: number, p: any) => s + (p.refundedAmount || 0), 0),
        0,
      );
      if (actualPaidTotal === 0) actualPaidTotal = grandTotal;
    } catch (e) {
      console.warn('Could not compute actualPaidTotal, falling back to grandTotal:', e);
      actualPaidTotal = grandTotal;
    }

    /*
     * ─── LUỒNG 1: Khách tố cáo trong giai đoạn 30 phút NHẬN ĐỒ (isDirectDispute = true) ───
     *   • Khách đúng  → hoàn TOÀN BỘ tiền (cả thuê lẫn cọc)
     *   • Provider đúng → chỉ hoàn tiền THUÊ cho khách, provider giữ tiền CỌC
     *
     * ─── LUỒNG 2: Provider tố cáo sau khi khách ĐÃ TRẢ ĐỒ (isDirectDispute = false) ─────
     *   • Khách đúng   → hoàn tiền CỌC cho khách
     *   • Provider đúng → provider giữ tiền CỌC (compensation), khách không được gì thêm
     */
    let refundAmount: number;
    let compensationAmount: number;

    const isPhotosDeliveredPhase = booking.bookingType === 'PHOTOGRAPHY' && (
      booking.status === BookingStatus.AwaitingReview ||
      Boolean((booking as any).deliveredPhotos?.length) ||
      Boolean((booking as any).deliveryDriveUrl)
    );

    if (decision === 'SPLIT') {
      refundAmount = splitRefundAmount ?? -1;
      compensationAmount = splitCompensationAmount ?? -1;
    } else if (isPhotosDeliveredPhase) {
      // Khi tranh chấp xảy ra SAU KHI Thợ ảnh đã hoàn thành buổi chụp & bàn giao sản phẩm:
      if (decision === 'CUSTOMER_RIGHT') {
        refundAmount = splitRefundAmount ?? Math.round(actualPaidTotal * 0.5);
        compensationAmount = splitCompensationAmount ?? Math.max(0, actualPaidTotal - refundAmount);
      } else {
        // SHOP_RIGHT: Thợ ảnh đúng → Thợ hưởng 100% tiền chụp, khách không được hoàn
        refundAmount = 0;
        compensationAmount = actualPaidTotal;
      }
    } else if (isDirectDispute) {
      // Luồng 1 — Khách tố trong 30p nhận đồ hoặc trước buổi chụp
      if (decision === 'CUSTOMER_RIGHT') {
        refundAmount = actualPaidTotal;   // hoàn tất cả (thuê + cọc)
        compensationAmount = 0;
      } else {
        // SHOP_RIGHT — chỉ hoàn tiền thuê, provider giữ tiền cọc
        refundAmount = Math.min(rentalFee, actualPaidTotal);
        compensationAmount = Math.min(depositTotal, actualPaidTotal - refundAmount);
      }
    } else {
      // Luồng 2 — Provider tố sau khi trả đồ (incident)
      if (decision === 'CUSTOMER_RIGHT') {
        refundAmount = depositTotal;      // hoàn tiền cọc cho khách
        compensationAmount = 0;
      } else {
        // SHOP_RIGHT — provider lấy tiền cọc, khách không được gì
        refundAmount = 0;
        compensationAmount = Math.min(incident?.requestedAmount ?? depositTotal, depositTotal);
      }
    }

    // Giới hạn tổng không vượt quá số tiền thực tế có thể chi trả
    const limitTotal = isDirectDispute ? actualPaidTotal : depositTotal;
    if (
      refundAmount < 0 ||
      compensationAmount < 0 ||
      refundAmount + compensationAmount > limitTotal + 1
    ) {
      throw new BadRequestException(
        `Tổng tiền hoàn khách (${refundAmount.toLocaleString('vi-VN')}đ) và bồi thường provider (${compensationAmount.toLocaleString('vi-VN')}đ) không được vượt quá giới hạn ${limitTotal.toLocaleString('vi-VN')}đ`,
      );
    }

    // 1. Cập nhật trạng thái Escrow sang DisputedResolved nếu có
    const escrow = await this.bookingModel.db
      .model('BookingEscrow')
      .findOneAndUpdate(
        { bookingId: booking._id, status: EscrowStatus.Held },
        { $set: { status: EscrowStatus.DisputedResolved } },
        { new: false },
      );

    if (!escrow) {
      throw new ConflictException('The escrow is already being resolved or is unavailable.');
    }

    let transferResult = null;
    let refundResult = null;

    try {
      if (compensationAmount > 0) {
        // 2. Phán quyết Shop đúng -> Chuyển số tiền đền bù cho Shop
        const provider = await this.bookingModel.db
          .model('Provider')
          .findById(reportedBy);
        if (provider) {
          let bankName = 'VietinBank';
          let accountNumber = '1029384756';
          let accountHolder = 'PROVIDER STUDIO';

          if (provider.paymentAccounts && provider.paymentAccounts.length > 0) {
            const activeAccount =
              provider.paymentAccounts.find((a: any) => a.isDefault) ||
              provider.paymentAccounts[0];
            bankName = activeAccount.bankName || bankName;
            accountNumber = activeAccount.accountNumberMasked
              ? activeAccount.accountNumberMasked.replace(/\*/g, '8')
              : accountNumber;
            accountHolder = activeAccount.accountHolder || accountHolder;
          }

          const transferRef = `COMPENSATION_RESOLVED_${booking.bookingCode}`;
          transferResult = await this.executeCompensationTransfer({
            bookingId: booking._id,
            providerId: provider._id,
            amount: compensationAmount,
            bankName,
            accountNumber,
            accountHolder,
            transferRef,
          });

          if (!transferResult.success) {
            throw new BadRequestException(
              `Chuyển khoản đền bù cho Shop thất bại: ${transferResult.error}`,
            );
          }
        }
      }

      if (refundAmount > 0) {
        try {
          refundResult = await this.refundWorkflowService.createFromDispute({
            bookingId: booking._id.toString(),
            requestedBy: this.getCustomerIdStr(booking),
            amount: refundAmount,
            reason: notes,
            type: RefundType.Dispute,
            sourceEventId: `refund:dispute:${incident?._id || booking._id}:admin-resolution`,
          });
        } catch (rfErr) {
          console.warn('createFromDispute error, creating direct DEPOSIT_REFUND payment fallback:', rfErr);
        }

        try {
          const existingRefundPayment = await this.bookingModel.db.model('Payment').findOne({
            bookingId: booking._id,
            purpose: 'DEPOSIT_REFUND',
          });
          if (!existingRefundPayment) {
            const refundPaymentCode = `REF${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
            await this.bookingModel.db.model('Payment').create({
              bookingId: booking._id,
              paymentCode: refundPaymentCode,
              amount: refundAmount,
              purpose: 'DEPOSIT_REFUND',
              paymentMethod: 'PAYOS_REFUND',
              status: 'SUCCESS',
              paidAt: new Date(),
            });
          } else {
            existingRefundPayment.amount = refundAmount;
            existingRefundPayment.status = 'SUCCESS';
            await existingRefundPayment.save();
          }
        } catch (errPayment) {
          console.error('Error ensuring DEPOSIT_REFUND payment record:', errPayment);
        }

        // Cập nhật rentalDepositRefund & paymentSummary trên Booking khi khách được hoàn tiền
        (booking as any).rentalDepositRefund = {
          status: 'REFUNDED',
          amount: refundAmount,
          completedAt: new Date(),
          rentalDepositReason: notes,
        };
        if (!booking.paymentSummary) (booking as any).paymentSummary = {};
        booking.paymentSummary.totalRefunded = refundAmount;
        booking.paymentSummary.paymentStatus = 'REFUNDED' as any;
      } else {
        // Khi refundAmount === 0 (Provider đúng, giữ tiền cọc):
        // 1. Xóa / Hủy các payment DEPOSIT_REFUND tự động phát sinh trước đó
        try {
          await this.bookingModel.db.model('Payment').deleteMany({
            bookingId: booking._id,
            purpose: 'DEPOSIT_REFUND',
          });
        } catch (delErr) {
          console.warn('Could not delete old DEPOSIT_REFUND payment records:', delErr);
        }

        // 2. Cập nhật rentalDepositRefund = NO_REFUND & totalRefunded = 0
        (booking as any).rentalDepositRefund = {
          status: 'NO_REFUND',
          amount: 0,
          completedAt: new Date(),
          rentalDepositReason: 'Khấu trừ đền bù hỏng đồ (Provider thắng tranh chấp)',
        };
        if (!booking.paymentSummary) (booking as any).paymentSummary = {};
        booking.paymentSummary.totalRefunded = 0;
      }

      // Cập nhật trạng thái sự cố và tranh chấp
      if (incident) {
        incident.status = IncidentStatus.Resolved;
        incident.adminNotes = notes;
        incident.resolvedAt = new Date();
        await incident.save();
      }

      const item = await this.bookingItemModel.findOne({ bookingId: booking._id });
      const resolvedDispute = await this.disputeModel.findOneAndUpdate(
        {
          bookingId,
        },
        {
          $set: {
            bookingItemId: item?._id || new Types.ObjectId(),
            openedBy: (booking as any).customerId?._id || booking.customerId,
            againstProviderId: reportedBy || (booking.providerIds?.[0] || new Types.ObjectId()),
            reason: notes || 'Khách hàng khiếu nại',
            status: DisputeStatus.Resolved,
            adminDecision: {
              decision:
                decision === 'SHOP_RIGHT'
                  ? DisputeDecision.ProviderFullPay
                  : decision === 'CUSTOMER_RIGHT'
                    ? DisputeDecision.CustomerFullRefund
                    : DisputeDecision.MutualAgreement,
              faultParty:
                decision === 'SHOP_RIGHT'
                  ? FaultParty.Customer
                  : decision === 'CUSTOMER_RIGHT'
                    ? FaultParty.Provider
                    : FaultParty.None,
              refundAmount,
              compensationAmount,
              penaltyAmount: 0,
              decisionNote: notes,
              decidedBy: new Types.ObjectId(adminUserId),
              decidedAt: new Date(),
            },
          },
        },
        { new: true, upsert: true },
      );
      if (!resolvedDispute) {
        throw new ConflictException(
          'Tranh chấp đã được xử lý hoặc không còn ở trạng thái chờ giải quyết',
        );
      }

      // Chuyển đơn hàng sang Completed và lưu kết quả tranh chấp
      let decisionLabel: string;
      if (decision === 'SPLIT') {
        decisionLabel = 'Thỏa thuận chia tiền';
      } else if (isDirectDispute) {
        // Luồng 1: khách tố trong 30p nhận đồ
        decisionLabel = decision === 'CUSTOMER_RIGHT'
          ? 'Khách hàng đúng — Hoàn toàn bộ tiền (thuê + cọc)'
          : 'Shop đúng — Hoàn tiền thuê cho khách, provider giữ tiền cọc';
      } else {
        // Luồng 2: provider tố sau khi trả đồ
        decisionLabel = decision === 'CUSTOMER_RIGHT'
          ? 'Khách hàng đúng — Hoàn tiền cọc cho khách'
          : 'Provider đúng — Provider giữ tiền cọc';
      }

      (booking as any).disputeResult = {
        decision,
        decisionLabel,
        refundAmount,
        compensationAmount,
        notes,
        resolvedAt: new Date(),
      };

      booking.status = BookingStatus.Completed;
      booking.statusTimeline.push({
        status: BookingStatus.Completed,
        changedAt: new Date(),
        note: `Admin giải quyết tranh chấp. Quyết định: ${decisionLabel}. Hoàn khách: ${refundAmount.toLocaleString('vi-VN')}đ, bồi thường provider: ${compensationAmount.toLocaleString('vi-VN')}đ. Ghi chú: ${notes}`,
      });
      await booking.save();

      // Cập nhật trạng thái hoàn thành, cọc & giải phóng tồn kho cho các sản phẩm áo dài trong đơn
      try {
        await this.bookingItemModel.updateMany(
          { bookingId: (booking as any)._id, itemType: 'PRODUCT' as any } as any,
          {
            $set: {
              'rentalFulfillment.status': 'COMPLETED',
              'rentalFulfillment.inventoryStatus': 'AVAILABLE',
              'rentalFulfillment.completedAt': new Date(),
              'rentalFulfillment.depositSettlementStatus': refundAmount > 0 ? 'FULLY_RELEASED' : 'FULLY_DEDUCTED',
              'rentalFulfillment.depositRefundAmount': refundAmount,
              'rentalFulfillment.depositDeductedAmount': refundAmount > 0 ? 0 : depositTotal,
            },
          },
        );
      } catch (itemErr) {
        console.warn('Lỗi tự động cập nhật rentalFulfillment cho booking items:', itemErr);
      }

      if (decision === 'CUSTOMER_RIGHT') {
        await this.settlementsService.cancelSettlementsForBooking(
          booking._id.toString(),
          notes,
          adminUserId,
        );

        if (reportedBy) {
          try {
            const providerModel = this.bookingModel.db.model('Provider');
            const provider = await providerModel.findById(reportedBy);
            if (provider) {
              const newViolationCount = (provider.violationCount || 0) + 1;
              const updateData: Record<string, any> = { violationCount: newViolationCount };
              if (newViolationCount >= 3) {
                updateData.status = 'SUSPENDED';
              }
              await providerModel.findByIdAndUpdate(reportedBy, { $set: updateData });
            }
          } catch (pErr) {
            console.error('Lỗi tự động ghi nhận vi phạm/đình chỉ đối tác:', pErr);
          }
        }
      } else {
        await this.settlementsService.releaseSettlementsForBooking(
          booking._id.toString(),
          notes,
          adminUserId,
        );
        await this.paymentsService.executeProfitSplit(booking);
      }

      // Gửi thông báo cho khách hàng và shop
      try {
        const notificationModel = this.bookingModel.db.model('Notification');
        const customerUserId = booking.customerId._id || booking.customerId;

        await notificationModel.create({
          userId: customerUserId,
          title: `Kết quả giải quyết tranh chấp đơn hàng #${booking.bookingCode}`,
          content: `Admin đã đưa ra phán quyết cho đơn hàng ${booking.bookingCode}. Quyết định: ${decisionLabel}. Số tiền hoàn lại cho bạn: ${refundAmount.toLocaleString('vi-VN')}đ. Ghi chú của Admin: ${notes}`,
          type: 'SYSTEM',
          metadata: { bookingId: booking._id },
          isRead: false,
        });

        for (const pId of booking.providerIds) {
          const provider = await this.bookingModel.db
            .model('Provider')
            .findById(pId);
          if (provider && provider.userId) {
            await notificationModel.create({
              userId: provider.userId,
              title: `Kết quả giải quyết tranh chấp đơn hàng #${booking.bookingCode}`,
              content: `Admin đã đưa ra phán quyết cho đơn hàng ${booking.bookingCode}. Quyết định: ${decisionLabel}. Số tiền bồi thường giải ngân cho Shop: ${compensationAmount.toLocaleString('vi-VN')}đ. Ghi chú của Admin: ${notes}`,
              type: 'SYSTEM',
              metadata: { bookingId: booking._id },
              isRead: false,
            });
          }
        }
      } catch (notifErr) {
        console.error(
          'Failed to create dispute resolution notifications:',
          notifErr,
        );
      }
    } catch (err) {
      // Revert lại trạng thái Held nếu gặp lỗi
      await this.bookingModel.db
        .model('BookingEscrow')
        .updateOne(
          { bookingId: booking._id },
          { $set: { status: EscrowStatus.Held } },
        );
      throw err;
    }

    return {
      success: true,
      message: 'Admin giải quyết tranh chấp thành công',
      transferResult,
      refundResult,
    };
  }

  async getDisputedIncidents(): Promise<any[]> {
    const incidents = await this.incidentModel
      .find({ status: { $in: [IncidentStatus.Disputed, IncidentStatus.Resolved] } })
      .populate('bookingId')
      .populate('bookingItemId')
      .populate('productId')
      .populate('reportedBy')
      .exec();

    const disputes = await this.disputeModel
      .find({
        status: { $in: [DisputeStatus.Open, DisputeStatus.UnderReview, DisputeStatus.Resolved] },
      })
      .populate('bookingId')
      .populate('bookingItemId')
      .populate('openedBy')
      .populate('againstProviderId')
      .exec();

    const mappedDisputes = disputes.map((d: any) => {
      const pricingSummary = d.bookingId?.pricingSummary || {};
      const isResolved = d.status === DisputeStatus.Resolved || d.status === 'RESOLVED';
      return {
        _id: d._id,
        bookingId: d.bookingId,
        bookingItemId: d.bookingItemId,
        productId: d.bookingItemId?.productId || null,
        reportedBy: d.againstProviderId,
        description: d.reason,
        actionType: 'REJECT_HANDOVER',
        evidencePhotos: d.evidencePhotos,
        requestedAmount:
          pricingSummary.grandTotal || pricingSummary.subTotal || 0,
        status: isResolved ? 'RESOLVED' : IncidentStatus.Disputed,
        isDirectDispute: true,
        openedBy: d.openedBy,
        createdAt: d.createdAt,
      };
    });

    const mappedIncidents = incidents.map((i: any) => {
      const pricingSummary = i.bookingId?.pricingSummary || {};
      const isResolved = i.status === IncidentStatus.Resolved || i.status === 'RESOLVED';
      return {
        _id: i._id,
        bookingId: i.bookingId,
        bookingItemId: i.bookingItemId,
        productId: i.productId,
        reportedBy: i.reportedBy,
        description: i.description || i.incidentType,
        actionType: 'INCIDENT_REPORT',
        evidencePhotos: i.evidencePhotos,
        requestedAmount: i.compensationAmount || pricingSummary.depositTotal || 0,
        status: isResolved ? 'RESOLVED' : IncidentStatus.Disputed,
        isDirectDispute: false,
        openedBy: i.reportedBy,
        createdAt: i.createdAt,
      };
    });

    // Thêm các Booking có trạng thái DISPUTED hoặc có disputeResult chưa có record trong dispute/incident
    const existingBookingIds = [
      ...incidents.map((i: any) => i.bookingId?._id?.toString() || i.bookingId?.toString()),
      ...disputes.map((d: any) => d.bookingId?._id?.toString() || d.bookingId?.toString()),
    ].filter(Boolean);

    const bookingModel = this.incidentModel.db.model('Booking');
    const bookingItemModel = this.incidentModel.db.model('BookingItem');
    const providerModel = this.incidentModel.db.model('Provider');

    const disputedBookings = await bookingModel
      .find({
        $or: [
          { status: BookingStatus.Disputed },
          { disputeResult: { $exists: true } },
        ],
        _id: { $nin: existingBookingIds.map((id: string) => new Types.ObjectId(id)) },
      })
      .populate('customerId')
      .exec();

    const mappedDisputedBookings = await Promise.all(
      disputedBookings.map(async (b: any) => {
        const item = await bookingItemModel
          .findOne({ bookingId: b._id })
          .populate('productId')
          .populate('photographyPackageId')
          .exec();

        const lastTimeline = [...(b.statusTimeline || [])]
          .reverse()
          .find((t: any) => t.status === BookingStatus.Disputed);
        const reason = lastTimeline?.note || 'Khách hàng gửi khiếu nại đơn hàng';

        const providerId = b.providerIds?.[0] || null;
        let providerDoc = null;
        if (providerId) {
          providerDoc = await providerModel.findById(providerId).exec();
        }

        const isResolved = Boolean(b.disputeResult) || b.status !== BookingStatus.Disputed;

        return {
          _id: `bdispute_${b._id}`,
          bookingId: b,
          bookingItemId: item || null,
          productId: item?.productId || item?.photographyPackageId || null,
          reportedBy: providerDoc || null,
          description: reason,
          actionType: b.bookingType === 'PHOTOGRAPHY' ? 'PHOTOGRAPHY_DISPUTE' : 'CUSTOMER_DISPUTE',
          evidencePhotos:
            (b as any).disputeEvidencePhotos?.length
              ? (b as any).disputeEvidencePhotos
              : (b as any).evidencePhotos?.length
              ? (b as any).evidencePhotos
              : b.deliveredPhotos || b.handoverPhotos || [],
          requestedAmount: b.pricingSummary?.grandTotal || b.pricingSummary?.subTotal || 0,
          status: isResolved ? 'RESOLVED' : IncidentStatus.Disputed,
          isDirectDispute: true,
          openedBy: b.customerId,
          isBookingDisputeOnly: true,
          createdAt: b.createdAt,
        };
      })
    );

    return [...mappedIncidents, ...mappedDisputes, ...mappedDisputedBookings];
  }

  private async executeCompensationTransfer(input: {
    bookingId: Types.ObjectId;
    providerId: Types.ObjectId;
    amount: number;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    transferRef: string;
  }): Promise<any> {
    const transferModel = this.bookingModel.db.model('SettlementTransfer');
    const existing = await transferModel.findOne({
      transactionReference: input.transferRef,
    });
    if (existing?.status === 'SUCCESS') {
      return {
        success: true,
        transactionId: existing.transactionReference,
        idempotent: true,
      };
    }

    const result = await this.bankingService.executeAutoTransfer(
      input.bankName,
      input.accountNumber,
      input.accountHolder,
      input.amount,
      input.transferRef,
    );

    await transferModel.findOneAndUpdate(
      { transactionReference: input.transferRef },
      {
        $set: {
          bookingId: input.bookingId,
          providerId: input.providerId,
          amountSent: input.amount,
          destinationBankAccount: {
            bankName: input.bankName,
            accountNumber: input.accountNumber,
            accountHolder: input.accountHolder,
          },
          status: result.success ? 'SUCCESS' : 'FAILED',
          errorMessage: result.error || null,
        },
      },
      { upsert: true, new: true },
    );

    return result;
  }

  private getCustomerIdStr(booking: any): string {
    if (!booking?.customerId) return '';
    return (booking.customerId._id || booking.customerId).toString();
  }
}
