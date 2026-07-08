import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { DisputesService } from '../services/disputes.service';

@Controller(['disputes', 'api/disputes'])
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  /** POST /api/disputes/incidents - Shop báo cáo hỏng đồ */
  @Post('incidents')
  async createIncident(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      bookingId: string;
      bookingItemId: string;
      description: string;
      evidencePhotos: string[];
      requestedAmount: number;
      actionType: 'MAINTENANCE' | 'CLEANING';
    },
  ) {
    if (!user.roles.includes('PROVIDER') && !user.roles.includes('provider')) {
      throw new ForbiddenException('Chỉ nhà cung cấp mới có quyền tạo báo cáo sự cố');
    }
    return this.disputesService.createIncidentReport(user.sub, body);
  }

  /** GET /api/disputes/incidents/booking/:bookingId - Lấy incident report của đơn hàng */
  @Get('incidents/booking/:bookingId')
  async getIncident(@Param('bookingId') bookingId: string) {
    return this.disputesService.getIncidentByBooking(bookingId);
  }

  /** POST /api/disputes/incidents/:id/agree - Khách hàng đồng ý đền bù */
  @Post('incidents/:id/agree')
  async customerAgree(
    @CurrentUser() user: AuthUser,
    @Param('id') incidentId: string,
  ) {
    return this.disputesService.customerAgreeIncident(incidentId, user.sub);
  }

  /** POST /api/disputes/incidents/:id/disagree - Khách hàng từ chối đền bù, yêu cầu khiếu nại */
  @Post('incidents/:id/disagree')
  async customerDisagree(
    @CurrentUser() user: AuthUser,
    @Param('id') incidentId: string,
  ) {
    return this.disputesService.customerDisagreeIncident(incidentId, user.sub);
  }

  /** GET /api/disputes/admin/disputed - Admin lấy danh sách tranh chấp */
  @Get('admin/disputed')
  async getDisputedList(@CurrentUser() user: AuthUser) {
    if (!user.roles.includes('ADMIN') && !user.roles.includes('admin')) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng này');
    }
    return this.disputesService.getDisputedIncidents();
  }

  /** POST /api/disputes/admin/resolve/:bookingId - Admin giải quyết tranh chấp */
  @Post('admin/resolve/:bookingId')
  async adminResolve(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Body() body: { decision: 'SHOP_RIGHT' | 'CUSTOMER_RIGHT'; notes: string },
  ) {
    if (!user.roles.includes('ADMIN') && !user.roles.includes('admin')) {
      throw new ForbiddenException('Bạn không có quyền thực hiện phán quyết');
    }
    if (!body.decision || !body.notes) {
      throw new BadRequestException('Thiếu thông tin quyết định phán quyết hoặc ghi chú');
    }
    return this.disputesService.adminResolveIncident(
      bookingId,
      body.decision,
      user.sub,
      body.notes,
    );
  }
}
