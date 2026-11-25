import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from './parse-object-id.pipe';

describe('ParseObjectIdPipe', () => {
  it('returns valid 24-hex-character ObjectId string unchanged', () => {
    const pipe = new ParseObjectIdPipe();
    const validId = new Types.ObjectId().toHexString();
    expect(pipe.transform(validId)).toBe(validId);
  });

  it('throws BadRequestException for malformed object id with default message', () => {
    const pipe = new ParseObjectIdPipe();
    expect(() => pipe.transform('not-an-object-id')).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform('not-an-object-id')).toThrow(
      'ID sản phẩm không hợp lệ',
    );
  });

  it('throws BadRequestException with custom error message', () => {
    const pipe = new ParseObjectIdPipe('ID nhà cung cấp không hợp lệ');
    expect(() => pipe.transform('invalid-id')).toThrow(
      'ID nhà cung cấp không hợp lệ',
    );
  });

  it('throws BadRequestException for 12-byte ascii strings that are not 24 hex characters', () => {
    const pipe = new ParseObjectIdPipe();
    expect(() => pipe.transform('123456789012')).toThrow(BadRequestException);
  });

  it('throws BadRequestException for empty or non-string values', () => {
    const pipe = new ParseObjectIdPipe();
    expect(() => pipe.transform('')).toThrow(BadRequestException);
    expect(() => pipe.transform(null as any)).toThrow(BadRequestException);
    expect(() => pipe.transform(undefined as any)).toThrow(BadRequestException);
    expect(() => pipe.transform(12345 as any)).toThrow(BadRequestException);
  });
});
