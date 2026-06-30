import 'package:flutter/material.dart';
import '../models/cart_item.dart';
import '../models/product.dart';

class CartProvider extends ChangeNotifier {
  final List<CartItem> _items = [];

  List<CartItem> get items => List.unmodifiable(_items);

  int get totalItemsCount => _items.fold(0, (sum, item) => sum + item.quantity);

  double get subTotal => _items.fold(0.0, (sum, item) => sum + (item.product.price * item.quantity));

  double get depositTotal => _items.fold(0.0, (sum, item) => sum + (item.product.depositPrice * item.quantity));

  double get grandTotal => subTotal + depositTotal;

  void addItem(Product product, String size, String color, {int quantity = 1}) {
    // Check if item with same product, size, and color already exists in cart
    final existingIndex = _items.indexWhere((item) =>
        item.product.id == product.id &&
        item.selectedSize == size &&
        item.selectedColor == color);

    if (existingIndex >= 0) {
      _items[existingIndex].quantity += quantity;
    } else {
      _items.add(CartItem(
        product: product,
        selectedSize: size,
        selectedColor: color,
        quantity: quantity,
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
