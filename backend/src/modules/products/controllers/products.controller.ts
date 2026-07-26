import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  NotFoundException,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UnsupportedMediaTypeException,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsService } from '../services/products.service';
import { ProductDocument } from '../schemas/product.schema';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PublicMediaService } from '../../storage/services/public-media.service';
import { ProductAvailabilityService } from '../services/product-availability.service';

@Controller(['products', 'api/products'])
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly publicMedia: PublicMediaService,
    private readonly availabilityService: ProductAvailabilityService,
  ) {}

  @Get()
  async getAll(
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minRating') minRating?: string,
    @Query('colors') colors?: string,
    @Query('sizes') sizes?: string,
    @Query('materials') materials?: string,
    @Query('categoryId') categoryId?: string,
    @Query('styleCategoryIds') styleCategoryIds?: string,
    @Query('eventCategoryIds') eventCategoryIds?: string,
    @Query('providerId') providerId?: string,
  ): Promise<any[]> {
    const options = {
      search,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
      colors: colors ? colors.split(',').map(c => c.trim()).filter(Boolean) : undefined,
      sizes: sizes ? sizes.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      materials: materials ? materials.split(',').map(m => m.trim()).filter(Boolean) : undefined,
      categoryId,
      styleCategoryIds: styleCategoryIds?.split(',').map((id) => id.trim()).filter(Boolean),
      eventCategoryIds: eventCategoryIds?.split(',').map((id) => id.trim()).filter(Boolean),
      providerId,
    };
    return this.productsService.getAllActiveProducts(options);
  }

  @Get('store-info/:providerId')
  async getStoreInfo(@Param('providerId') providerId: string): Promise<any> {
    return this.productsService.getPublicProviderProfile(providerId);
  }

  @Get('categories')
  async getCategories(): Promise<any[]> {
    return this.productsService.getCategories();
  }

  @Get('featured')
  async getFeatured(@Query('limit') limit?: string): Promise<any[]> {
    const parsedLimit = Number.parseInt(limit || '8', 10);
    return this.productsService.getFeaturedProducts(
      Number.isFinite(parsedLimit) ? parsedLimit : 8,
    );
  }

  @Get(':id/availability')
  async getAvailability(@Param('id') id: string, @Query('size') size: string, @Query('color') color: string, @Query('rentalFrom') rentalFrom: string, @Query('rentalTo') rentalTo: string, @Query('quantity') quantity?: string, @Query('rentalType') rentalType?: string, @Query('startTime') startTime?: string, @Query('endTime') endTime?: string) {
    return this.availabilityService.check(id, size, color, rentalFrom, rentalTo, quantity ? Number(quantity) : 1, rentalType, startTime, endTime);
  }

  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  async getMyProducts(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sizes') sizes?: string,
    @Query('colors') colors?: string,
  ): Promise<any> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.productsService.getMyProducts(user.sub, search, sortBy, pageNum, limitNum, sizes, colors);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDocument> {
    return this.productsService.createProduct(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDocument> {
    return this.productsService.updateProduct(user.sub, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.productsService.deleteProduct(user.sub, id);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              'Only jpg, png, and webp images are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
      storage: memoryStorage(),
    }),
  )
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    const uploads = await Promise.all(
      (files || []).map((file) => this.publicMedia.uploadImage('products', file)),
    );
    return { urls: uploads.map((upload) => upload.url) };
  }

  @Post('upload-videos')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('videos', 2, {
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              'Only mp4, webm, and mov videos are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
      storage: memoryStorage(),
    }),
  )
  async uploadVideos(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    const uploads = await Promise.all(
      (files || []).map((file) => this.publicMedia.uploadVideo('products', file)),
    );
    return { urls: uploads.map((upload) => upload.url) };
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<any> {
    const product = await this.productsService.getProductById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }
}

