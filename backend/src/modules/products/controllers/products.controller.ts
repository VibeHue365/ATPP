import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../services/products.service';
import { ProductDocument } from '../schemas/product.schema';
import { PhotographyPackageDocument } from '../schemas/photography-package.schema';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getAll(): Promise<ProductDocument[]> {
    return this.productsService.getAllActiveProducts();
  }

  @Get('photography-packages')
  async getPhotographyPackages(): Promise<PhotographyPackageDocument[]> {
    return this.productsService.getAllActivePhotographyPackages();
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ProductDocument> {
    const product = await this.productsService.getProductById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }
}
