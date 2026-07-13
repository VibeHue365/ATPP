import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  ForbiddenException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { DisputesService } from '../services/disputes.service';
import { CreateIncidentDto, ResolveDisputeDto } from '../dto/dispute.dto';

@Controller(['disputes', 'api/disputes'])
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  /** POST /api/disputes/incidents/upload-evidence - Provider tải ảnh bằng chứng */
  @Post('incidents/upload-evidence')
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              'Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const destination = join(
            process.cwd(),
            'uploads',
            'dispute-evidence',
          );
          if (!existsSync(destination)) {
            mkdirSync(destination, { recursive: true });
          }
          callback(null, destination);
        },
        filename: (_request, file, callback) => {
          const safeExt = extname(file.originalname).toLowerCase() || '.jpg';
          callback(
            null,
            `evidence-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`,
          );
        },
      }),
    }),
  )
  async uploadEvidence(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    if (!user.roles.some((role) => role.toUpperCase() === 'PROVIDER')) {
      throw new ForbiddenException(
        'Chỉ nhà cung cấp mới có quyền tải ảnh bằng chứng',
      );
    }
    if (!files?.length) {
      throw new BadRequestException('Vui lòng chọn ít nhất một ảnh bằng chứng');
    }
    return {
      urls: files.map(
        (file) => `/uploads/dispute-evidence/${file.filename}`,
      ),
    };
  }

  /** POST /api/disputes/incidents - Shop báo cáo hỏng đồ */
  @Post('incidents')
  async createIncident(
    @CurrentUser() user: AuthUser,
    @Body()
    body: CreateIncidentDto,
  ) {
    if (!user.roles.includes('PROVIDER') && !user.roles.includes('provider')) {
      throw new ForbiddenException('Chỉ nhà cung cấp mới có quyền tạo báo cáo sự cố');
    }
    return this.disputesService.createIncidentReport(user.sub, body);
  }

  /** GET /api/disputes/incidents/booking/:bookingId - Lấy incident report của đơn hàng */
  @Get('incidents/booking/:bookingId')
  async getIncident(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.disputesService.getIncidentByBooking(
      bookingId,
      user.sub,
      user.roles,
    );
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
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('dispute:read')
  async getDisputedList(@CurrentUser() user: AuthUser) {
    if (!user.roles.includes('ADMIN') && !user.roles.includes('admin')) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng này');
    }
    return this.disputesService.getDisputedIncidents();
  }

  /** POST /api/disputes/admin/resolve/:bookingId - Admin giải quyết tranh chấp */
  @Post('admin/resolve/:bookingId')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('dispute:manage')
  async adminResolve(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Body() body: ResolveDisputeDto,
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
      body.refundAmount,
      body.compensationAmount,
    );
  }
}
