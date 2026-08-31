import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GeocodingService, type NominatimResult } from './geocoding.service';

@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly service: GeocodingService) {}

  @Get('search')
  search(@Query('q') query?: string): Promise<NominatimResult[]> {
    const normalized = query?.trim();
    if (!normalized || normalized.length < 2 || normalized.length > 200) {
      throw new BadRequestException('Địa chỉ tìm kiếm không hợp lệ.');
    }
    return this.service.search(normalized);
  }
}
