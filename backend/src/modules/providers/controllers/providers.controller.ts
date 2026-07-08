import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ProvidersService } from '../services/providers.service';
import { ProviderCapability } from '../schemas/provider.schema';

export class UpdateProviderProfileDto {
  @IsString()
  @IsOptional()
  businessName?: string;

  @IsArray()
  @IsEnum(ProviderCapability, { each: true })
  @IsOptional()
  capabilities?: ProviderCapability[];

  @IsOptional()
  contact?: {
    email: string;
    phone: string;
    website?: string | null;
  };

  @IsOptional()
  address?: {
    addressLine: string;
    ward?: string | null;
    district?: string | null;
    city?: string | null;
  };

  @IsOptional()
  policies?: {
    cancellationPolicy?: string | null;
    rentalPolicy?: string | null;
  };

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  comboDiscountPercent?: number;
}

export class AddPortfolioImageDto {
  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}

export class RecurringScheduleDto {
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsArray()
  workingHours: Array<{ start: string; end: string }>;
}

export class SpecificDateScheduleDto {
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsBoolean()
  isOffDay: boolean;

  @IsArray()
  customSlots: Array<{ timeSlot: string; status: string }>;
}

@Controller('providers')
@UseGuards(JwtAuthGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) { }

  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.providersService.getOrCreateProvider(
      user.sub,
      user.email,
      user.email.split('@')[0],
    );
  }

  @Get('me/analytics')
  async getAnalytics(@CurrentUser() user: AuthUser) {
    return this.providersService.getProviderAnalytics(user.sub);
  }


  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProviderProfileDto,
  ) {
    return this.providersService.updateProfile(user.sub, dto);
  }

  @Post('me/portfolio')
  async addPortfolio(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddPortfolioImageDto,
  ) {
    return this.providersService.addPortfolioImage(user.sub, dto.imageUrl);
  }

  @Delete('me/portfolio')
  async removePortfolio(
    @CurrentUser() user: AuthUser,
    @Query('imageUrl') imageUrl: string,
  ) {
    return this.providersService.removePortfolioImage(user.sub, imageUrl);
  }

  @Get('me/schedules')
  async getSchedules(@CurrentUser() user: AuthUser) {
    return this.providersService.getSchedules(user.sub);
  }

  @Post('me/schedules/recurring')
  async updateRecurring(
    @CurrentUser() user: AuthUser,
    @Body() dto: RecurringScheduleDto,
  ) {
    return this.providersService.updateRecurringSchedule(
      user.sub,
      dto.dayOfWeek,
      dto.workingHours,
    );
  }

  @Post('me/schedules/specific-date')
  async updateSpecificDate(
    @CurrentUser() user: AuthUser,
    @Body() dto: SpecificDateScheduleDto,
  ) {
    return this.providersService.updateSpecificDateSchedule(
      user.sub,
      dto.date,
      dto.isOffDay,
      dto.customSlots,
    );
  }
}
