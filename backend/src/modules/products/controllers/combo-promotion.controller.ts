import {
  Body,
  Controller,
  Delete,
  Patch,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import {
  ComboPromotionService,
  CreateComboPromotionDto,
  UpdateComboPromotionDto,
} from '../services/combo-promotion.service';
import { ComboPromotionStatus } from '../schemas/combo-promotion.schema';
import {
  Provider,
  ProviderCapability,
  ProviderDocument,
} from '../../providers/schemas/provider.schema';

@Controller('combo-promotions')
export class ComboPromotionController {
  constructor(
    private readonly comboService: ComboPromotionService,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
  ) {}

  private async getProviderForUser(
    userIdStr: string,
    email: string,
  ): Promise<ProviderDocument> {
    const userId = new Types.ObjectId(userIdStr);
    const provider = await this.providerModel.findOne({ userId });
    if (!provider) {
      throw new Error('Provider not found for this user');
    }
    return provider;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateComboPromotionDto,
  ) {
    const provider = await this.getProviderForUser(user.sub, user.email);
    return this.comboService.create(provider._id.toString(), dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyComboPromotions(@CurrentUser() user: AuthUser) {
    const provider = await this.getProviderForUser(user.sub, user.email);
    return this.comboService.findByProvider(provider._id.toString());
  }

  @Get('public')
  async getPublicCombos() {
    return this.comboService.findActivePublic();
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  async getAllForAdmin(@CurrentUser() user: AuthUser) {
    if (!user.roles?.some((role) => role.toUpperCase() === 'ADMIN')) throw new ForbiddenException('Admin only');
    return this.comboService.findAllForAdmin();
  }

  @Patch('admin/:id/moderation')
  @UseGuards(JwtAuthGuard)
  async moderate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'REJECTED' }) {
    if (!user.roles?.some((role) => role.toUpperCase() === 'ADMIN')) throw new ForbiddenException('Admin only');
    return this.comboService.moderate(id, body.status === 'ACTIVE' ? ComboPromotionStatus.Active : ComboPromotionStatus.Rejected);
  }

  @Get(':id')
  async getComboById(@Param('id') id: string) {
    return this.comboService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateComboPromotionDto,
  ) {
    const provider = await this.getProviderForUser(user.sub, user.email);
    return this.comboService.update(id, provider._id.toString(), dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const provider = await this.getProviderForUser(user.sub, user.email);
    await this.comboService.delete(id, provider._id.toString());
    return { success: true };
  }
}
