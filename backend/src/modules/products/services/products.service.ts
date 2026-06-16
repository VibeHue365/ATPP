import { Injectable } from '@nestjs/common';
import { ProductsRepository } from '../repositories/products.repository';
import { ProductDocument } from '../schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async getAllActiveProducts(): Promise<ProductDocument[]> {
    return this.productsRepository.findAllActive();
  }
}
