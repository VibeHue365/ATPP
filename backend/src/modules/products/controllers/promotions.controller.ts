import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ForbiddenException,
  BadRequestException,
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
  ProviderStatus,
} from '../../providers/schemas/provider.schema';
import { DiscountType } from '../schemas/promotion.schema';

import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt-auth.guard';
import { GetApplicablePromotionsDto } from '../dto/get-applicable-promotions.dto';

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

  @IsNumber()
  @IsOptional()
  usageLimitPerUser?: number;

  @IsString()
  @IsOptional()
  audience?: 'ALL' | 'NEW_CUSTOMER';

  @IsOptional()
  applicableBookingTypes?: string[];

  @IsOptional()
  requiredTiers?: string[];

  @IsOptional()
  @IsString()
  providerId?: string | null;
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
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
  ) {}

  private validateRolesForPromotion(user: AuthUser): { isAdmin: boolean } {
    const roles = (user.roles || []).map((r) => r.toUpperCase());
    const isAdmin = roles.includes('ADMIN');
    const isProvider = roles.includes('PROVIDER');

    if (!isAdmin && !isProvider) {
      throw new ForbiddenException(
        'Chỉ nhà cung cấp hoặc Quản trị viên mới có quyền tạo và quản lý mã ưu đãi.',
      );
    }
    return { isAdmin };
  }

  private async getActiveProviderForUser(userIdStr: string): Promise<any> {
    const userId = new Types.ObjectId(userIdStr);
    const provider = await this.providerModel
      .findOne({
        userId,
        status: ProviderStatus.Active,
      })
      .exec();
    if (!provider) {
      throw new ForbiddenException(
        'Tài khoản đối tác chưa được kích hoạt hoặc chưa hoàn tất phê duyệt.',
      );
    }
    return provider;
  }

  private validateFinancialGuardrails(
    dto: Partial<CreatePromotionDto>,
    isAdmin: boolean,
  ) {
    if (dto.discountType === DiscountType.Percentage) {
      if (dto.discountValue != null && dto.discountValue > 70 && !isAdmin) {
        throw new BadRequestException('Mức chiết khấu theo phần trăm tối đa là 70%.');
      }
      if (dto.discountValue != null && dto.discountValue <= 0) {
        throw new BadRequestException('Mức chiết khấu phải lớn hơn 0.');
      }
      if (dto.maxDiscountAmount != null && dto.maxDiscountAmount <= 0) {
        throw new BadRequestException('Mức giảm tối đa (maxDiscountAmount) phải lớn hơn 0.');
      }
    }
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      if (end <= start) {
        throw new BadRequestException('Ngày kết thúc mã giảm giá phải sau ngày bắt đầu.');
      }
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePromotionDto) {
    const { isAdmin } = this.validateRolesForPromotion(user);
    this.validateFinancialGuardrails(dto, isAdmin);

    let providerIdStr: string | null = null;
    if (isAdmin) {
      providerIdStr = dto.providerId || null;
    } else {
      const provider = await this.getActiveProviderForUser(user.sub);
      providerIdStr = provider._id.toString();
    }

    return this.promotionsService.createPromotion(providerIdStr, dto);
  }

  @Get('provider')
  @UseGuards(JwtAuthGuard)
  async getProviderVouchers(@CurrentUser() user: AuthUser) {
    const { isAdmin } = this.validateRolesForPromotion(user);
    if (isAdmin) {
      return this.promotionsService.getAllPromotions();
    }
    const provider = await this.getActiveProviderForUser(user.sub);
    return this.promotionsService.getProviderPromotions(
      provider._id.toString(),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { isAdmin } = this.validateRolesForPromotion(user);
    let providerIdStr: string | undefined = undefined;

    if (!isAdmin) {
      const provider = await this.getActiveProviderForUser(user.sub);
      providerIdStr = provider._id.toString();
    }

    await this.promotionsService.deletePromotion(id, providerIdStr);
    return { success: true };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePromotionDto>,
  ) {
    const { isAdmin } = this.validateRolesForPromotion(user);
    this.validateFinancialGuardrails(dto, isAdmin);

    let providerIdStr: string | undefined = undefined;
    if (!isAdmin) {
      const provider = await this.getActiveProviderForUser(user.sub);
      providerIdStr = provider._id.toString();
    }

    return this.promotionsService.updatePromotion(id, providerIdStr, dto);
  }

  @Get('public')
  async getPublicPromotions(@Query('tier') tier?: string) {
    return this.promotionsService.getPublicPromotions(tier);
  }

  @Get('provider-promotions/:providerId')
  async getPromotionsByProvider(@Param('providerId') providerId: string) {
    return this.promotionsService.getProviderPromotions(providerId);
  }

  @Post('applicable')
  @UseGuards(OptionalJwtAuthGuard)
  async getApplicable(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: GetApplicablePromotionsDto,
  ) {
    let userContext:
      | { customerId?: Types.ObjectId; isNewCustomer?: boolean }
      | undefined;
    if (user?.sub) {
      userContext = { customerId: new Types.ObjectId(user.sub) };
    }
    return this.promotionsService.getApplicablePromotions(dto, userContext);
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
