import 'package:flutter/material.dart';
import '../models/cart_item.dart';
import '../models/product.dart';

class CartProvider extends ChangeNotifier {
  final List<CartItem> _items = [];

  List<CartItem> get items => List.unmodifiable(_items);

  int get totalItemsCount => _items.fold(0, (sum, item) => sum + item.quantity);

  double get subTotal => _items.fold(0.0, (sum, item) {
    if (item.rentalType == 'HOURLY') {
      final sh = int.parse((item.startTime ?? '08:00').split(':').first);
      final eh = int.parse((item.endTime ?? '10:00').split(':').first);
      final hours = (eh - sh) > 0 ? (eh - sh) : 2;
      final hourlyRate = item.product.hourlyRate;
      return sum + (hourlyRate * hours * item.quantity);
    } else {
      final days = item.endDate.difference(item.startDate).inDays;
      final rentalDays = days > 0 ? days : 1;
      return sum + (item.product.price * rentalDays * item.quantity);
    }
  });

  double get depositTotal => _items.fold(0.0, (sum, item) => sum + (item.product.depositPrice * item.quantity));

  double get grandTotal => subTotal + depositTotal;

  void addItem(
    Product product,
    String size,
    String color, {
    int quantity = 1,
    required String rentalType,
    required DateTime startDate,
    required DateTime endDate,
    String? startTime,
    String? endTime,
  }) {
    // Check if item with same config already exists in cart
    final existingIndex = _items.indexWhere((item) =>
        item.product.id == product.id &&
        item.selectedSize == size &&
        item.selectedColor == color &&
        item.rentalType == rentalType &&
        item.startDate.year == startDate.year &&
        item.startDate.month == startDate.month &&
        item.startDate.day == startDate.day &&
        item.endDate.year == endDate.year &&
        item.endDate.month == endDate.month &&
        item.endDate.day == endDate.day &&
        item.startTime == startTime &&
        item.endTime == endTime);

    if (existingIndex >= 0) {
      _items[existingIndex].quantity += quantity;
    } else {
      _items.add(CartItem(
        product: product,
        selectedSize: size,
        selectedColor: color,
        quantity: quantity,
        rentalType: rentalType,
        startDate: startDate,
        endDate: endDate,
        startTime: startTime,
        endTime: endTime,
      ));
    }
    notifyListeners();
  }

  void removeItem(CartItem item) {
    _items.remove(item);
    notifyListeners();
  }

  void updateQuantity(CartItem item, int newQuantity) {
    if (newQuantity <= 0) {
      removeItem(item);
      return;
    }
    final index = _items.indexOf(item);
    if (index >= 0) {
      _items[index].quantity = newQuantity;
      notifyListeners();
    }
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}
