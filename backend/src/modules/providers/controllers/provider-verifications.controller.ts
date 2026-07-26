import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import {
  AcceptProviderVerificationConsentDto,
  CreateProviderVerificationDto,
  UpdateProviderVerificationDto,
  UploadProviderVerificationDocumentDto,
} from '../dto/provider-verification.dto';
import { ProviderDocumentType } from '../schemas/provider-verification.schema';
import { ProviderVerificationService } from '../services/provider-verification.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('provider-verifications')
@UseGuards(JwtAuthGuard)
export class ProviderVerificationsController {
  constructor(
    private readonly providerVerificationService: ProviderVerificationService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProviderVerificationDto,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.createVerification(
      user,
      dto,
      this.meta(request),
    );
  }

  @Get('me/current')
  getCurrent(@CurrentUser() user: AuthUser) {
    return this.providerVerificationService.getCurrentVerification(user);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.providerVerificationService.getVerification(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProviderVerificationDto,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.updateVerification(
      user,
      id,
      dto,
      this.meta(request),
    );
  }

  @Post(':id/consent')
  acceptConsent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AcceptProviderVerificationConsentDto,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.acceptConsent(
      user,
      id,
      dto,
      this.meta(request),
    );
  }

  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UploadProviderVerificationDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.uploadDocument(
      user,
      id,
      dto.documentType,
      file,
      this.meta(request),
    );
  }

  @Get(':id/documents')
  listDocuments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.providerVerificationService.listDocuments(user, id);
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

  @Post(':id/documents/:documentType/ocr')
  runOcr(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentType') documentType: ProviderDocumentType,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.runOcr(
      user,
      id,
      documentType,
      this.meta(request),
    );
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.submitVerification(
      user,
      id,
      this.meta(request),
    );
  }

  @Get(':id/status')
  async status(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const verification = await this.providerVerificationService.getVerification(
      user,
      id,
    );
    return {
      verificationId: verification.verificationId,
      status: verification.status,
      review: verification.review,
    };
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
