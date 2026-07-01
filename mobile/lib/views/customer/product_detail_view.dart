import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/product.dart';
import '../../models/cart_item.dart';
import '../../providers/cart_provider.dart';
import '../../providers/auth_provider.dart';
import 'checkout_view.dart';

class ProductDetailView extends StatefulWidget {
  final Product product;
  const ProductDetailView({super.key, required this.product});

  @override
  State<ProductDetailView> createState() => _ProductDetailViewState();
}

class _ProductDetailViewState extends State<ProductDetailView> {
  String? _selectedSize;

  @override
  void initState() {
    super.initState();
    if (widget.product.availableSizes.isNotEmpty) {
      _selectedSize = widget.product.availableSizes.first;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final product = widget.product;

    return Scaffold(
      appBar: AppBar(
        title: Text(product.name),
        actions: [
          Consumer<AuthProvider>(
            builder: (context, authProvider, _) {
              final user = authProvider.user;
              if (user == null) return const SizedBox.shrink();
              final isFavorited = user.favorites.any((f) =>
                  f.targetId == product.id && f.targetType == 'PRODUCT');
              return IconButton(
                icon: Icon(
                  isFavorited ? Icons.favorite : Icons.favorite_border,
                  color: isFavorited ? Colors.red : null,
                ),
                onPressed: () {
                  authProvider.toggleFavorite(
                    targetType: 'PRODUCT',
                    targetId: product.id,
                  );
                },
              );
            },
          ),
        ],
      ),


      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Product Image
            AspectRatio(
              aspectRatio: 1,
              child: Hero(
                tag: 'product_image_${product.id}',
                child: Image.network(
                  product.fullImageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: AppColors.primaryTrans,
                    child: const Icon(Icons.image, size: 64, color: AppColors.primary),
                  ),
                ),

              ),
            ),
            
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title and Category
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          product.name,
                          style: theme.textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Chip(
                        label: Text(product.category),
                      )
                    ],
                  ),
                  const SizedBox(height: 12),
                  
                  // Pricing
                  Row(
                    children: [
                      Text(
                        '${product.price.toStringAsFixed(0)}đ',
                        style: theme.textTheme.headlineMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Text(' / ngày', style: TextStyle(color: AppColors.textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Tiền đặt cọc (Deposit): ${product.depositPrice.toStringAsFixed(0)}đ',
                    style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.goldDark),
                  ),
                  const Divider(height: 24),
                  
                  // Description
                  Text(
                    'Mô tả sản phẩm',
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    product.description.isNotEmpty
                        ? product.description
                        : 'Sản phẩm phục trang Áo Dài cổ phong thượng hạng, mang phong vị xưa tôn vinh vẻ đẹp truyền thống của con người Việt Nam. Thích hợp cho các buổi chụp ảnh Cố Đô, lễ hội truyền thống hay lễ cưới hỏi.',
                    style: const TextStyle(height: 1.5, color: AppColors.textSecondary),
                  ),
                  const Divider(height: 24),
                  
                  // Size Selector
                  if (product.availableSizes.isNotEmpty) ...[
                    Text(
                      'Lựa chọn kích cỡ (Size)',
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 12,
                      children: product.availableSizes.map((size) {
                        final isSelected = _selectedSize == size;
                        return ChoiceChip(
                          label: Text(size),
                          selected: isSelected,
                          selectedColor: AppColors.primaryTrans,
                          labelStyle: TextStyle(
                            color: isSelected ? AppColors.primary : AppColors.textSecondary,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                          onSelected: (val) {
                            if (val) {
                              setState(() {
                                _selectedSize = size;
                              });
                            }
                          },
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    context.read<CartProvider>().addItem(
                      product,
                      _selectedSize ?? 'M',
                      'ĐỎ ĐÔ',
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Đã thêm phục trang vào giỏ hàng!'),
                        duration: Duration(seconds: 2),
                      ),
                    );
                  },
                  icon: const Icon(Icons.add_shopping_cart, color: AppColors.primary),
                  label: const Text('THÊM GIỎ HÀNG'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: const BorderSide(color: AppColors.primary, width: 1.5),
                    foregroundColor: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => CheckoutView(
                          cartItems: [
                            CartItem(
                              product: product,
                              selectedSize: _selectedSize ?? 'M',
                              selectedColor: 'ĐỎ ĐÔ',
                            )
                          ],
                        ),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text('ĐẶT LỊCH NGAY'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}