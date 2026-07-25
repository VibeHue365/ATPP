import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PhotographersService } from '../services/photographers.service';
import { PhotographerMonthlyAvailabilityService } from '../services/photographer-monthly-availability.service';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';
import { PhotographerDiscoveryQueryDto } from '../dto/photographer-discovery-query.dto';
import { CreatePhotographyQuoteDto } from '../dto/photography-quote.dto';
import { PhotographyQuoteService } from '../services/photography-quote.service';

@Controller(['photographers', 'api/photographers'])
export class PhotographersController {
  constructor(
    private readonly photographersService: PhotographersService,
    private readonly monthlyAvailabilityService: PhotographerMonthlyAvailabilityService,
    private readonly photographyQuoteService: PhotographyQuoteService,
  ) {}

  @Get()
  async findAll(@Query() query: PhotographerDiscoveryQueryDto) {
    return this.photographersService.findAll(query);
  }

  @Get('concepts')
  async findConcepts() {
    return this.photographersService.findConcepts();
  }

  @Get(':id/packages')
  async findPackages(@Param('id') id: string): Promise<PhotographyPackage[]> {
    return this.photographersService.findPackages(id);
  }

  @Get(':id/availability/month')
  async findMonthlyAvailability(
    @Param('id') id: string,
    @Query('month') month: string,
    @Query('packageId') packageId?: string,
  ) {
    return this.monthlyAvailabilityService.findForMonth(id, month, packageId);
  }

  /**
   * Read-only price/availability preview. It never creates a booking or hold.
   */
  @Post(':id/quote')
  async quote(
    @Param('id') id: string,
    @Body() dto: CreatePhotographyQuoteDto,
  ) {
    return this.photographyQuoteService.quote(id, dto);
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
