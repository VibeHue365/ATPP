import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import {
  CreatePhotographyPackageDto,
  UpdatePhotographyPackageDto,
} from '../dto/photography-package.dto';
import { PhotographyPackagesService } from '../services/photography-packages.service';

@Controller('providers/me/photography-packages')
@UseGuards(JwtAuthGuard)
export class ProviderPhotographyPackagesController {
  constructor(
    private readonly photographyPackagesService: PhotographyPackagesService,
  ) {}

  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.photographyPackagesService.listMine(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePhotographyPackageDto) {
    return this.photographyPackagesService.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePhotographyPackageDto,
  ) {
    return this.photographyPackagesService.update(user.sub, id, dto);
  }

  @Post(':id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.photographyPackagesService.publish(user.sub, id);
  }

  @Post(':id/unpublish')
  unpublish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.photographyPackagesService.unpublish(user.sub, id);
  }
}
