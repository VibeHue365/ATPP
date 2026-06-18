import { Controller, Get, Param } from '@nestjs/common';
import { PhotographersService } from '../services/photographers.service';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';

@Controller('api/photographers')
export class PhotographersController {
  constructor(private readonly photographersService: PhotographersService) {}

  @Get()
  async findAll(): Promise<any[]> {
    return this.photographersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<any> {
    return this.photographersService.findOne(id);
  }

  @Get(':id/packages')
  async findPackages(@Param('id') id: string): Promise<PhotographyPackage[]> {
    return this.photographersService.findPackages(id);
  }
}

