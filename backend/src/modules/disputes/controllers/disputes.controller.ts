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
  Query,
  Res,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { DisputesService } from '../services/disputes.service';
import { CreateIncidentDto, ResolveDisputeDto } from '../dto/dispute.dto';
import { PrivateStorageService } from '../../storage/services/private-storage.service';

@Controller(['disputes', 'api/disputes'])
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(
    private readonly disputesService: DisputesService,
    private readonly privateStorage: PrivateStorageService,
  ) {}

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
      storage: memoryStorage(),
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
    const urls = await Promise.all(
      files.map(async (file) => {
        if (!this.hasValidImageSignature(file)) {
          throw new UnsupportedMediaTypeException(
            'Nội dung tệp không phải là ảnh JPG, PNG hoặc WEBP hợp lệ',
          );
        }
        const extensionByMime: Record<string, string> = {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/webp': '.webp',
        };
        const storageKey = `dispute-evidence/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extensionByMime[file.mimetype]}`;
        const bucket = 'dispute-evidence-private';
        await this.privateStorage.uploadPrivateFile(bucket, storageKey, file.buffer, file.mimetype);
        return `private://${bucket}/${storageKey}`;
      }),
    );
    await this.disputesService.registerEvidenceUploads(user.sub, urls);
    return { urls };
  }

  @Get('incidents/evidence')
  async viewEvidence(
    @CurrentUser() user: AuthUser,
    @Query('ref') reference: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.disputesService.viewEvidence(user.sub, user.roles, reference);
    response.setHeader('Content-Type', result.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return result.file;
  }

  private hasValidImageSignature(file: Express.Multer.File): boolean {
    const header = file.buffer?.subarray(0, 12);
    if (!header?.length) return false;
    if (file.mimetype === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (file.mimetype === 'image/png') return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    return file.mimetype === 'image/webp' && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
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
