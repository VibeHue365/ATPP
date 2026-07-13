import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { AdminReviewDecisionDto } from '../dto/provider-verification.dto';
import { ProviderDocumentType } from '../schemas/provider-verification.schema';
import { ProviderVerificationService } from '../services/provider-verification.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('admin/provider-verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminProviderVerificationsController {
  constructor(
    private readonly providerVerificationService: ProviderVerificationService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.providerVerificationService.adminList(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.providerVerificationService.adminDetail(user, id);
  }

  @Get(':id/documents/:documentType/versions')
  listVersions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentType') documentType: ProviderDocumentType,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.listDocumentVersions(
      user,
      id,
      documentType,
      this.meta(request),
    );
  }

  @Get(':id/documents/:documentType/view')
  async viewCurrentDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentType') documentType: ProviderDocumentType,
    @Req() request: RequestMeta,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.providerVerificationService.viewDocument(
      user,
      id,
      documentType,
      this.meta(request),
    );
    this.setDocumentHeaders(response, result.mimeType, result.fileName);
    return result.file;
  }

  @Get(':id/documents/:documentType/versions/:versionNo/view')
  async viewDocumentVersion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentType') documentType: ProviderDocumentType,
    @Param('versionNo') versionNo: string,
    @Req() request: RequestMeta,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.providerVerificationService.viewDocument(
      user,
      id,
      documentType,
      this.meta(request),
      Number(versionNo),
    );
    this.setDocumentHeaders(response, result.mimeType, result.fileName);
    return result.file;
  }

  @Patch(':id/start-review')
  startReview(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.adminStartReview(
      user,
      id,
      this.meta(request),
    );
  }

  @Patch(':id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminReviewDecisionDto,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.adminApprove(
      user,
      id,
      dto,
      this.meta(request),
    );
  }

  @Patch(':id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminReviewDecisionDto,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.adminReject(
      user,
      id,
      dto,
      this.meta(request),
    );
  }

  @Patch(':id/request-changes')
  requestChanges(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminReviewDecisionDto,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.adminRequestChanges(
      user,
      id,
      dto,
      this.meta(request),
    );
  }

  private meta(request: RequestMeta) {
    return {
      ipAddress: request.ip ?? null,
      userAgent: this.userAgent(request) ?? null,
    };
  }

  private userAgent(request: RequestMeta): string | undefined {
    const value = request.headers['user-agent'];
    return Array.isArray(value) ? value[0] : value;
  }

  private setDocumentHeaders(
    response: Response,
    mimeType: string,
    fileName: string,
  ): void {
    response.setHeader('Content-Type', mimeType);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName.replace(/"/g, '')}"`,
    );
  }
}
