import 'product.dart';

class CartItem {
  final Product product;
  final String selectedSize;
  final String selectedColor;
  int quantity;
  
  final String rentalType; // 'DAILY' | 'HOURLY'
  final DateTime startDate;
  final DateTime endDate;
  final String? startTime;
  final String? endTime;

  CartItem({
    required this.product,
    required this.selectedSize,
    required this.selectedColor,
    this.quantity = 1,
    required this.rentalType,
    required this.startDate,
    required this.endDate,
    this.startTime,
    this.endTime,
  });

  Map<String, dynamic> toJson() {
    return {
      'product': product.toJson(),
      'selectedSize': selectedSize,
      'selectedColor': selectedColor,
      'quantity': quantity,
      'rentalType': rentalType,
      'startDate': startDate.toIso8601String(),
      'endDate': endDate.toIso8601String(),
      'startTime': startTime,
      'endTime': endTime,
    };
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      product: Product.fromJson(json['product']),
      selectedSize: json['selectedSize'] ?? 'M',
      selectedColor: json['selectedColor'] ?? 'Đỏ Đô',
      quantity: json['quantity'] ?? 1,
      rentalType: json['rentalType'] ?? 'DAILY',
      startDate: json['startDate'] != null ? DateTime.parse(json['startDate']) : DateTime.now().add(const Duration(days: 1)),
      endDate: json['endDate'] != null ? DateTime.parse(json['endDate']) : DateTime.now().add(const Duration(days: 2)),
      startTime: json['startTime'],
      endTime: json['endTime'],
    );
  }
}
