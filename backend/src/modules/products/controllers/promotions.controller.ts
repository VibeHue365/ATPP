import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { PromotionsService } from '../services/promotions.service';
import {
  Provider,
  ProviderCapability,
  ProviderDocument,
} from '../../providers/schemas/provider.schema';
import { DiscountType } from '../schemas/promotion.schema';

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  @Min(0)
  discountValue: number;

  @IsNumber()
  @IsOptional()
  maxDiscountAmount?: number;

  @IsNumber()
  @Min(0)
  minOrderValue: number;

  @IsNumber()
  @IsOptional()
  usageLimit?: number;

  @IsString()
  @IsNotEmpty()
  startDate: string;

  @IsString()
  @IsNotEmpty()
  endDate: string;
}

export class ValidatePromotionDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @Min(0)
  orderValue: number;

  @IsNotEmpty()
  providerIds: string[];
}

@Controller('promotions')
@UseGuards(JwtAuthGuard)
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
  ) {}

  private async getProviderForUser(
    userIdStr: string,
    email: string,
  ): Promise<ProviderDocument> {
    const userId = new Types.ObjectId(userIdStr);
    let provider = await this.providerModel.findOne({ userId });
    if (!provider) {
      provider = await this.providerModel.create({
        userId,
        businessName: `${email.split('@')[0]} Heritage Studio`,
        capabilities: [
          ProviderCapability.AoDaiRental,
          ProviderCapability.Photography,
        ],
        contact: { email, phone: '0901234567' },
        address: {
          addressLine: '123 Phố Huế, Quận Hai Bà Trưng',
          city: 'Hà Nội',
        },
      });
    }
    return provider;
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePromotionDto) {
    const provider = await this.getProviderForUser(user.sub, user.email);
    return this.promotionsService.createPromotion(provider._id.toString(), dto);
  }

  @Get('provider')
  async getProviderVouchers(@CurrentUser() user: AuthUser) {
    const provider = await this.getProviderForUser(user.sub, user.email);
    return this.promotionsService.getProviderPromotions(
      provider._id.toString(),
    );
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const provider = await this.getProviderForUser(user.sub, user.email);
    await this.promotionsService.deletePromotion(id, provider._id.toString());
    return { success: true };
  }

  @Post('validate')
  async validate(@Body() dto: ValidatePromotionDto) {
    const promotion = await this.promotionsService.validatePromotion(
      dto.code,
      dto.orderValue,
      dto.providerIds,
    );

    return {
      id: promotion._id,
      code: promotion.code,
      name: promotion.name,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      maxDiscountAmount: promotion.maxDiscountAmount,
    };
  }
}
