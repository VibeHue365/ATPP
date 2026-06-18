import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ProductsService } from '../services/products.service';
import { ProductDocument } from '../schemas/product.schema';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getAll(): Promise<ProductDocument[]> {
    return this.productsService.getAllActiveProducts();
  }

  @Get('categories')
  async getCategories(): Promise<any[]> {
    return this.productsService.getCategories();
  }

  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  async getMyProducts(@CurrentUser() user: AuthUser): Promise<ProductDocument[]> {
    return this.productsService.getMyProducts(user.sub);
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
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const productDestination = join(process.cwd(), 'uploads', 'products');
          if (!existsSync(productDestination)) {
            mkdirSync(productDestination, { recursive: true });
          }
          callback(null, productDestination);
        },
        filename: (_request, file, callback) => {
          const safeExt = extname(file.originalname).toLowerCase() || '.jpg';
          callback(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`,
          );
        },
      }),
    }),
  )
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    const urls = (files || []).map(file => `/uploads/products/${file.filename}`);
    return { urls };
  }
}

