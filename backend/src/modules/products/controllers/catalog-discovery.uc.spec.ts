import { AiController } from '../../ai/controllers/ai.controller';
import { PhotographersController } from '../../photographers/controllers/photographers.controller';
import { ProductsController } from './products.controller';
import { ComboPromotionController } from './combo-promotion.controller';

describe('Catalog, discovery and AI direct use-case contracts', () => {
  const provider = { sub: 'provider-1', email: 'shop@example.com', roles: ['PROVIDER'] } as any;

  const productController = (service: any) => new ProductsController(service, {} as any, {} as any, {} as any);
  const customer = { sub: 'customer-1', email: 'customer@example.com', roles: ['CUSTOMER'] } as any;
  const aiController = (service: any) => {
    const rateLimit = { assertRateLimit: jest.fn().mockResolvedValue(undefined) };
    return { controller: new AiController(service, rateLimit as any), rateLimit };
  };

  it('UC-18 deletes a provider-owned Ao Dai product', async () => {
    const service = { deleteProduct: jest.fn().mockResolvedValue({ message: 'Product deleted' }) };
    const controller = productController(service);
    await controller.delete(provider, 'product-1');
    expect(service.deleteProduct).toHaveBeenCalledWith('provider-1', 'product-1');
  });

  it('UC-19 persists the configured costume damage deposit', async () => {
    const service = { updateProduct: jest.fn().mockResolvedValue({ depositAmount: 500000 }) };
    const controller = productController(service);
    const dto = { depositAmount: 500000 } as any;
    await controller.update(provider, 'product-1', dto);
    expect(service.updateProduct).toHaveBeenCalledWith('provider-1', 'product-1', dto);
  });

  it('UC-21 sends lower and upper budget boundaries to product discovery', async () => {
    const service = { getAllActiveProducts: jest.fn().mockResolvedValue([]) };
    const controller = productController(service);
    await controller.getAll(undefined, '300000', '900000');
    expect(service.getAllActiveProducts).toHaveBeenCalledWith(expect.objectContaining({ minPrice: 300000, maxPrice: 900000 }));
  });

  it('UC-22 sends Ao Dai search, color, size, location and rating filters', async () => {
    const service = { getActiveProductsPage: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = productController(service);
    await controller.getAll('lụa đỏ', undefined, undefined, '4', 'red,pink', 'M,L', undefined, undefined, undefined, undefined, undefined, 'Hue', 'AO_DAI', '2', '12', 'rating_desc');
    expect(service.getActiveProductsPage).toHaveBeenCalledWith(expect.objectContaining({ search: 'lụa đỏ', minRating: 4, colors: ['red', 'pink'], sizes: ['M', 'L'], providerLocation: 'Hue', productTypes: ['AO_DAI'] }), 2, 12, 'rating_desc');
  });

  it('UC-23 delegates photographer style, rating, location and price filters', async () => {
    const service = { findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new PhotographersController(service as any, {} as any, {} as any);
    const query = { concept: 'vintage', minRating: 4, location: 'Hue', minPrice: 500000, maxPrice: 2000000, page: 1, limit: 12 } as any;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('UC-24 returns the available photography concepts', async () => {
    const service = { findConcepts: jest.fn().mockResolvedValue([{ code: 'VINTAGE', name: 'Vintage' }]) };
    const controller = new PhotographersController(service as any, {} as any, {} as any);
    await expect(controller.findConcepts()).resolves.toEqual([{ code: 'VINTAGE', name: 'Vintage' }]);
  });

  it('UC-28 returns active provider combo candidates', async () => {
    const service = { findActivePublic: jest.fn().mockResolvedValue([{ id: 'combo-1', discountPercent: 10 }]) };
    const controller = new ComboPromotionController(service as any, {} as any);
    await expect(controller.getPublicCombos()).resolves.toEqual([{ id: 'combo-1', discountPercent: 10 }]);
    expect(service.findActivePublic).toHaveBeenCalledTimes(1);
  });

  it('UC-30 submits an image to the visual-match service', async () => {
    const service = { visualMatch: jest.fn().mockResolvedValue([{ productId: 'product-1', score: 0.91 }]) };
    const { controller, rateLimit } = aiController(service);
    const payload = { image_base64: 'base64-image', mime_type: 'image/jpeg' };
    await controller.visualMatch(customer, payload);
    expect(rateLimit.assertRateLimit).toHaveBeenCalledWith('ai_match_customer-1', 20, 60);
    expect(service.visualMatch).toHaveBeenCalledWith(payload);
  });

  it('UC-30 supports image-assisted chat with product recommendations', async () => {
    const service = { chatWithImage: jest.fn().mockResolvedValue({ answer: 'Mẫu tương tự', recommended_products: ['product-1'] }) };
    const { controller, rateLimit } = aiController(service);
    await controller.chatWithImage(customer, { message: 'Tìm áo tương tự', image_base64: 'base64-image', mime_type: 'image/png' } as any);
    expect(rateLimit.assertRateLimit).toHaveBeenCalledWith('ai_chat_img_customer-1', 10, 60);
    expect(service.chatWithImage).toHaveBeenCalledWith('Tìm áo tương tự', 'base64-image', 'image/png');
  });

  it('UC-31 requests recommendation using budget and concept context', async () => {
    const service = { contextRecommend: jest.fn().mockResolvedValue({ suggested_products: ['product-1'] }) };
    const { controller, rateLimit } = aiController(service);
    const payload = { budget: 1500000, location_context: 'Huế', concept: 'cổ điển' };
    await controller.contextRecommend(customer, payload);
    expect(rateLimit.assertRateLimit).toHaveBeenCalledWith('ai_visual_customer-1', 20, 60);
    expect(service.contextRecommend).toHaveBeenCalledWith(payload);
  });

  it('UC-32 sends consultation questions to the AI chatbot service', async () => {
    const service = { chat: jest.fn().mockResolvedValue({ answer: 'Tiền cọc được hoàn sau đối soát.' }) };
    const { controller, rateLimit } = aiController(service);
    await controller.chat(customer, { message: 'Chính sách hoàn cọc thế nào?' } as any);
    expect(rateLimit.assertRateLimit).toHaveBeenCalledWith('ai_chat_customer-1', 20, 60);
    expect(service.chat).toHaveBeenCalledWith('Chính sách hoàn cọc thế nào?');
  });
});
