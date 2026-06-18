import { Injectable } from '@nestjs/common';
import { ProductsRepository } from '../repositories/products.repository';
import { ProductDocument } from '../schemas/product.schema';
import { PhotographyPackageDocument } from '../schemas/photography-package.schema';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async getAllActiveProducts(): Promise<ProductDocument[]> {
    return this.productsRepository.findAllActive();
  }

  async getAllActivePhotographyPackages(): Promise<PhotographyPackageDocument[]> {
    return this.productsRepository.findAllActivePhotographyPackages();
  }

  async getProductById(id: string): Promise<ProductDocument | null> {
    return this.productsRepository.findById(id);
  }
}
