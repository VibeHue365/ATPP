import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IncidentReport, IncidentStatus } from '../schemas/incident-report.schema';
import { Dispute, DisputeStatus, DisputeDecision, FaultParty } from '../schemas/dispute.schema';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import { BookingItem } from '../../bookings/schemas/booking-item.schema';
import { InventoryItem, InventoryItemStatus } from '../../products/schemas/inventory-item.schema';
import { PaymentsService } from '../../payments/services/payments.service';
import { MockBankingService } from '../../payments/services/mock-banking.service';

@Injectable()
export class DisputesService {
  constructor(
    @InjectModel(IncidentReport.name)
    private readonly incidentModel: Model<IncidentReport>,
    @InjectModel(Dispute.name)
    private readonly disputeModel: Model<Dispute>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItem>,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly bankingService: MockBankingService,
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

    // Kiểm tra xem đã có incident report cho sản phẩm này của đơn hàng chưa
    const existing = await this.incidentModel.findOne({
      bookingId: booking._id,
      bookingItemId: bookingItem._id,
    });
    if (existing) {
      throw new BadRequestException('Sự cố của sản phẩm này đã được báo cáo trước đó');
    }

    if (dto.requestedAmount > booking.pricingSummary.depositTotal) {
      throw new BadRequestException(
        `Số tiền yêu cầu đền bù (${dto.requestedAmount.toLocaleString()}đ) không được vượt quá số tiền cọc giữ đồ (${booking.pricingSummary.depositTotal.toLocaleString()}đ)`,
      );
    }

    // Tìm Provider ID của User
    const provider = await this.bookingModel.db
      .model('Provider')
      .findOne({ userId: new Types.ObjectId(providerUserId) });
    if (!provider) {
      throw new NotFoundException('Không tìm thấy thông tin đối tác của bạn');
    }

    // Tạo báo cáo sự cố
    const incident = await this.incidentModel.create({
      bookingId: booking._id,
      bookingItemId: bookingItem._id,
      productId: bookingItem.productId as any,
      reportedBy: provider._id,
      description: dto.description,
      evidencePhotos: dto.evidencePhotos,
      requestedAmount: dto.requestedAmount,
      status: IncidentStatus.PendingCustomer,
    });

    // Cập nhật trạng thái áo dài (InventoryItem) tương ứng
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

  async getIncidentByBooking(bookingId: string): Promise<IncidentReport | null> {
    return this.incidentModel
      .findOne({ bookingId: new Types.ObjectId(bookingId) })
      .populate('bookingItemId')
      .populate('productId')
      .exec();
  }

  async customerAgreeIncident(incidentId: string, customerUserId: string): Promise<any> {
    const incident = await this.incidentModel.findById(incidentId);
    if (!incident) {
      throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    }

    if (incident.status !== IncidentStatus.PendingCustomer) {
      throw new BadRequestException('Sự cố này đã được xử lý hoặc đang tranh chấp');
    }

    const booking = await this.bookingModel.findById(incident.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }

    if (booking.customerId.toString() !== customerUserId) {
      throw new BadRequestException('Bạn không có quyền thực hiện thao tác này');
    }

    // 1. Chuyển khoản trực tiếp số tiền đền bù sang tài khoản ngân hàng của Shop
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
      const activeAccount = provider.paymentAccounts.find((a: any) => a.isDefault) || provider.paymentAccounts[0];
      bankName = activeAccount.bankName || bankName;
      accountNumber = activeAccount.accountNumberMasked
        ? activeAccount.accountNumberMasked.replace(/\*/g, '8')
        : accountNumber;
      accountHolder = activeAccount.accountHolder || accountHolder;
    }

    const transferRef = `COMPENSATION_${booking.bookingCode}`;
    const transferResult = await this.bankingService.executeAutoTransfer(
      bankName,
      accountNumber,
      accountHolder,
      incident.requestedAmount,
      transferRef,
    );

    if (!transferResult.success) {
      throw new BadRequestException(`Chuyển tiền đền bù cho Shop thất bại: ${transferResult.error}`);
    }

    // 2. Hoàn trả số tiền cọc giữ đồ còn lại cho Khách hàng
    const remainingRefund = booking.pricingSummary.depositTotal - incident.requestedAmount;
    let refundResult = null;
    if (remainingRefund > 0) {
      refundResult = await this.paymentsService.refundDeposit(booking._id.toString(), remainingRefund);
    }

    // 3. Thực hiện Profit Split tiền dịch vụ & hoàn thành đơn đặt lịch
    incident.status = IncidentStatus.Accepted;
    await incident.save();

    booking.status = BookingStatus.Completed;
    booking.statusTimeline.push({
      status: BookingStatus.Completed,
      changedAt: new Date(),
      note: `Khách hàng đồng ý đền bù ${incident.requestedAmount.toLocaleString()}đ. Đơn đặt lịch hoàn tất thành công.`,
    });
    await booking.save();

    // Thực hiện Profit Split trực tiếp chuyển khoản tiền dịch vụ cho Provider
    await this.paymentsService.executeProfitSplit(booking);

    return {
      success: true,
      message: 'Xử lý đền bù thành công',
      transferResult,
      refundResult,
    };
  }

  async customerDisagreeIncident(incidentId: string, customerUserId: string): Promise<any> {
    const incident = await this.incidentModel.findById(incidentId);
    if (!incident) {
      throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    }

    if (incident.status !== IncidentStatus.PendingCustomer) {
      throw new BadRequestException('Sự cố này đã được xử lý hoặc đang tranh chấp');
    }

    const booking = await this.bookingModel.findById(incident.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }

    if (booking.customerId.toString() !== customerUserId) {
      throw new BadRequestException('Bạn không có quyền thực hiện thao tác này');
    }

    // Chuyển incident sang trạng thái tranh chấp
    incident.status = IncidentStatus.Disputed;
    await incident.save();

    // Chuyển booking sang trạng thái tranh chấp
    booking.status = BookingStatus.Disputed;
    booking.statusTimeline.push({
      status: BookingStatus.Disputed,
      changedAt: new Date(),
      note: 'Khách hàng từ chối đền bù. Đơn đặt lịch chuyển sang trạng thái tranh chấp chờ Admin xử lý.',
    });
    await booking.save();

    // Tạo Dispute record
    await this.disputeModel.create({
      bookingId: booking._id,
      bookingItemId: incident.bookingItemId,
      openedBy: new Types.ObjectId(customerUserId),
      againstProviderId: incident.reportedBy,
      reason: `Khách hàng khiếu nại yêu cầu đền bù của Shop: ${incident.description}`,
      evidencePhotos: incident.evidencePhotos,
      status: DisputeStatus.Open,
    });

    return {
      success: true,
      message: 'Đơn hàng đã được chuyển sang trạng thái tranh chấp cho Admin xử lý.',
    };
  }

  async adminResolveIncident(
    bookingIdStr: string,
    decision: 'SHOP_RIGHT' | 'CUSTOMER_RIGHT',
    adminUserId: string,
    notes: string,
  ): Promise<any> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }

    const incident = await this.incidentModel.findOne({ bookingId });
    if (!incident) {
      throw new NotFoundException('Không tìm thấy báo cáo sự cố cho đơn hàng này');
    }

    if (incident.status !== IncidentStatus.Disputed) {
      throw new BadRequestException('Sự cố này không ở trạng thái tranh chấp');
    }

    let transferResult = null;
    let refundResult = null;

    if (decision === 'SHOP_RIGHT') {
      // 1. Phán quyết Shop đúng -> Chuyển số tiền đền bù cho Shop
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
        const activeAccount = provider.paymentAccounts.find((a: any) => a.isDefault) || provider.paymentAccounts[0];
        bankName = activeAccount.bankName || bankName;
        accountNumber = activeAccount.accountNumberMasked
          ? activeAccount.accountNumberMasked.replace(/\*/g, '8')
          : accountNumber;
        accountHolder = activeAccount.accountHolder || accountHolder;
      }

      const transferRef = `COMPENSATION_RESOLVED_${booking.bookingCode}`;
      transferResult = await this.bankingService.executeAutoTransfer(
        bankName,
        accountNumber,
        accountHolder,
        incident.requestedAmount,
        transferRef,
      );

      if (!transferResult.success) {
        throw new BadRequestException(`Chuyển khoản đền bù cho Shop thất bại: ${transferResult.error}`);
      }

      // Hoàn trả phần cọc còn lại cho khách
      const remainingRefund = booking.pricingSummary.depositTotal - incident.requestedAmount;
      if (remainingRefund > 0) {
        refundResult = await this.paymentsService.refundDeposit(booking._id.toString(), remainingRefund);
      }
    } else {
      // 2. Phán quyết Khách đúng -> Hoàn 100% tiền cọc giữ đồ cho Khách
      refundResult = await this.paymentsService.refundDeposit(booking._id.toString(), booking.pricingSummary.depositTotal);
    }

    // Cập nhật trạng thái sự cố và tranh chấp
    incident.status = IncidentStatus.Resolved;
    incident.adminNotes = notes;
    incident.resolvedAt = new Date();
    await incident.save();

    await this.disputeModel.findOneAndUpdate(
      { bookingId },
      {
        $set: {
          status: DisputeStatus.Resolved,
          adminDecision: {
            decision: decision === 'SHOP_RIGHT' ? DisputeDecision.ProviderFullPay : DisputeDecision.CustomerFullRefund,
            faultParty: decision === 'SHOP_RIGHT' ? FaultParty.Customer : FaultParty.Provider,
            refundAmount: decision === 'SHOP_RIGHT' ? booking.pricingSummary.depositTotal - incident.requestedAmount : booking.pricingSummary.depositTotal,
            compensationAmount: decision === 'SHOP_RIGHT' ? incident.requestedAmount : 0,
            penaltyAmount: 0,
            decisionNote: notes,
            decidedBy: new Types.ObjectId(adminUserId),
            decidedAt: new Date(),
          },
        },
      },
    );

    // Chuyển đơn hàng sang Completed
    booking.status = BookingStatus.Completed;
    booking.statusTimeline.push({
      status: BookingStatus.Completed,
      changedAt: new Date(),
      note: `Admin giải quyết tranh chấp hỏng đồ. Quyết định: ${decision === 'SHOP_RIGHT' ? 'Shop Đúng' : 'Khách hàng Đúng'}. Ghi chú: ${notes}`,
    });
    await booking.save();

    // Thực hiện Profit Split trực tiếp chuyển khoản tiền dịch vụ cho Provider
    await this.paymentsService.executeProfitSplit(booking);

    return {
      success: true,
      message: 'Admin giải quyết tranh chấp thành công',
      transferResult,
      refundResult,
    };
  }

  async getDisputedIncidents(): Promise<any[]> {
    return this.incidentModel
      .find({ status: IncidentStatus.Disputed })
      .populate('bookingId')
      .populate('bookingItemId')
      .populate('productId')
      .populate('reportedBy')
      .exec();
  }
}
