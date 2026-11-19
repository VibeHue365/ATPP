import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  constructor(
    private readonly errorMessage: string = 'ID sản phẩm không hợp lệ',
  ) {}

  transform(value: string): string {
    if (
      !value ||
      typeof value !== 'string' ||
      !Types.ObjectId.isValid(value) ||
      !/^[0-9a-fA-F]{24}$/.test(value)
    ) {
      throw new BadRequestException(this.errorMessage);
    }
    return value;
  }
}
