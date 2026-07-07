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
import { PaymentWebhookEvent } from '../schemas/payment-webhook-event.schema';

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
    @InjectModel(PaymentWebhookEvent.name)
    private readonly webhookEventModel: Model<PaymentWebhookEvent>,
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

  @Get('settlement-transfers/provider')
  @UseGuards(JwtAuthGuard)
  async getProviderSettlementTransfers(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getProviderSettlementTransfers(user.sub);
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
    const webhookData = body.data as WebhookData;
    const orderCode = webhookData.orderCode;
    const status = webhookData.status;

    if (orderCode !== undefined && status) {
      const webhookId = `payos_${orderCode}_${status}`;
      try {
        const event = await this.webhookEventModel.findOneAndUpdate(
          { webhookId },
          {
            $setOnInsert: {
              provider: 'PAYOS',
              payload: body.data,
              signature: body.signature,
              processed: false,
            },
          },
          { upsert: true, new: false },
        );

        if (event && event.processed) {
          this.logger.log(
            `Webhook ${webhookId} was already processed. Bypassing.`,
          );
          return { status: 'success', note: 'already_processed' };
        }
      } catch (err) {
        this.logger.log(
          `Conflict/Duplicate writing WebhookEvent ${webhookId}. Bypassing.`,
        );
        return { status: 'success', note: 'duplicate_ignored' };
      }
    }

    const checksumKey = this.configService.get<string>(
      'PAYOS_CHECKSUM_KEY',
      '',
    );

    if (checksumKey && !checksumKey.includes('your_')) {
      const isVerified = this.verifyPayOSSignature(
        body.data,
        body.signature,
        checksumKey,
      );
      if (!isVerified) {
        this.logger.warn(`Invalid signature detected in payOS webhook!`);
        if (orderCode !== undefined && status) {
          const webhookId = `payos_${orderCode}_${status}`;
          await this.webhookEventModel.updateOne(
            { webhookId },
            { $set: { error: 'Signature verification failed' } },
          );
        }
        throw new BadRequestException('Signature verification failed');
      }
    } else {
      this.logger.warn(
        `PAYOS_CHECKSUM_KEY not configured or is placeholder. Bypassing signature check for simulation.`,
      );
    }

    this.logger.log(`Received payOS webhook for orderCode: ${orderCode}`);

    if (status === 'PAID' && orderCode !== undefined) {
      const payment = await this.paymentModel.findOne({
        'payos.orderCode': orderCode,
      });
      if (payment) {
        await this.paymentsService.confirmPayment(payment.paymentCode);
      }
    }

    if (orderCode !== undefined && status) {
      const webhookId = `payos_${orderCode}_${status}`;
      await this.webhookEventModel.updateOne(
        { webhookId },
        { $set: { processed: true, processedAt: new Date() } },
      );
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

  @Post('checkout/:code/confirm')
  async confirmSimulation(@Param('code') code: string) {
    return this.paymentsService.confirmPayment(code);
  }

  // CHECKOUT SCREEN SIMULATOR (HTML View)
  @Get('checkout/:code')
  async renderCheckout(@Param('code') code: string, @Res() res: Response) {
    try {
      const payment = await this.paymentModel.findOne({ paymentCode: code }).populate('bookingId');
      if (!payment) {
        return res.status(404).send('Không tìm thấy thông tin thanh toán.');
      }

      const booking = payment.bookingId as any;
      const bookingCode = booking?.bookingCode || 'N/A';
      const amount = payment.amount;
      const memo = `VIBEHUE PAY ${payment.paymentCode}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Cổng Thanh Toán PayOS Simulator</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              font-family: 'Montserrat', sans-serif;
              background-color: #FCF9F2;
            }
            .vh-text-red { color: #8B1E22; }
            .vh-bg-red { background-color: #8B1E22; }
            .vh-bg-red-hover:hover { background-color: #72181B; }
            .vh-border-gold { border-color: #EAE1D4; }
          </style>
        </head>
        <body class="min-h-screen flex items-center justify-center p-4 md:p-8">
          
          <!-- MAIN CONTAINER -->
          <div id="payment-card" class="bg-white rounded-2xl shadow-xl border vh-border-gold max-w-4xl w-full overflow-hidden transition-all duration-300 transform scale-100 flex flex-col md:flex-row">
            
            <!-- LEFT PANEL: Order details -->
            <div class="flex-1 p-8 md:p-12 border-b md:border-b-0 md:border-r vh-border-gold flex flex-col justify-between bg-stone-50/50">
              <div>
                <div class="flex items-center gap-2 mb-8">
                  <span class="vh-bg-red text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">CỔNG THANH TOÁN</span>
                  <span class="text-stone-400 font-semibold text-xs">PAYOS SIMULATOR</span>
                </div>
                
                <h1 class="text-2xl font-bold text-stone-900 mb-6">Thanh toán đơn hàng</h1>
                
                <!-- Pricing detail -->
                <div class="bg-white p-6 rounded-xl border vh-border-gold shadow-sm mb-6 flex justify-between items-center">
                  <div>
                    <span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">SỐ TIỀN CẦN THANH TOÁN</span>
                    <span class="text-3xl font-extrabold vh-text-red mt-1 block">${amount.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div class="text-right">
                    <span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">MÃ ĐƠN HÀNG</span>
                    <span class="text-base font-bold text-stone-800 mt-1 block">${bookingCode}</span>
                  </div>
                </div>

                <!-- Txn Info -->
                <div class="space-y-4">
                  <div class="flex justify-between text-sm py-1 border-b border-stone-100">
                    <span class="text-stone-500 font-medium">Mã giao dịch:</span>
                    <strong class="text-stone-800 font-bold">${payment.paymentCode}</strong>
                  </div>
                  <div class="flex justify-between text-sm py-1 border-b border-stone-100">
                    <span class="text-stone-500 font-medium">Nội dung chuyển khoản (Memo):</span>
                    <strong class="text-stone-800 font-bold text-emerald-700">${memo}</strong>
                  </div>
                  <div class="flex justify-between text-sm py-1 border-b border-stone-100">
                    <span class="text-stone-500 font-medium">Hình thức:</span>
                    <strong class="text-stone-800 font-bold">Đặt cọc giữ lịch</strong>
                  </div>
                </div>
              </div>

              <!-- Back link -->
              <div class="mt-8 pt-4 border-t border-stone-100">
                <a href="vibehue://payment/cancel" class="text-xs font-bold text-stone-500 hover:text-stone-700 flex items-center gap-1">
                  ← Hủy thanh toán
                </a>
              </div>
            </div>

            <!-- RIGHT PANEL: QR & Config -->
            <div class="flex-1 p-8 md:p-12 flex flex-col justify-between items-center">
              
              <!-- Recipient bank details configurator -->
              <div class="w-full mb-6">
                <button id="toggle-config-btn" class="w-full text-left py-2 px-3 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-bold text-stone-600 flex justify-between items-center transition">
                  <span>⚙️ CẤU HÌNH TÀI KHOẢN NHẬN TIỀN CỦA BẠN</span>
                  <span id="toggle-arrow">▼</span>
                </button>
                
                <div id="config-panel" class="hidden mt-4 p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div>
                    <label class="block text-[10px] font-bold text-stone-500 uppercase mb-1">Ngân hàng nhận</label>
                    <select id="bank-select" class="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none focus:border-stone-500">
                      <option value="970436">Vietcombank (VCB)</option>
                      <option value="970415" selected>VietinBank (CTG)</option>
                      <option value="970407">Techcombank (TCB)</option>
                      <option value="970418">BIDV</option>
                      <option value="970422">MB Bank</option>
                      <option value="970416">ACB</option>
                      <option value="970403">Sacombank</option>
                      <option value="970423">TPBank</option>
                      <option value="970405">Agribank</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-stone-500 uppercase mb-1">Số tài khoản nhận</label>
                    <input type="text" id="acc-input" class="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none focus:border-stone-500" value="1029384756" placeholder="Nhập số tài khoản...">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-stone-500 uppercase mb-1">Tên chủ tài khoản (Không dấu)</label>
                    <input type="text" id="holder-input" class="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none focus:border-stone-500" value="CONG TY VIBEHUE" placeholder="Nhập tên chủ tài khoản...">
                  </div>
                  <p class="text-[10px] text-stone-400 italic">
                    * Bạn có thể nhập số tài khoản thực của bạn ở trên để quét QR chuyển khoản thực tế. Cấu hình được lưu tự động.
                  </p>
                </div>
              </div>

              <!-- VietQR image container -->
              <div class="flex flex-col items-center gap-3 bg-[#FCF9F2] p-6 rounded-xl border border-stone-200/80 shadow-inner w-full">
                <span class="text-[10px] font-bold text-stone-500 tracking-wide uppercase">QUÉT MÃ VIETQR ĐỂ CHUYỂN KHOẢN</span>
                <div class="bg-white p-3 rounded-lg border border-stone-200 shadow-sm relative">
                  <img id="qr-img" src="" alt="VietQR Code" class="w-48 h-48 transition-all duration-300">
                  <div id="qr-loader" class="absolute inset-0 bg-white/90 flex items-center justify-center hidden">
                    <span class="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></span>
                  </div>
                </div>
                <div class="text-center">
                  <span class="text-xs text-stone-500 block">Người thụ hưởng: <strong id="lbl-holder" class="text-stone-800 uppercase">...</strong></span>
                  <span class="text-xs text-stone-500 block">Tại ngân hàng: <strong id="lbl-bank" class="text-stone-800">...</strong></span>
                </div>
              </div>

              <!-- Complete payment action button -->
              <button id="confirm-btn" class="w-full mt-6 py-4 vh-bg-red vh-bg-red-hover text-white font-bold text-sm tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg">
                <span>TÔI ĐÃ CHUYỂN KHOẢN THÀNH CÔNG</span>
                <span id="spinner" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin hidden"></span>
              </button>
            </div>
          </div>

          <!-- SUCCESS MODAL (HIDDEN BY DEFAULT) -->
          <div id="success-card" class="bg-white rounded-2xl shadow-2xl border vh-border-gold max-w-md w-full p-8 text-center hidden transform scale-95 transition-all duration-300 opacity-0">
            <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-6 border border-emerald-100">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-stone-900 mb-2">Thanh toán thành công!</h2>
            <p class="text-sm text-stone-500 mb-6 leading-relaxed">
              Hệ thống đã xác nhận khoản chuyển tiền cọc trị giá <strong>${amount.toLocaleString('vi-VN')}đ</strong> cho giao dịch <strong>${payment.paymentCode}</strong> hoàn tất thành công.
            </p>
            <a href="vibehue://payment/success" class="w-full py-3.5 vh-bg-red vh-bg-red-hover text-white font-bold text-sm rounded-xl transition inline-flex items-center justify-center shadow-md">
              Xác nhận và quay lại
            </a>
          </div>

          <!-- JAVASCRIPT FOR LIVE UPDATE & API CALL -->
          <script>
            const amount = ${amount};
            const memo = "${memo}";
            const code = "${payment.paymentCode}";

            const bankSelect = document.getElementById('bank-select');
            const accInput = document.getElementById('acc-input');
            const holderInput = document.getElementById('holder-input');
            const qrImg = document.getElementById('qr-img');
            const qrLoader = document.getElementById('qr-loader');
            
            const lblHolder = document.getElementById('lbl-holder');
            const lblBank = document.getElementById('lbl-bank');

            // Toggle Config panel drawer
            const toggleBtn = document.getElementById('toggle-config-btn');
            const configPanel = document.getElementById('config-panel');
            const toggleArrow = document.getElementById('toggle-arrow');
            
            toggleBtn.addEventListener('click', () => {
              const isHidden = configPanel.classList.contains('hidden');
              if (isHidden) {
                configPanel.classList.remove('hidden');
                toggleArrow.textContent = '▲';
              } else {
                configPanel.classList.add('hidden');
                toggleArrow.textContent = '▼';
              }
            });

            // Load saved settings from localStorage
            if (localStorage.getItem('vh_sim_bank')) {
              bankSelect.value = localStorage.getItem('vh_sim_bank');
            }
            if (localStorage.getItem('vh_sim_account')) {
              accInput.value = localStorage.getItem('vh_sim_account');
            }
            if (localStorage.getItem('vh_sim_holder')) {
              holderInput.value = localStorage.getItem('vh_sim_holder');
            }

             function updateQR() {
               qrLoader.classList.remove('hidden');
               const bankBin = bankSelect.value;
               const accountNo = accInput.value.trim() || '1029384756';
               const accountHolder = holderInput.value.trim().toUpperCase() || 'CONG TY VIBEHUE';
               const bankText = bankSelect.options[bankSelect.selectedIndex].text;

               // VietQR API endpoint (use stable img.vietqr.io domain, omit accountName to let the bank app look it up dynamically via Napas)
               const qrUrl = "https://img.vietqr.io/image/" + bankBin + "-" + accountNo + "-compact2.jpg?amount=" + amount + "&addInfo=" + encodeURIComponent(memo);

               qrImg.src = qrUrl;
               lblHolder.textContent = accountHolder;
               lblBank.textContent = bankText;

               // Save settings
               localStorage.setItem('vh_sim_bank', bankBin);
               localStorage.setItem('vh_sim_account', accountNo);
               localStorage.setItem('vh_sim_holder', accountHolder);
             }

            // Listeners
            qrImg.addEventListener('load', () => qrLoader.classList.add('hidden'));
            bankSelect.addEventListener('change', updateQR);
            accInput.addEventListener('input', updateQR);
            holderInput.addEventListener('input', updateQR);

            // Init
            updateQR();

            // Confirm payment API call
            const confirmBtn = document.getElementById('confirm-btn');
            const spinner = document.getElementById('spinner');
            const paymentCard = document.getElementById('payment-card');
            const successCard = document.getElementById('success-card');

            confirmBtn.addEventListener('click', async () => {
              confirmBtn.disabled = true;
              spinner.classList.remove('hidden');

              try {
                const response = await fetch('/payments/checkout/' + code + '/confirm', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                  // Show success card
                  paymentCard.classList.add('hidden');
                  successCard.classList.remove('hidden');
                  setTimeout(() => {
                    successCard.classList.remove('opacity-0', 'scale-95');
                    successCard.classList.add('opacity-100', 'scale-100');
                    // Redirect mobile WebView về deep link thành công
                    window.location.href = 'vibehue://payment/success';
                  }, 800);
                } else {
                  alert('Xác nhận thanh toán thất bại. Vui lòng thử lại!');
                  confirmBtn.disabled = false;
                  spinner.classList.add('hidden');
                }
              } catch (e) {
                console.error(e);
                alert('Có lỗi mạng xảy ra khi gửi yêu cầu xác nhận.');
                confirmBtn.disabled = false;
                spinner.classList.add('hidden');
              }
            });
          </script>
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

