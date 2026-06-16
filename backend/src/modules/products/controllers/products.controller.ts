import { Controller, Get } from '@nestjs/common';
import { ProductsService } from '../services/products.service';
import { ProductDocument } from '../schemas/product.schema';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getAll(): Promise<ProductDocument[]> {
    return this.productsService.getAllActiveProducts();
  }
}
