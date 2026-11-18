import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HeritageSpotsService } from '../services/heritage-spots.service';
import { QueryHeritageSpotsDto } from '../dto/query-heritage-spots.dto';
import { HeritageSpot } from '../schemas/heritage-spot.schema';

@ApiTags('Heritage Spots (Di tích Cố đô Huế)')
@Controller(['heritage-spots', 'api/heritage-spots', 'api/v1/heritage-spots'])
export class HeritageSpotsController {
  constructor(private readonly heritageSpotsService: HeritageSpotsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách di tích Huế (hỗ trợ tìm điểm gần nhất theo tọa độ GPS $near)',
    description:
      'Trả về danh sách di tích có lọc theo tọa độ lat, lng, bán kính radiusKm, loại không gian (OUTDOOR, SEMI_INDOOR, INDOOR_STUDIO) và từ khóa.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách di tích di sản Huế',
    type: [HeritageSpot],
  })
  async findAll(@Query() query: QueryHeritageSpotsDto): Promise<HeritageSpot[]> {
    return this.heritageSpotsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết một di tích theo ID',
    description: 'Lấy thông tin chi tiết di tích: giờ mở cửa, giá vé tham quan, bối cảnh và phụ phí di chuyển chuẩn.',
  })
  @ApiParam({ name: 'id', description: 'Mã định danh MongoDB ObjectId của di tích' })
  @ApiResponse({ status: 200, description: 'Chi tiết di tích', type: HeritageSpot })
  @ApiResponse({ status: 404, description: 'Không tìm thấy di tích' })
  async findById(@Param('id') id: string): Promise<HeritageSpot> {
    return this.heritageSpotsService.findById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Xem chi tiết một di tích theo Slug thân thiện URL',
    description: 'Ví dụ: /heritage-spots/slug/cung-an-dinh hoặc /dai-noi-hue',
  })
  @ApiParam({ name: 'slug', description: 'Chuỗi định danh thân thiện URL (slug)' })
  @ApiResponse({ status: 200, description: 'Chi tiết di tích', type: HeritageSpot })
  @ApiResponse({ status: 404, description: 'Không tìm thấy di tích' })
  async findBySlug(@Param('slug') slug: string): Promise<HeritageSpot> {
    return this.heritageSpotsService.findBySlug(slug);
  }
}
