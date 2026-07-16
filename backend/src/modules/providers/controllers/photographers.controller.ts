import { Controller, Get, Param, Query } from '@nestjs/common';
import { PhotographersService } from '../services/photographers.service';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';

@Controller('api/photographers')
export class PhotographersController {
  constructor(private readonly photographersService: PhotographersService) {}

  @Get()
  async findAll(): Promise<any[]> {
    return this.photographersService.findAll();
  }

  @Get(':id/packages')
  async findPackages(@Param('id') id: string): Promise<PhotographyPackage[]> {
    return this.photographersService.findPackages(id);
  }

  @Get(':id/availability')
  async findAvailability(
    @Param('id') id: string,
    @Query('date') date: string,
  ): Promise<{ date: string; timeRanges: Array<{ start: string; end: string }> }> {
    return this.photographersService.findAvailability(id, date);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<any> {
    return this.photographersService.findOne(id);
  }
}
