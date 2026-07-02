import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/constants/colors.dart';
import '../../models/product.dart';
import '../../models/cart_item.dart';
import '../../models/review.dart';
import '../../providers/cart_provider.dart';
import '../../providers/user_chat_provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import 'checkout_view.dart';
import 'chat_view.dart';

class ProductDetailView extends StatefulWidget {
  final Product product;
  const ProductDetailView({super.key, required this.product});

  @override
  State<ProductDetailView> createState() => _ProductDetailViewState();
}

class _ProductDetailViewState extends State<ProductDetailView> {
  String? _selectedSize;
  String? _selectedColor;

  // Rental Config State
  String _rentalType = 'DAILY';
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  DateTime _endDate = DateTime.now().add(const Duration(days: 2));
  DateTime _hourlyDate = DateTime.now().add(const Duration(days: 1));
  String _startTime = '07:00';
  String _endTime = '09:00';
  
  final List<Map<String, String>> _productSlots = const [
    {'start': '07:00', 'end': '09:00', 'label': '07:00 - 09:00'},
    {'start': '09:00', 'end': '11:00', 'label': '09:00 - 11:00'},
    {'start': '11:00', 'end': '13:00', 'label': '11:00 - 13:00'},
    {'start': '13:00', 'end': '15:00', 'label': '13:00 - 15:00'},
    {'start': '15:00', 'end': '17:00', 'label': '15:00 - 17:00'},
    {'start': '17:00', 'end': '19:00', 'label': '17:00 - 19:00'},
    {'start': '19:00', 'end': '21:00', 'label': '19:00 - 21:00'},
  ];

  List<String> _busyDates = [];
  List<Map<String, dynamic>> _busySlots = [];
  bool _isBusyLoading = true;

  int get _rentalDays => _endDate.difference(_startDate).inDays > 0
      ? _endDate.difference(_startDate).inDays
      : 1;

  int get _rentalHours {
    try {
      final sh = int.parse(_startTime.split(':').first);
      final eh = int.parse(_endTime.split(':').first);
      return (eh - sh) > 0 ? (eh - sh) : 2;
    } catch (_) {
      return 2;
    }
  }

  double get _computedSubTotal {
    if (_rentalType == 'DAILY') {
      return widget.product.price * _rentalDays;
    } else {
      return widget.product.hourlyRate * _rentalHours;
    }
  }

  // Feedback State
  List<Review> _reviews = [];
  bool _isReviewsLoading = true;

  @override
  void initState() {
    super.initState();
    if (widget.product.availableSizes.isNotEmpty) {
      _selectedSize = widget.product.availableSizes.first;
    }
    if (widget.product.availableColors.isNotEmpty) {
      _selectedColor = widget.product.availableColors.first;
    } else {
      _selectedColor = 'TRẮNG'; // Mặc định nếu db trống màu
    }
    _loadReviews();
    _loadBusyDates();
  }

  Future<void> _loadBusyDates() async {
    try {
      final apiService = ApiService();
      final data = await apiService.getProductBusyDates(widget.product.id);
      setState(() {
        _busyDates = List<String>.from(data['bookedDates'] ?? []);
        _busySlots = List<Map<String, dynamic>>.from(
          (data['bookedSlots'] ?? []).map((x) => Map<String, dynamic>.from(x))
        );
        _isBusyLoading = false;
        
        _autoSelectFirstAvailableSlot();
      });
    } catch (_) {
      setState(() {
        _isBusyLoading = false;
      });
    }
  }

  void _autoSelectFirstAvailableSlot() {
    for (final block in _productSlots) {
      if (!_isSlotBusy(block)) {
        _startTime = block['start']!;
        _endTime = block['end']!;
        return;
      }
    }
    _startTime = '07:00';
    _endTime = '09:00';
  }

  bool _isSlotBusy(Map<String, String> block) {
    final dateStr = '${_hourlyDate.year}-${_hourlyDate.month.toString().padLeft(2, '0')}-${_hourlyDate.day.toString().padLeft(2, '0')}';
    
    if (_busyDates.contains(dateStr)) {
      return true;
    }
    
    final slotStr = '${block['start']}-${block['end']}';
    for (final booked in _busySlots) {
      if (booked['date'] == dateStr && booked['timeSlot'] != null) {
        if (_checkTimeOverlap(slotStr, booked['timeSlot'])) {
          return true;
        }
      }
    }
    
    final now = DateTime.now();
    final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    if (dateStr == todayStr) {
      final startParts = block['start']!.split(':');
      final sh = int.parse(startParts[0]);
      final sm = int.parse(startParts[1]);
      if (sh < now.hour || (sh == now.hour && sm <= now.minute)) {
        return true;
      }
    }
    
    return false;
  }

  bool _checkTimeOverlap(String slot1, String slot2) {
    try {
      // Format: "07:00-15:00" — sử dụng indexOf để tìm dấu "-" đầu tiên sau "HH:MM"
      int _parseStart(String s) {
        final idx = s.indexOf('-');
        return int.parse(s.substring(0, idx).split(':')[0]);
      }
      int _parseEnd(String s) {
        final idx = s.indexOf('-');
        return int.parse(s.substring(idx + 1).split(':')[0]);
      }

      final s1 = _parseStart(slot1);
      final e1 = _parseEnd(slot1);
      final s2 = _parseStart(slot2);
      final e2 = _parseEnd(slot2);

      return s1 < e2 && s2 < e1;
    } catch (e) {
      return false;
    }
  }

  void _handleSlotClick(int index) {
    final block = _productSlots[index];
    if (_isSlotBusy(block)) return;

    final currentStartIdx = _productSlots.indexWhere((s) => s['start'] == _startTime);
    final currentEndIdx = _productSlots.indexWhere((s) => s['end'] == _endTime);

    setState(() {
      if (currentStartIdx == -1 || currentStartIdx != currentEndIdx || index < currentStartIdx) {
        _startTime = block['start']!;
        _endTime = block['end']!;
      } else {
        bool hasBusyInRange = false;
        for (int i = currentStartIdx; i <= index; i++) {
          if (_isSlotBusy(_productSlots[i])) {
            hasBusyInRange = true;
            break;
          }
        }
        
        if (hasBusyInRange) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Khoảng thời gian chọn chứa khung giờ đã bận hoặc đã qua!')),
          );
          _startTime = block['start']!;
          _endTime = block['end']!;
        } else {
          _endTime = block['end']!;
        }
      }
    });
  }

  Future<void> _loadReviews() async {
    try {
      final apiService = ApiService();
      final reviews = await apiService.getReviewsForItem(widget.product.id);
      setState(() {
        _reviews = reviews;
        _isReviewsLoading = false;
      });
    } catch (e) {
      setState(() {
        _isReviewsLoading = false;
      });
    }
  }

  void _showLoginRequiredDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Yêu cầu đăng nhập',
          style: GoogleFonts.playfairDisplay(fontWeight: FontWeight.bold, color: AppColors.primary),
        ),
        content: const Text(
          'Quý khách cần đăng nhập tài khoản để thực hiện xem lịch sử đặt thuê và gửi đánh giá sản phẩm.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ĐÓNG', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Vui lòng quay lại màn hình tài khoản để đăng nhập.')),
              );
            },
            child: const Text('ĐỒNG Ý', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _startReviewFlow() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      _showLoginRequiredDialog();
      return;
    }

    // Show Loading Dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
    );

    try {
      final apiService = ApiService();
      final bookings = await apiService.getMyBookings();
      
      if (!mounted) return;
      Navigator.pop(context); // Close loading dialog

      // Check if user has rented this product before
      bool hasRentedBefore = false;
      for (final booking in bookings) {
        for (final item in booking.items) {
          if (item.productId == widget.product.id) {
            hasRentedBefore = true;
            break;
          }
        }
      }

      if (!hasRentedBefore) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(
              'Chưa thể đánh giá',
              style: GoogleFonts.playfairDisplay(fontWeight: FontWeight.bold, color: AppColors.primary),
            ),
            content: const Text(
              'Quý khách chưa từng thuê sản phẩm này. Hãy đặt lịch trải nghiệm trang phục để gửi đánh giá nhé!',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('ĐỒNG Ý', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
        return;
      }

      // Find any booking item containing this product that has NOT been reviewed yet
      Map<String, dynamic>? targetBookingAndItem;
      for (final booking in bookings) {
        for (final item in booking.items) {
          if (item.productId == widget.product.id) {
             final alreadyReviewed = _reviews.any((r) => 
               r.bookingItemId == item.id || 
               (r.bookingId == booking.id && (
                 r.customerId == auth.user?.id || 
                 r.customerName == auth.user?.name || 
                 (auth.user?.profile?.fullName != null && r.customerName == auth.user!.profile!.fullName)
               ))
             );
            
            if (!alreadyReviewed) {
              targetBookingAndItem = {
                'bookingId': booking.id,
                'bookingItemId': item.id,
              };
              break;
            }
          }
        }
        if (targetBookingAndItem != null) break;
      }

      if (targetBookingAndItem == null) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(
              'Đã gửi đánh giá',
              style: GoogleFonts.playfairDisplay(fontWeight: FontWeight.bold, color: AppColors.primary),
            ),
            content: const Text(
              'Quý khách đã gửi đánh giá cho tất cả các đơn đặt thuê sản phẩm này rồi. Cảm ơn sự ủng hộ và phản hồi nhiệt tình của quý khách!',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('ĐỒNG Ý', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
        return;
      }

      // Open the Rating Dialog
      _showAddReviewDialog(
        targetBookingAndItem['bookingId']!,
        targetBookingAndItem['bookingItemId']!,
      );
    } catch (e) {
      if (mounted) {
        Navigator.pop(context); // Close loading dialog
        final errStr = e.toString().toLowerCase();
        if (errStr.contains('unauthorized') || errStr.contains('login') || errStr.contains('session')) {
          _showLoginRequiredDialog();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng hoặc đăng nhập lại.'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
  }

  void _showAddReviewDialog(String bookingId, String bookingItemId) {
    int rating = 5;
    final commentController = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setStateDialog) => AlertDialog(
          title: Text(
            'Đánh giá phục trang',
            style: GoogleFonts.playfairDisplay(fontWeight: FontWeight.bold, color: AppColors.primary),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.product.name,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (index) {
                  final starVal = index + 1;
                  return IconButton(
                    icon: Icon(
                      starVal <= rating ? Icons.star : Icons.star_border,
                      color: AppColors.gold,
                      size: 32,
                    ),
                    onPressed: isSubmitting ? null : () {
                      setStateDialog(() {
                        rating = starVal;
                      });
                    },
                  );
                }),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: commentController,
                maxLines: 3,
                enabled: !isSubmitting,
                decoration: const InputDecoration(
                  hintText: 'Nhập bình luận đánh giá của bạn...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.all(10),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
              child: const Text('HỦY BỎ'),
            ),
            ElevatedButton(
              onPressed: isSubmitting ? null : () async {
                setStateDialog(() {
                  isSubmitting = true;
                });

                try {
                  await ApiService().createReview({
                    'bookingId': bookingId,
                    'bookingItemId': bookingItemId,
                    'rating': rating,
                    'comment': commentController.text.trim(),
                    'productId': widget.product.id,
                  });
                  
                  if (ctx.mounted) {
                    Navigator.pop(ctx); // Close the dialog
                  }
                  
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Cảm ơn bạn đã gửi đánh giá!'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                  
                  _loadReviews(); // Reload reviews list dynamically!
                } catch (e) {
                  setStateDialog(() {
                    isSubmitting = false;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Lỗi gửi đánh giá: $e'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              child: isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Text('GỬI ĐÁNH GIÁ', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final product = widget.product;

    return Scaffold(
      appBar: AppBar(
        title: Text(product.name),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.primary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
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
                            fontSize: 20,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Chip(
                        label: Text(product.category),
                        backgroundColor: AppColors.primaryTrans,
                        labelStyle: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                      )
                    ],
                  ),
                  const SizedBox(height: 12),
                  
                  // Pricing
                  Row(
                    children: [
                      Text(
                        _rentalType == 'DAILY'
                            ? '${product.price.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]}.')}đ'
                            : '${product.hourlyRate.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]}.')}đ',
                        style: theme.textTheme.headlineMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        _rentalType == 'DAILY' ? ' / ngày' : ' / giờ',
                        style: const TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Tiền đặt cọc giữ đồ: ${product.depositPrice.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]}.')}đ',
                    style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.goldDark),
                  ),
                  const Divider(height: 24),
                  
                  // Description
                  Text(
                    'Mô tả sản phẩm',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
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
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 12,
                      children: product.availableSizes.map((size) {
                        final isSelected = _selectedSize == size;
                        return ChoiceChip(
                          label: Text(size),
                          selected: isSelected,
                          selectedColor: AppColors.primary,
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            side: BorderSide(color: isSelected ? AppColors.primary : Colors.grey.shade300),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppColors.textSecondary,
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
                    const SizedBox(height: 16),
                  ],

                  // Color Selector
                  if (product.availableColors.isNotEmpty) ...[
                    Text(
                      'Lựa chọn màu sắc',
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 12,
                      children: product.availableColors.map((color) {
                        final isSelected = _selectedColor == color;
                        return ChoiceChip(
                          label: Text(color.toUpperCase()),
                          selected: isSelected,
                          selectedColor: AppColors.primary,
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            side: BorderSide(color: isSelected ? AppColors.primary : Colors.grey.shade300),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppColors.textSecondary,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                          onSelected: (val) {
                            if (val) {
                              setState(() {
                                _selectedColor = color;
                              });
                            }
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),
                  ],

                  const SizedBox(height: 12),
                  const Text(
                    'Hình thức thuê',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  
                  // Rental Type Switcher Tab
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _rentalType = 'DAILY'),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: _rentalType == 'DAILY' ? AppColors.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                'Thuê Theo Ngày',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: _rentalType == 'DAILY' ? Colors.white : AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _rentalType = 'HOURLY'),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: _rentalType == 'HOURLY' ? AppColors.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                'Thuê Theo Giờ',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: _rentalType == 'HOURLY' ? Colors.white : AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Selection details card depending on rental mode
                  if (_rentalType == 'DAILY') ...[
                    Card(
                      elevation: 0,
                      color: Colors.white,
                      shape: RoundedRectangleBorder(
                        side: BorderSide(color: Colors.grey.shade200),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: ListTile(
                        leading: const Icon(Icons.calendar_today, color: AppColors.primary),
                        title: const Text('Chọn thời gian thuê', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        subtitle: Text(
                          'Từ ${_startDate.day}/${_startDate.month} đến ${_endDate.day}/${_endDate.month} (${_rentalDays} ngày)',
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () async {
                          final picked = await showDateRangePicker(
                            context: context,
                            firstDate: DateTime.now(),
                            lastDate: DateTime.now().add(const Duration(days: 90)),
                            initialDateRange: DateTimeRange(start: _startDate, end: _endDate),
                          );
                          if (picked != null) {
                            setState(() {
                              _startDate = picked.start;
                              _endDate = picked.end;
                            });
                          }
                        },
                      ),
                    ),
                  ] else ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Choose date
                          InkWell(
                            onTap: () async {
                              final picked = await showDatePicker(
                                context: context,
                                initialDate: _hourlyDate,
                                firstDate: DateTime.now(),
                                lastDate: DateTime.now().add(const Duration(days: 90)),
                              );
                              if (picked != null) {
                                setState(() {
                                  _hourlyDate = picked;
                                  _autoSelectFirstAvailableSlot();
                                });
                              }
                            },
                            child: Row(
                              children: [
                                const Icon(Icons.today, color: AppColors.primary),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('Ngày thuê theo giờ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${_hourlyDate.day}/${_hourlyDate.month}/${_hourlyDate.year}',
                                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.arrow_drop_down, color: AppColors.textSecondary),
                              ],
                            ),
                          ),
                          const Divider(height: 24),
                          
                          const Text(
                            'Khung giờ hoạt động (Chọn các block liên tiếp)',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 12),
                          
                          if (_isBusyLoading)
                            const Center(child: CircularProgressIndicator(color: AppColors.primary))
                          else
                            GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio: 3.2,
                                crossAxisSpacing: 8,
                                mainAxisSpacing: 8,
                              ),
                              itemCount: _productSlots.length,
                              itemBuilder: (context, index) {
                                final block = _productSlots[index];
                                final isBusy = _isSlotBusy(block);
                                
                                final startIdx = _productSlots.indexWhere((s) => s['start'] == _startTime);
                                final endIdx = _productSlots.indexWhere((s) => s['end'] == _endTime);
                                final isSelected = !isBusy && startIdx != -1 && endIdx != -1 && index >= startIdx && index <= endIdx;

                                return InkWell(
                                  onTap: isBusy ? null : () => _handleSlotClick(index),
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: isBusy 
                                          ? Colors.grey.shade200 
                                          : (isSelected ? AppColors.primary : Colors.white),
                                      border: Border.all(
                                        color: isBusy 
                                            ? Colors.transparent 
                                            : (isSelected ? AppColors.primary : Colors.grey.shade300),
                                      ),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      block['label']!,
                                      style: TextStyle(
                                        color: isBusy 
                                            ? Colors.grey.shade400 
                                            : (isSelected ? Colors.white : AppColors.textPrimary),
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                        fontSize: 12,
                                        decoration: isBusy ? TextDecoration.lineThrough : null,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  
                  // Calculated SubTotal breakdown banner
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primaryTrans,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _rentalType == 'DAILY'
                              ? 'Tạm tính (Thuê ${_rentalDays} ngày):'
                              : 'Tạm tính (Thuê ${_rentalHours} tiếng):',
                          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary, fontSize: 13),
                        ),
                        Text(
                          '${_computedSubTotal.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]}.')}đ',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 16),
                        ),
                      ],
                    ),
                  ),

                  const Divider(height: 24),

                  // Feedback & Reviews Section
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Đánh giá & Phản hồi',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          if (!_isReviewsLoading && _reviews.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(Icons.star, color: Colors.amber, size: 16),
                                const SizedBox(width: 4),
                                Text(
                                  '${(_reviews.fold<double>(0.0, (sum, r) => sum + r.rating) / _reviews.length).toStringAsFixed(1)} / 5',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                                Text(' (${_reviews.length} đánh giá)', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                              ],
                            ),
                          ],
                        ],
                      ),
                      TextButton.icon(
                        icon: const Icon(Icons.rate_review_outlined, size: 16, color: AppColors.primary),
                        label: const Text('Viết đánh giá', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13)),
                        onPressed: _startReviewFlow,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  if (_isReviewsLoading)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(16.0),
                        child: CircularProgressIndicator(color: AppColors.primary),
                      ),
                    )
                  else if (_reviews.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16.0),
                      child: Center(
                        child: Text(
                          'Chưa có đánh giá nào cho sản phẩm này.',
                          style: TextStyle(color: AppColors.textSecondary, fontStyle: FontStyle.italic),
                        ),
                      ),
                    )
                  else
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _reviews.length,
                      itemBuilder: (context, index) {
                        final r = _reviews[index];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Customer Header Row
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 18,
                                    backgroundImage: r.customerAvatar != null ? NetworkImage(r.customerAvatar!) : null,
                                    backgroundColor: AppColors.primaryTrans,
                                    child: r.customerAvatar == null
                                        ? const Icon(Icons.person, size: 18, color: AppColors.primary)
                                        : null,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(r.customerName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                        Row(
                                          children: List.generate(5, (starIdx) {
                                            return Icon(
                                              starIdx < r.rating ? Icons.star : Icons.star_border,
                                              color: Colors.amber,
                                              size: 14,
                                            );
                                          }),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '${r.createdAt.day}/${r.createdAt.month}/${r.createdAt.year}',
                                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                  )
                                ],
                              ),
                              const SizedBox(height: 8),
                              // Comment
                              Text(r.comment, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                              
                              // Provider Reply
                              if (r.reply != null && r.reply!.isNotEmpty) ...[
                                const SizedBox(height: 10),
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade100,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.grey.shade200),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Row(
                                        children: [
                                          Icon(Icons.reply, size: 14, color: AppColors.gold),
                                          SizedBox(width: 4),
                                          Text(
                                            'Phản hồi từ Nhà cung cấp:',
                                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AppColors.goldDark),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        r.reply!,
                                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
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
              if (product.providerUserId != null) ...[
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.primary, width: 1.5),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.chat_bubble_outline, color: AppColors.primary),
                    onPressed: () async {
                      final otherUserId = product.providerUserId!;

                      // Show loading spinner
                      showDialog(
                        context: context,
                        barrierDismissible: false,
                        builder: (_) => const Center(
                          child: CircularProgressIndicator(color: AppColors.primary),
                        ),
                      );

                      try {
                        final chatProvider = context.read<UserChatProvider>();
                        final roomId = await chatProvider.startChat(otherUserId);

                        if (context.mounted) {
                          Navigator.pop(context); // dismiss loading spinner
                          chatProvider.enterRoom(roomId);
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ChatView(
                                roomId: roomId,
                                otherParticipantName: 'Chủ tiệm',
                              ),
                            ),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          Navigator.pop(context); // dismiss loading spinner
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Không thể mở chat: $e')),
                          );
                        }
                      }
                    },
                  ),
                ),
              ],
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    if (_isCurrentSelectionBusy()) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Khung giờ đã chọn chứa thời gian bận. Vui lòng chọn khung giờ khác!'),
                          backgroundColor: Colors.red,
                        ),
                      );
                      return;
                    }
                    context.read<CartProvider>().addItem(
                      product,
                      _selectedSize ?? 'M',
                      _selectedColor ?? 'TRẮNG',
                      rentalType: _rentalType,
                      startDate: _rentalType == 'DAILY' ? _startDate : _hourlyDate,
                      endDate: _rentalType == 'DAILY' ? _endDate : _hourlyDate,
                      startTime: _rentalType == 'HOURLY' ? _startTime : null,
                      endTime: _rentalType == 'HOURLY' ? _endTime : null,
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
                    if (_isCurrentSelectionBusy()) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Khung giờ đã chọn chứa thời gian bận. Vui lòng chọn khung giờ khác!'),
                          backgroundColor: Colors.red,
                        ),
                      );
                      return;
                    }
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => CheckoutView(
                          cartItems: [
                            CartItem(
                              product: product,
                              selectedSize: _selectedSize ?? 'M',
                              selectedColor: _selectedColor ?? 'TRẮNG',
                              rentalType: _rentalType,
                              startDate: _rentalType == 'DAILY' ? _startDate : _hourlyDate,
                              endDate: _rentalType == 'DAILY' ? _endDate : _hourlyDate,
                              startTime: _rentalType == 'HOURLY' ? _startTime : null,
                              endTime: _rentalType == 'HOURLY' ? _endTime : null,
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

  bool _isCurrentSelectionBusy() {
    if (_rentalType != 'HOURLY') return false;
    final startIdx = _productSlots.indexWhere((s) => s['start'] == _startTime);
    final endIdx = _productSlots.indexWhere((s) => s['end'] == _endTime);
    if (startIdx == -1 || endIdx == -1) return true;
    for (int i = startIdx; i <= endIdx; i++) {
      if (_isSlotBusy(_productSlots[i])) {
        return true;
      }
    }
    return false;
  }
}