import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/product.dart';
import 'package:mobile/providers/cart_provider.dart';

void main() {
  group('CartProvider Unit Tests', () {
    late CartProvider cartProvider;
    late Product sampleProduct;

    setUp(() {
      cartProvider = CartProvider();
      sampleProduct = Product(
        id: 'p1',
        name: 'Áo ngũ thân truyền thống',
        description: 'Mẫu áo cổ phong đẹp',
        price: 150000.0,
        depositPrice: 500000.0,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Áo ngũ thân',
        categoryId: 'cat1',
        providerId: 'prov1',

        availableSizes: ['M', 'L'],
      );
    });

    test('Initial cart should be empty', () {
      expect(cartProvider.items.length, 0);
      expect(cartProvider.totalItemsCount, 0);
      expect(cartProvider.subTotal, 0.0);
      expect(cartProvider.depositTotal, 0.0);
      expect(cartProvider.grandTotal, 0.0);
    });

    test('Add item to cart should update totals', () {
      cartProvider.addItem(sampleProduct, 'M', 'Đỏ Đô', quantity: 2);

      expect(cartProvider.items.length, 1);
      expect(cartProvider.totalItemsCount, 2);
      expect(cartProvider.subTotal, 300000.0); // 150k * 2
      expect(cartProvider.depositTotal, 1000000.0); // 500k * 2
      expect(cartProvider.grandTotal, 1300000.0);
    });

    test('Add identical item should increment quantity', () {
      cartProvider.addItem(sampleProduct, 'M', 'Đỏ Đô', quantity: 1);
      cartProvider.addItem(sampleProduct, 'M', 'Đỏ Đô', quantity: 2);

      expect(cartProvider.items.length, 1);
      expect(cartProvider.totalItemsCount, 3);
      expect(cartProvider.items[0].quantity, 3);
    });

    test('Add same product with different size should create new item', () {
      cartProvider.addItem(sampleProduct, 'M', 'Đỏ Đô', quantity: 1);
      cartProvider.addItem(sampleProduct, 'L', 'Đỏ Đô', quantity: 1);

      expect(cartProvider.items.length, 2);
      expect(cartProvider.totalItemsCount, 2);
    });

    test('Remove item should update list and totals', () {
      cartProvider.addItem(sampleProduct, 'M', 'Đỏ Đô', quantity: 1);
      final item = cartProvider.items[0];
      
      cartProvider.removeItem(item);

      expect(cartProvider.items.length, 0);
      expect(cartProvider.totalItemsCount, 0);
    });

    test('Update quantity should work correctly', () {
      cartProvider.addItem(sampleProduct, 'M', 'Đỏ Đô', quantity: 1);
      final item = cartProvider.items[0];
      
      cartProvider.updateQuantity(item, 5);
      expect(cartProvider.totalItemsCount, 5);

      cartProvider.updateQuantity(item, 0); // 0 or negative should remove item
      expect(cartProvider.items.length, 0);
    });

    test('Clear should empty the cart', () {
      cartProvider.addItem(sampleProduct, 'M', 'Đỏ Đô', quantity: 2);
      expect(cartProvider.items.length, 1);

      cartProvider.clear();
      expect(cartProvider.items.length, 0);
      expect(cartProvider.totalItemsCount, 0);
    });
  });
}
