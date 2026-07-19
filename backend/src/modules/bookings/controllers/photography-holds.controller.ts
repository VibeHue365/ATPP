import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreatePhotographyHoldDto } from '../dto/create-photography-hold.dto';
import { CreatePhotographyComboHoldDto } from '../dto/create-photography-combo-hold.dto';
import { PhotographyHoldService } from '../services/photography-hold.service';

@Controller(['bookings', 'api/bookings'])
@UseGuards(JwtAuthGuard)
export class PhotographyHoldsController {
  constructor(
    private readonly photographyHoldService: PhotographyHoldService,
  ) {}

  /**
   * Creates a temporary photography reservation. The Idempotency-Key protects
   * a double click/retry from creating another booking.
   */
  @Post('photography/hold')
  async createHold(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePhotographyHoldDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Cần gửi header Idempotency-Key khi giữ lịch chụp.');
    }
    return this.photographyHoldService.createHold(
      user.sub,
      dto,
      idempotencyKey.trim(),
    );
  }

  @Post('combo/photography-hold')
  async createComboHold(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePhotographyComboHoldDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Cần gửi header Idempotency-Key khi giữ combo.');
    }
    return this.photographyHoldService.createComboHold(
      user.sub,
      dto,
      idempotencyKey.trim(),
    );
  }}
