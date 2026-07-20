import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UnsupportedMediaTypeException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
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
  RentalEvidenceDto,
} from '../dto/rental-fulfillment.dto';
import { RentalFulfillmentWorkflowService } from '../services/rental-fulfillment-workflow.service';

@Controller(['bookings', 'api/bookings'])
@UseGuards(JwtAuthGuard)
export class RentalFulfillmentController {
  constructor(
    private readonly workflow: RentalFulfillmentWorkflowService,
    private readonly privateStorage: PrivateStorageService,
  ) {}

  @Post(':bookingId/items/:itemId/rental/evidence')
  @UseInterceptors(FilesInterceptor('images', 5, {
    limits: { fileSize: 5 * 1024 * 1024 },
    storage: memoryStorage(),
    fileFilter: (_request, file, callback) => {
      const accepted = ['image/jpeg', 'image/png', 'image/webp'];
      if (!accepted.includes(file.mimetype)) {
        callback(new UnsupportedMediaTypeException('Chỉ nhận ảnh JPG, PNG hoặc WEBP.'), false);
        return;
      }
      callback(null, true);
    },
  }))
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
      return this.workflow.registerEvidenceUpload(access, user, { fileId, bucket, storageKey, mimeType: file.mimetype });
    }));
    return { files: uploads };
  }

  @Post(':bookingId/items/:itemId/rental/ready')
  markReady(@CurrentUser() user: AuthUser, @Param('bookingId') bookingId: string, @Param('itemId') itemId: string, @Body() dto: MarkRentalReadyDto) {
    return this.workflow.markReady(bookingId, itemId, user, dto?.note);
  }

  @Post(':bookingId/items/:itemId/rental/picked-up')
  markPickedUp(@CurrentUser() user: AuthUser, @Param('bookingId') bookingId: string, @Param('itemId') itemId: string, @Body() dto: RentalEvidenceDto) {
    return this.workflow.markPickedUp(bookingId, itemId, user, dto);
  }

  @Post(':bookingId/items/:itemId/rental/returned')
  markReturned(@CurrentUser() user: AuthUser, @Param('bookingId') bookingId: string, @Param('itemId') itemId: string, @Body() dto: RentalEvidenceDto) {
    return this.workflow.markReturned(bookingId, itemId, user, dto);
  }

  @Post(':bookingId/items/:itemId/rental/charges')
  proposeCharge(@CurrentUser() user: AuthUser, @Param('bookingId') bookingId: string, @Param('itemId') itemId: string, @Body() dto: ProposeRentalChargeDto) {
    return this.workflow.proposeCharge(bookingId, itemId, user, dto);
  }

  @Post(':bookingId/items/:itemId/rental/charges/:chargeType/review')
  reviewCharge(@CurrentUser() user: AuthUser, @Param('bookingId') bookingId: string, @Param('itemId') itemId: string, @Param('chargeType') chargeType: 'lateFee' | 'damageFee' | 'compensationAmount', @Body() dto: ReviewRentalChargeDto) {
    return this.workflow.reviewCharge(bookingId, itemId, user, chargeType, dto.approved, dto.note);
  }

  @Post(':bookingId/items/:itemId/rental/deposit/settle')
  settleDeposit(@CurrentUser() user: AuthUser, @Param('bookingId') bookingId: string, @Param('itemId') itemId: string, @Body() dto: SettleRentalDepositDto) {
    return this.workflow.settleDeposit(bookingId, itemId, user, dto);
  }
  @Post(':bookingId/items/:itemId/rental/complete')
  markCompleted(@CurrentUser() user: AuthUser, @Param('bookingId') bookingId: string, @Param('itemId') itemId: string, @Body() dto: CompleteRentalFulfillmentDto) {
    return this.workflow.markCompleted(bookingId, itemId, user, dto.inventoryStatus, dto?.note);
  }

  @Get(':bookingId/items/:itemId/rental/evidence/:fileId')
  async viewEvidence(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const evidence = await this.workflow.getEvidenceForViewing(bookingId, itemId, fileId, user);
    const file = await this.privateStorage.readPrivateFile(evidence.bucket, evidence.storageKey);
    const extension = evidence.mimeType === 'image/png' ? 'png' : evidence.mimeType === 'image/webp' ? 'webp' : 'jpg';
    response.setHeader('Content-Type', evidence.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="rental-evidence.${extension}"`);
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return file;
  }

  private hasValidImageSignature(file: Express.Multer.File): boolean {
    const header = file.buffer?.subarray(0, 12);
    if (!header?.length) return false;
    if (file.mimetype === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (file.mimetype === 'image/png') return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    return file.mimetype === 'image/webp' && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  }
}