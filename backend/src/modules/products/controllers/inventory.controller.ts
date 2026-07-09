import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from '../services/inventory.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CreateInventoryItemDto } from '../dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from '../dto/update-inventory-item.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventory(
    @CurrentUser() user: AuthUser,
    @Query('productId') productId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('conditionStatus') conditionStatus?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.inventoryService.getInventory(user.sub, productId, search, status, conditionStatus, sortBy, pageNum, limitNum);
  }

  @Get('summary')
  async getInventorySummary(@CurrentUser() user: AuthUser) {
    return this.inventoryService.getInventorySummary(user.sub);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryService.createInventoryItems(user.sub, dto);
  }

  @Patch(':itemId')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateInventoryItem(user.sub, itemId, dto);
  }

  @Delete(':itemId')
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
  ) {
    return this.inventoryService.deleteInventoryItem(user.sub, itemId);
  }
}
