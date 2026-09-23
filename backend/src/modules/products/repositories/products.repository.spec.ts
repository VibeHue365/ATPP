import { ProductCustomTagStatus } from '../schemas/product.schema';
import { ProductsRepository } from './products.repository';

describe('ProductsRepository public custom-tag search', () => {
  it('matches only approved custom tags in public search', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const queryBuilder: any = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec,
    };
    const productModel = {
      find: jest.fn().mockReturnValue(queryBuilder),
    };
    const providerModel = {
      find: jest.fn().mockReturnValue({
        distinct: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    const repository = new ProductsRepository(
      productModel as any,
      providerModel as any,
    );

    await repository.findAllActive({ search: 'nàng thơ' });

    const query = productModel.find.mock.calls[0][0];
    expect(query.$or).toEqual(
      expect.arrayContaining([
        {
          customTags: {
            $elemMatch: {
              status: ProductCustomTagStatus.Approved,
              label: expect.any(RegExp),
            },
          },
        },
      ]),
    );
    const customTagCondition = query.$or.find(
      (condition: any) => condition.customTags,
    );
    expect(customTagCondition.customTags.$elemMatch.label.test('Nàng thơ')).toBe(
      true,
    );
  });
});
