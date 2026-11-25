import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UnsupportedMediaTypeException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'crypto';
import type { Response } from 'express';
import type { Readable } from 'stream';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { PrivateStorageService } from '../../storage/services/private-storage.service';
import {
  CompleteRentalFulfillmentDto,
  ProposeRentalChargeDto,
  ReviewRentalChargeDto,
  SettleRentalDepositDto,
  MarkRentalReadyDto,
  MarkRentalReturnedDto,
  RentalEvidenceDto,
} from '../dto/rental-fulfillment.dto';
import { RentalFulfillmentWorkflowService } from '../services/rental-fulfillment-workflow.service';
import { RentalOverdueDominoService } from '../services/rental-overdue-domino.service';

@Controller(['bookings', 'api/bookings'])
@UseGuards(JwtAuthGuard)
export class RentalFulfillmentController {
  constructor(
    private readonly workflow: RentalFulfillmentWorkflowService,
    private readonly privateStorage: PrivateStorageService,
    private readonly overdueDomino: RentalOverdueDominoService,
  ) {}

  private readonly cccdEncHeader = Buffer.from('TAGO_ENC_V1:');

  private getIdentityEncryptionKey(): Buffer {
    const rawSecret =
      process.env.IDENTITY_FINGERPRINT_SECRET ||
      process.env.JWT_SECRET ||
      'tago-cccd-default-secret-key';
    return createHash('sha256').update(rawSecret).digest();
  }

  private encryptIdentityBuffer(plain: Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.getIdentityEncryptionKey(),
      iv,
    );
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([this.cccdEncHeader, iv, authTag, encrypted]);
  }

  private decryptIdentityBuffer(payload: Buffer): Buffer {
    const headerLen = this.cccdEncHeader.length;
    if (
      payload.length <= headerLen + 28 ||
      !payload.subarray(0, headerLen).equals(this.cccdEncHeader)
    ) {
      return payload;
    }
    const iv = payload.subarray(headerLen, headerLen + 12);
    const authTag = payload.subarray(headerLen + 12, headerLen + 28);
    const ciphertext = payload.subarray(headerLen + 28);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getIdentityEncryptionKey(),
      iv,
    );
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  @Post(':bookingId/items/:itemId/rental/evidence')
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      limits: { fileSize: 5 * 1024 * 1024 },
      storage: memoryStorage(),
      fileFilter: (_request, file, callback) => {
        const accepted = ['image/jpeg', 'image/png', 'image/webp'];
        if (!accepted.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              'Chỉ nhận ảnh JPG, PNG hoặc WEBP.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadEvidence(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('Vui lòng chọn ít nhất một ảnh bằng chứng.');
    const access = await this.workflow.authorizeEvidenceUpload(bookingId, itemId, user);
    const extensionByMime: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    const uploads = await Promise.all(files.map(async (file) => {
      if (!this.hasValidImageSignature(file)) throw new UnsupportedMediaTypeException('Nội dung tệp không phải là ảnh hợp lệ.');
      const fileId = randomUUID();
      const bucket = 'rental-fulfillment-private';
      const storageKey = `rental-fulfillment/${bookingId}/${itemId}/${new Date().toISOString().slice(0, 10)}/${fileId}${extensionByMime[file.mimetype]}`;
      await this.privateStorage.uploadPrivateFile(bucket, storageKey, file.buffer, file.mimetype);
      try {
        return await this.workflow.registerEvidenceUpload(access, user, { fileId, bucket, storageKey, mimeType: file.mimetype });
      } catch (error) {
        await this.privateStorage.deletePrivateFile(bucket, storageKey).catch(() => undefined);
        throw error;
      }
    }));
    return { files: uploads };
  }

  @Post(':bookingId/items/:itemId/rental/ready')
  markReady(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: MarkRentalReadyDto,
  ) {
    return this.workflow.markReady(bookingId, itemId, user, dto?.note);
  }

  @Post(':bookingId/items/:itemId/rental/picked-up')
  markPickedUp(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: RentalEvidenceDto,
  ) {
    return this.workflow.markPickedUp(bookingId, itemId, user, dto);
  }

  @Post(':bookingId/items/:itemId/rental/customer-return')
  requestCustomerReturn(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: RentalEvidenceDto,
  ) {
    return this.workflow.requestCustomerReturn(bookingId, itemId, user, dto);
  }

  @Post(':bookingId/items/:itemId/rental/returned')
  markReturned(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: MarkRentalReturnedDto,
  ) {
    return this.workflow.markReturned(bookingId, itemId, user, dto);
  }

  @Post(':bookingId/items/:itemId/rental/confirm-no-incident')
  confirmNoIncident(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto?: { note?: string },
  ) {
    return this.workflow.confirmNoIncident(bookingId, itemId, user, dto?.note);
  }

  @Post(':bookingId/items/:itemId/rental/cleaning-completed')
  markCleaningCompleted(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto?: { note?: string },
  ) {
    return this.workflow.markCleaningCompleted(
      bookingId,
      itemId,
      user,
      dto?.note,
    );
  }

  @Post(':bookingId/items/:itemId/rental/charges')
  proposeCharge(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ProposeRentalChargeDto,
  ) {
    throw new BadRequestException(
      'Chức năng đề xuất phí cũ đã ngừng hoạt động. Vui lòng sử dụng tính năng Báo cáo sự cố (Incident) để thỏa thuận với khách hàng trước khi Admin xử lý.',
    );
  }

  @Post(':bookingId/items/:itemId/rental/charges/:chargeType/review')
  reviewCharge(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Param('chargeType')
    chargeType: 'lateFee' | 'damageFee' | 'compensationAmount',
    @Body() dto: ReviewRentalChargeDto,
  ) {
    throw new BadRequestException(
      'Chức năng duyệt phí cũ đã ngừng hoạt động. Vui lòng giải quyết qua luồng Báo cáo sự cố (Incident) hoặc Tranh chấp (Dispute).',
    );
  }

  @Post(':bookingId/items/:itemId/rental/deposit/settle')
  settleDeposit(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: SettleRentalDepositDto,
  ) {
    throw new BadRequestException(
      'Chức năng tất toán cọc cũ đã ngừng hoạt động. Vui lòng sử dụng tính năng Báo cáo sự cố (Incident) hoặc xác nhận Không có sự cố.',
    );
  }

  @Post(':bookingId/items/:itemId/rental/complete')
  markCompleted(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CompleteRentalFulfillmentDto,
  ) {
    throw new BadRequestException(
      'Chức năng hoàn tất đơn trực tiếp cũ đã ngừng hoạt động. Vui lòng hoàn tất qua quy trình Xác nhận không có sự cố (Confirm No Incident) và Giặt ủi (Cleaning).',
    );
  }

  @Get(':bookingId/items/:itemId/rental/evidence')
  getEvidenceSummary(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.workflow.getEvidenceSummary(bookingId, itemId, user);
  }

  @Get(':bookingId/items/:itemId/rental/evidence/:fileId')
  async viewEvidence(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const evidence = await this.workflow.getEvidenceForViewing(
      bookingId,
      itemId,
      fileId,
      user,
    );
    const file = await this.privateStorage.readPrivateFile(
      evidence.bucket,
      evidence.storageKey,
    );
    const extension =
      evidence.mimeType === 'image/png'
        ? 'png'
        : evidence.mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';
    response.setHeader('Content-Type', evidence.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="rental-evidence.${extension}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(file);
  }

  @Post(':bookingId/customer-identity')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front', maxCount: 1 },
        { name: 'back', maxCount: 1 },
      ],
      {
        limits: { fileSize: 10 * 1024 * 1024 },
        storage: memoryStorage(),
      },
    ),
  )
  async uploadCustomerIdentity(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @UploadedFiles()
    files: {
      front?: Express.Multer.File[];
      back?: Express.Multer.File[];
    },
    @Body()
    body: {
      idNumber?: string;
      fullName?: string;
      notes?: string;
      frontBase64?: string;
      backBase64?: string;
    },
  ) {
    const extensionByMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const bucket = 'rental-fulfillment-private';
    let frontStorageKey: string | undefined;
    let backStorageKey: string | undefined;

    const frontFile = files?.front?.[0];
    if (frontFile) {
      if (!this.hasValidImageSignature(frontFile)) {
        throw new UnsupportedMediaTypeException('Ảnh mặt trước không hợp lệ.');
      }
      const fileId = randomUUID();
      const ext = extensionByMime[frontFile.mimetype] || '.jpg';
      frontStorageKey = `customer-identity/${bookingId}/front_${fileId}${ext}`;
      await this.privateStorage.uploadPrivateFile(
        bucket,
        frontStorageKey,
        this.encryptIdentityBuffer(frontFile.buffer),
        'application/octet-stream',
      );
    } else if (body?.frontBase64 && body.frontBase64.includes('base64,')) {
      const match = body.frontBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const fileId = randomUUID();
        const ext = extensionByMime[mime] || '.jpg';
        frontStorageKey = `customer-identity/${bookingId}/front_${fileId}${ext}`;
        await this.privateStorage.uploadPrivateFile(
          bucket,
          frontStorageKey,
          this.encryptIdentityBuffer(buffer),
          'application/octet-stream',
        );
      }
    }

    const backFile = files?.back?.[0];
    if (backFile) {
      if (!this.hasValidImageSignature(backFile)) {
        throw new UnsupportedMediaTypeException('Ảnh mặt sau không hợp lệ.');
      }
      const fileId = randomUUID();
      const ext = extensionByMime[backFile.mimetype] || '.jpg';
      backStorageKey = `customer-identity/${bookingId}/back_${fileId}${ext}`;
      await this.privateStorage.uploadPrivateFile(
        bucket,
        backStorageKey,
        this.encryptIdentityBuffer(backFile.buffer),
        'application/octet-stream',
      );
    } else if (body?.backBase64 && body.backBase64.includes('base64,')) {
      const match = body.backBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const fileId = randomUUID();
        const ext = extensionByMime[mime] || '.jpg';
        backStorageKey = `customer-identity/${bookingId}/back_${fileId}${ext}`;
        await this.privateStorage.uploadPrivateFile(
          bucket,
          backStorageKey,
          this.encryptIdentityBuffer(buffer),
          'application/octet-stream',
        );
      }
    }

    return this.workflow.saveCustomerIdentityCard(bookingId, user, {
      frontStorageKey,
      backStorageKey,
      idNumber: body?.idNumber,
      fullName: body?.fullName,
      notes: body?.notes,
    });
  }

  @Get(':bookingId/customer-identity')
  async getCustomerIdentity(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.workflow.getCustomerIdentityCard(bookingId, user);
  }

  @Get(':bookingId/customer-identity/image/:side')
  async viewCustomerIdentityImage(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('side') side: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    if (side !== 'front' && side !== 'back') {
      throw new BadRequestException('Mặt ảnh CCCD phải là front hoặc back.');
    }
    const evidence = await this.workflow.getCustomerIdentityImage(
      bookingId,
      side,
      user,
    );
    const stream = await this.privateStorage.readPrivateFile(
      evidence.bucket,
      evidence.storageKey,
    );
    const rawBuffer = await this.streamToBuffer(stream);
    const file = this.decryptIdentityBuffer(rawBuffer);
    response.setHeader('Content-Type', 'image/jpeg');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="cccd-${side}.jpg"`,
    );
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(file);
  }

  @Post(':bookingId/overdue/confirm-lost')
  async confirmLostItem(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Body() body: { reason?: string; contactAttempts?: number },
  ) {
    return this.overdueDomino.confirmLostItem(bookingId, user, body || {});
  }

  @Post(':bookingId/overdue/reverse')
  async reverseOverdue(
    @CurrentUser() _user: AuthUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.overdueDomino.reverseOverdueOnReturn(bookingId);
  }

  @Post(':bookingId/overdue/simulate')
  async simulateOverdue(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Body() body: { hoursOverdue?: number },
  ) {
    return this.overdueDomino.simulateOverdueForDemo(
      bookingId,
      user,
      body?.hoursOverdue,
    );
  }

  @Post(':bookingId/domino/choice')
  async resolveDominoChoice(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Body() body: { action: 'SELECT_ALTERNATIVE' | 'REFUND_100%'; alternativeProductId?: string },
  ) {
    return this.overdueDomino.resolveDominoCustomerChoice(bookingId, user, body);
  }

  @Post('overdue/scan')
  async scanOverdueManually() {
    const count = await this.overdueDomino.scanAndProcessOverdueBookings();
    const refunds = await this.overdueDomino.processDominoAutoRefunds();
    return { success: true, processedOverdueCount: count, autoRefundedDominoCount: refunds };
  }

  private hasValidImageSignature(file: Express.Multer.File): boolean {
    const header = file.buffer?.subarray(0, 12);
    if (!header?.length) return false;
    if (file.mimetype === 'image/jpeg')
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (file.mimetype === 'image/png')
      return (
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47
      );
    return (
      file.mimetype === 'image/webp' &&
      header.toString('ascii', 0, 4) === 'RIFF' &&
      header.toString('ascii', 8, 12) === 'WEBP'
    );
  }
}
