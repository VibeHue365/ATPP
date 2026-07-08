import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/constants/colors.dart';
import '../../providers/booking_provider.dart';
import '../../models/product.dart';
import 'product_detail_view.dart';

class ProductListingView extends StatefulWidget {
  final String initialCategory;

  const ProductListingView({
    super.key,
    this.initialCategory = 'Tất cả',
  });

  @override
  State<ProductListingView> createState() => _ProductListingViewState();
}

class _ProductListingViewState extends State<ProductListingView> {
  // Search & Filter State
  late String _selectedCategory;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  
  // Sorting State: 'popular' | 'price_asc' | 'price_desc'
  String _currentSort = 'popular';

  // Bottom Sheet Filter State
  RangeValues _priceRange = const RangeValues(100000, 1000000);
  String _selectedSize = 'Tất cả';
  String _selectedColor = 'Tất cả';

  // Set of favorited product IDs
  final Set<String> _favoritedIds = {};

  // Infinite Scroll Simulation State
  final ScrollController _scrollController = ScrollController();
  int _displayedCount = 6;
  bool _isMoreLoading = false;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _selectedCategory = widget.initialCategory;
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 50) {
      _loadMoreProducts();
    }
  }

  void _loadMoreProducts() {
    if (_isMoreLoading || !_hasMore) return;

    setState(() {
      _isMoreLoading = true;
    });

    // Simulate Network Latency
    Future.delayed(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      final totalFiltered = _getFilteredProducts().length;
      setState(() {
        _isMoreLoading = false;
        if (_displayedCount >= totalFiltered) {
          _hasMore = false;
        } else {
          _displayedCount = (_displayedCount + 6).clamp(0, totalFiltered);
          if (_displayedCount >= totalFiltered) {
            _hasMore = false;
          }
        }
      });
    });
  }

  List<Product> _getFilteredProducts() {
    final provider = context.read<BookingProvider>();
    
    // 1. Filtering logic
    var list = provider.products.where((product) {
      final matchesCategory = _selectedCategory == 'Tất cả' ||
          product.category.toLowerCase() == _selectedCategory.toLowerCase();
      final matchesSearch = product.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          product.description.toLowerCase().contains(_searchQuery.toLowerCase());
      
      // Advanced Filters from Bottom Sheet
      final matchesPrice = product.price >= _priceRange.start && product.price <= _priceRange.end;
      
      final matchesSize = _selectedSize == 'Tất cả' || 
          product.availableSizes.any((s) => s.toUpperCase() == _selectedSize.toUpperCase());
          
      final matchesColor = _selectedColor == 'Tất cả' || 
          product.name.toLowerCase().contains(_selectedColor.toLowerCase()) ||
          product.description.toLowerCase().contains(_selectedColor.toLowerCase());

      return matchesCategory && matchesSearch && matchesPrice && matchesSize && matchesColor;
    }).toList();

    // 2. Sorting logic
    if (_currentSort == 'price_asc') {
      list.sort((a, b) => a.price.compareTo(b.price));
    } else if (_currentSort == 'price_desc') {
      list.sort((a, b) => b.price.compareTo(a.price));
    }
    
    return list;
  }

  void _openFilterBottomSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.lightBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Bộ lọc nâng cao',
                        style: GoogleFonts.playfairDisplay(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primaryDark,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textSecondary),
                        onPressed: () => Navigator.pop(context),
                      )
                    ],
                  ),
                  const Divider(color: AppColors.goldLight),
                  const SizedBox(height: 16),

                  // Price range label
                  Text(
                    'Giá thuê / ngày (đ)',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  RangeSlider(
                    values: _priceRange,
                    min: 0,
                    max: 1500000,
                    divisions: 15,
                    activeColor: AppColors.primary,
                    inactiveColor: AppColors.primaryTrans,
                    labels: RangeLabels(
                      '${_priceRange.start.toStringAsFixed(0)}đ',
                      '${_priceRange.end.toStringAsFixed(0)}đ',
                    ),
                    onChanged: (RangeValues values) {
                      setModalState(() {
                        _priceRange = values;
                      });
                      setState(() {});
                    },
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${_priceRange.start.toStringAsFixed(0)}đ', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      Text('${_priceRange.end.toStringAsFixed(0)}đ', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Size filter options
                  const Text(
                    'Chọn kích thước (Size)',
                    style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: ['Tất cả', 'S', 'M', 'L', 'XL'].map((size) {
                      final isSelected = _selectedSize == size;
                      return ChoiceChip(
                        label: Text(size),
                        selected: isSelected,
                        onSelected: (selected) {
                          setModalState(() {
                            _selectedSize = size;
                          });
                          setState(() {});
                        },
                        selectedColor: AppColors.primary,
                        backgroundColor: Colors.white,
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.white : AppColors.textSecondary,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // Color filter options
                  const Text(
                    'Màu sắc cổ phục',
                    style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: ['Tất cả', 'Trắng', 'Đỏ', 'Vàng', 'Hồng'].map((color) {
                      final isSelected = _selectedColor == color;
                      return ChoiceChip(
                        label: Text(color),
                        selected: isSelected,
                        onSelected: (selected) {
                          setModalState(() {
                            _selectedColor = color;
                          });
                          setState(() {});
                        },
                        selectedColor: AppColors.primary,
                        backgroundColor: Colors.white,
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.white : AppColors.textSecondary,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 28),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            setModalState(() {
                              _priceRange = const RangeValues(100000, 1000000);
                              _selectedSize = 'Tất cả';
                              _selectedColor = 'Tất cả';
                            });
                            setState(() {
                              _priceRange = const RangeValues(100000, 1000000);
                              _selectedSize = 'Tất cả';
                              _selectedColor = 'Tất cả';
                            });
                          },
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppColors.primary),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Đặt lại', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _displayedCount = 6;
                              _hasMore = true;
                            });
                            Navigator.pop(context);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Áp dụng', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _openSortBottomSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.lightBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (BuildContext context) {
        return Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Sắp xếp theo',
                style: GoogleFonts.playfairDisplay(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryDark,
                ),
              ),
              const SizedBox(height: 12),
              ListTile(
                title: const Text('Phổ biến nhất'),
                trailing: _currentSort == 'popular' ? const Icon(Icons.check, color: AppColors.primary) : null,
                onTap: () {
                  setState(() {
                    _currentSort = 'popular';
                  });
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('Giá thấp đến cao'),
                trailing: _currentSort == 'price_asc' ? const Icon(Icons.check, color: AppColors.primary) : null,
                onTap: () {
                  setState(() {
                    _currentSort = 'price_asc';
                  });
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('Giá cao đến thấp'),
                trailing: _currentSort == 'price_desc' ? const Icon(Icons.check, color: AppColors.primary) : null,
                onTap: () {
                  setState(() {
                    _currentSort = 'price_desc';
                  });
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredProducts = _getFilteredProducts();
    final itemsToDisplay = filteredProducts.take(_displayedCount).toList();

    return Scaffold(
      backgroundColor: AppColors.lightBg,
      appBar: AppBar(
        backgroundColor: AppColors.lightBg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.primary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        centerTitle: true,
        title: Text(
          'Khám Phá Cổ Phục',
          style: GoogleFonts.playfairDisplay(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: AppColors.primaryDark,
          ),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Search Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8),
            child: Container(
              decoration: BoxDecoration(
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (val) {
                  setState(() {
                    _searchQuery = val;
                    _displayedCount = 6;
                    _hasMore = true;
                  });
                },
                decoration: InputDecoration(
                  hintText: 'Tìm kiếm trang phục...',
                  hintStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                  prefixIcon: const Icon(Icons.search, color: AppColors.primary, size: 20),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, color: AppColors.textSecondary, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _searchQuery = '';
                              _displayedCount = 6;
                              _hasMore = true;
                            });
                          },
                        )
                      : null,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.gold, width: 1.0),
                  ),
                ),
              ),
            ),
          ),

          // 2. Filter & Sort Buttons + Horizontal Quick Category Chips
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8.0),
            child: Column(
              children: [
                // Filter Buttons Row
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  child: Row(
                    children: [
                      // Filter button
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _openFilterBottomSheet,
                          icon: const Icon(Icons.tune_outlined, size: 18, color: AppColors.primary),
                          label: const Text('Bộ lọc', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: Colors.white,
                            side: BorderSide(color: AppColors.gold.withOpacity(0.3)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Sort button
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _openSortBottomSheet,
                          icon: const Icon(Icons.sort_outlined, size: 18, color: AppColors.primary),
                          label: Text(
                            _currentSort == 'popular'
                                ? 'Phổ biến nhất'
                                : _currentSort == 'price_asc'
                                    ? 'Giá tăng dần'
                                    : 'Giá giảm dần',
                            style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                          ),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: Colors.white,
                            side: BorderSide(color: AppColors.gold.withOpacity(0.3)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Quick Category Scroll List
                SizedBox(
                  height: 38,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: ['Tất cả', 'Áo ngũ thân', 'Áo giao lĩnh', 'Áo nhật bình', 'Áo dài truyền thống']
                        .map((category) {
                      final isSelected = _selectedCategory == category;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: ChoiceChip(
                          label: Text(category),
                          selected: isSelected,
                          onSelected: (_) {
                            setState(() {
                              _selectedCategory = category;
                              _displayedCount = 6;
                              _hasMore = true;
                            });
                          },
                          selectedColor: AppColors.primary,
                          backgroundColor: Colors.white,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppColors.textSecondary,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            fontSize: 12,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // Product count text
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Tìm thấy ${filteredProducts.length} sản phẩm',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w500),
                ),
                if (_selectedSize != 'Tất cả' || _selectedColor != 'Tất cả' || _priceRange.start > 100000 || _priceRange.end < 1000000)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primaryTrans,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('Đã lọc', style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.bold)),
                  )
              ],
            ),
          ),

          // 3. Product Grid Layout with Scroll Listener
          Expanded(
            child: itemsToDisplay.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.style_outlined, color: AppColors.gold, size: 48),
                        SizedBox(height: 12),
                        Text('Không tìm thấy phục trang phù hợp', style: TextStyle(color: AppColors.textSecondary)),
                      ],
                    ),
                  )
                : GridView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.72,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 14,
                    ),
                    itemCount: itemsToDisplay.length + (_isMoreLoading ? 1 : 0),
                    itemBuilder: (context, index) {
                      // Render loading spinner for infinite scroll at the bottom
                      if (index == itemsToDisplay.length) {
                        return const Center(
                          child: Padding(
                            padding: EdgeInsets.all(12.0),
                            child: CircularProgressIndicator(color: AppColors.primary),
                          ),
                        );
                      }

                      final product = itemsToDisplay[index];
                      final isFavorited = _favoritedIds.contains(product.id);

                      return Card(
                        color: Colors.white,
                        elevation: 1,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ProductDetailView(product: product),
                              ),
                            );
                          },
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Image and Favorite Heart Overlay
                              Expanded(
                                child: Stack(
                                  children: [
                                    Hero(
                                      tag: 'product_image_${product.id}',
                                      child: Image.network(
                                        product.imageUrl ?? 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=400',
                                        fit: BoxFit.cover,
                                        width: double.infinity,
                                        height: double.infinity,
                                        errorBuilder: (_, __, ___) => Container(
                                          color: AppColors.primaryTrans,
                                          child: const Icon(Icons.image, color: AppColors.primary),
                                        ),
                                      ),
                                    ),
                                    // Heart icon
                                    Positioned(
                                      top: 8,
                                      right: 8,
                                      child: GestureDetector(
                                        onTap: () {
                                          setState(() {
                                            if (isFavorited) {
                                              _favoritedIds.remove(product.id);
                                            } else {
                                              _favoritedIds.add(product.id);
                                            }
                                          });
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text(
                                                isFavorited 
                                                    ? 'Đã xoá khỏi mục yêu thích' 
                                                    : 'Đã thêm vào mục yêu thích'
                                              ),
                                              duration: const Duration(seconds: 1),
                                            ),
                                          );
                                        },
                                        child: CircleAvatar(
                                          radius: 16,
                                          backgroundColor: Colors.white.withOpacity(0.85),
                                          child: Icon(
                                            isFavorited ? Icons.favorite : Icons.favorite_border,
                                            size: 18,
                                            color: isFavorited ? AppColors.primary : AppColors.textSecondary,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              
                              // Product details
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      product.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.playfairDisplay(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${product.price.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]}.')}đ / ngày',
                                      style: const TextStyle(
                                        color: AppColors.primary,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
