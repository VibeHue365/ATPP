import { Types } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ao dai Hue',
    categoryId: new Types.ObjectId().toString(),
    basePrice: 500000,
    depositAmount: 100000,
    ...overrides,
  };
}

async function errorFields(
  overrides: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(
    plainToInstance(CreateProductDto, payload(overrides)),
  );
  return errors.map((error) => error.property).sort();
}

describe('CreateProductDto (UC-16 Add AoDai, UC-19 Set Costume Deposit)', () => {
  it('UT-16 UTCID10 accepts ten images and rejects the eleventh image', async () => {
    const images = Array.from(
      { length: 11 },
      (_, index) => `https://cdn.test/${index}.jpg`,
    );

    await expect(errorFields({ images: images.slice(0, 10) })).resolves.toEqual(
      [],
    );
    await expect(errorFields({ images })).resolves.toEqual(['images']);
  });

  it('UT-16 UTCID11 enforces three custom tags of 2 to 30 characters', async () => {
    await expect(
      errorFields({ customTags: ['ab', 'x'.repeat(30), 'Nang tho'] }),
    ).resolves.toEqual([]);
    await expect(errorFields({ customTags: ['a'] })).resolves.toEqual([
      'customTags',
    ]);
    await expect(
      errorFields({ customTags: ['x'.repeat(31)] }),
    ).resolves.toEqual(['customTags']);
    await expect(
      errorFields({ customTags: ['Mot', 'Hai', 'Ba', 'Bon'] }),
    ).resolves.toEqual(['customTags']);
  });

  it('UT-16 UTCID12 rejects a negative rental price and a malformed category id', async () => {
    await expect(
      errorFields({ basePrice: -1, categoryId: 'category-1' }),
    ).resolves.toEqual(['basePrice', 'categoryId']);
  });

  it('UT-19 UTCID05 rejects a negative deposit amount', async () => {
    await expect(errorFields({ depositAmount: -1 })).resolves.toEqual([
      'depositAmount',
    ]);
    await expect(errorFields({ depositAmount: 0 })).resolves.toEqual([]);
  });
});
