import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { PaymentsService } from '../services/payments.service';
import { Payment, PaymentPurpose } from '../schemas/payment.schema';

export class CreatePaymentLinkDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsEnum(PaymentPurpose)
  purpose: PaymentPurpose;
}

export class ResolveDisputeDto {
  @IsNumber()
  @Min(0)
  refundToCustomer: number;

  @IsNumber()
  @Min(0)
  payToProvider: number;
}

export class WebhookBodyDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  desc: string;

  @IsNotEmpty()
  data: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  signature: string;
}

interface WebhookData {
  orderCode?: number;
  status?: string;
}

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
  ) {}

  @Post('create-link')
  @UseGuards(JwtAuthGuard)
  async createLink(@Body() dto: CreatePaymentLinkDto) {
    return this.paymentsService.createPaymentLink(dto.bookingId, dto.purpose);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getTransactions(user.sub, user.roles);
  }

  @Post(':code/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmManual(@Param('code') code: string) {
    return this.paymentsService.confirmPayment(code);
  }

  @Post('settlement/:bookingId/resolve-dispute')
  @UseGuards(JwtAuthGuard)
  async resolveDispute(
    @Param('bookingId') bookingId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.paymentsService.resolveDispute(
      bookingId,
      dto.refundToCustomer,
      dto.payToProvider,
    );
  }

  @Post('webhook')
  async handlePayOSWebhook(@Body() body: WebhookBodyDto) {
    const checksumKey = this.configService.get<string>(
      'PAYOS_CHECKSUM_KEY',
      '',
    );

    if (!checksumKey || checksumKey.includes('your_')) {
      this.logger.warn(
        `PAYOS_CHECKSUM_KEY not configured or is placeholder. Bypassing signature check for simulation.`,
      );
    } else {
      const isVerified = this.verifyPayOSSignature(
        body.data,
        body.signature,
        checksumKey,
      );
      if (!isVerified) {
        this.logger.warn(`Invalid signature detected in payOS webhook!`);
        throw new BadRequestException('Signature verification failed');
      }
    }

    const webhookData = body.data as WebhookData;
    const orderCode = webhookData.orderCode;
    const status = webhookData.status;

    this.logger.log(`Received payOS webhook for orderCode: ${orderCode}`);

    if (status === 'PAID' && orderCode !== undefined) {
      const payment = await this.paymentModel.findOne({
        'payos.orderCode': orderCode,
      });
      if (payment) {
        await this.paymentsService.confirmPayment(payment.paymentCode);
      }
    }

    return { status: 'success' };
  }

  private verifyPayOSSignature(
    data: Record<string, unknown>,
    signature: string,
    checksumKey: string,
  ): boolean {
    try {
      const sortedKeys = Object.keys(data).sort();
      const signDataString = sortedKeys
        .map((key) => `${key}=${String(data[key])}`)
        .join('&');

      const computedSignature = crypto
        .createHmac('sha256', checksumKey)
        .update(signDataString)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(computedSignature, 'utf-8'),
        Buffer.from(signature, 'utf-8'),
      );
    } catch {
      return false;
    }
  }

  // CHECKOUT SCREEN SIMULATOR (HTML View)
  @Get('checkout/:code')
  async renderCheckout(@Param('code') code: string, @Res() res: Response) {
    try {
      const payment = await this.paymentsService.confirmPayment(code);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Cổng Thanh Toán PayOS Simulator</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Montserrat', sans-serif;
              background-color: #f6f9fc;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 16px;
              box-shadow: 0 8px 30px rgba(0,0,0,0.05);
              text-align: center;
              max-width: 450px;
              width: 100%;
            }
            .success-icon {
              font-size: 64px;
              color: #2e7d32;
              margin-bottom: 20px;
            }
            h1 {
              font-size: 22px;
              color: #1a1a1a;
              margin-bottom: 12px;
              font-weight: 700;
            }
            p {
              font-size: 14px;
              color: #666;
              line-height: 1.5;
              margin-bottom: 30px;
            }
            .btn {
              background-color: #a11e22;
              color: white;
              border: none;
              padding: 12px 30px;
              font-size: 14px;
              font-weight: 700;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              text-decoration: none;
              display: inline-block;
            }
            .btn:hover {
              background-color: #801418;
              box-shadow: 0 4px 12px rgba(161, 30, 34, 0.2);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success-icon">✓</div>
            <h1>Thanh Toán Thành Công!</h1>
            <p>Hệ thống PayOS Simulator đã xác nhận giao dịch số <strong>${code}</strong> trị giá <strong>${payment.amount.toLocaleString()}đ</strong> hoàn tất thành công.</p>
            <a href="http://localhost:5173/dashboard/profile?tab=payments" class="btn">Quay lại Cửa Hàng</a>
          </div>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch {
      res.status(404).send('Không tìm thấy thông tin thanh toán.');
    }
  }
}
