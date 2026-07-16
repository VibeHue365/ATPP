import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { QueryCategoriesDto } from '../dto/category.dto';
import { CategoriesService } from '../services/categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  findAll(@Query() query: QueryCategoriesDto) {
    return this.categoriesService.findPublic(query);
  }

  @Get(':identifier')
  @Header('Cache-Control', 'public, max-age=60')
  findByIdentifier(@Param('identifier') identifier: string) {
    return this.categoriesService.findPublicByIdentifier(identifier);
  }
}
