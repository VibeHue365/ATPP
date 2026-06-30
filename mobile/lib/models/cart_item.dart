import 'product.dart';

class CartItem {
  final Product product;
  final String selectedSize;
  final String selectedColor;
  int quantity;

  CartItem({
    required this.product,
    required this.selectedSize,
    required this.selectedColor,
    this.quantity = 1,
  });

  Map<String, dynamic> toJson() {
    return {
      'product': product.toJson(),
      'selectedSize': selectedSize,
      'selectedColor': selectedColor,
      'quantity': quantity,
    };
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      product: Product.fromJson(json['product']),
      selectedSize: json['selectedSize'] ?? 'M',
      selectedColor: json['selectedColor'] ?? 'Đỏ Đô',
      quantity: json['quantity'] ?? 1,
    );
  }
}
