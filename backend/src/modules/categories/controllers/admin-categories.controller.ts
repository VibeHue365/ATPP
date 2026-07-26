import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  CreateCategoryDto,
  QueryCategoriesDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
} from '../dto/category.dto';
import { CategoriesService } from '../services/categories.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Permissions('category:read')
  findAll(@Query() query: QueryCategoriesDto) {
    return this.categoriesService.findAdmin(query);
  }

  @Post()
  @Permissions('category:manage')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCategoryDto,
    @Req() request: RequestMeta,
  ) {
    return this.categoriesService.create(user.sub, dto, this.context(request));
  }

  @Patch('reorder')
  @Permissions('category:manage')
  reorder(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderCategoriesDto,
    @Req() request: RequestMeta,
  ) {
    return this.categoriesService.reorder(user.sub, dto, this.context(request));
  }

  @Get(':id')
  @Permissions('category:read')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findAdminById(id);
  }

  @Patch(':id/status')
  @Permissions('category:manage')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryStatusDto,
    @Req() request: RequestMeta,
  ) {
    return this.categoriesService.updateStatus(
      user.sub,
      id,
      dto,
      this.context(request),
    );
  }

  @Patch(':id')
  @Permissions('category:manage')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() request: RequestMeta,
  ) {
    return this.categoriesService.update(user.sub, id, dto, this.context(request));
  }

  @Delete(':id')
  @Permissions('category:manage')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() request: RequestMeta,
  ) {
    return this.categoriesService.softDelete(user.sub, id, this.context(request));
  }

  private context(request: RequestMeta): {
    ipAddress?: string;
    userAgent?: string;
  } {
    const userAgent = request.headers['user-agent'];

    return {
      ipAddress: request.ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}
