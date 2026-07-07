import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/constants/colors.dart';
import '../../models/product.dart';
import '../../models/cart_item.dart';
import '../../providers/booking_provider.dart';
import 'customer_dashboard_view.dart';
import '../../models/voucher.dart';
import '../../services/api_service.dart';

class CheckoutView extends StatefulWidget {
  final List<CartItem> cartItems;

  const CheckoutView({
    super.key,
    required this.cartItems,
  });

  @override
  State<CheckoutView> createState() => _CheckoutViewState();
}

class _CheckoutViewState extends State<CheckoutView> {
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  DateTime _endDate = DateTime.now().add(const Duration(days: 2));
  final _voucherController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.cartItems.isNotEmpty) {
      _startDate = widget.cartItems.first.startDate;
      _endDate = widget.cartItems.first.endDate;
    }
  }

  int get rentalDays => _endDate.difference(_startDate).inDays > 0
      ? _endDate.difference(_startDate).inDays
      : 1;

  double get subTotal {
    return widget.cartItems.fold(0.0, (sum, item) {
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
  }

  double get depositTotal => widget.cartItems.fold(0.0, (sum, item) => sum + (item.product.depositPrice * item.quantity));
  double get grandTotal {
    final discount = context.watch<BookingProvider>().voucherDiscount;
    return subTotal + depositTotal - discount;
  }

  @override
  void dispose() {
    _voucherController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _selectDateRange() async {
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
      // Remove voucher if dates change to avoid stale validity
      context.read<BookingProvider>().removeVoucher();
      _voucherController.clear();
    }
  }

  void _showVoucherSelectionBottomSheet() async {
    final apiService = ApiService();
    final providerIds = widget.cartItems.map((item) => item.product.providerId).toSet().toList();
    
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return FutureBuilder<List<Voucher>>(
          future: Future.wait(
            providerIds.map((pid) => apiService.getPromotionsByProvider(pid))
          ).then((value) => value.expand((x) => x).toList()),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const SizedBox(
                height: 300,
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              );
            }
            if (snapshot.hasError) {
              return SizedBox(
                height: 300,
                child: Center(
                  child: Text('Lỗi tải voucher: ${snapshot.error}', style: const TextStyle(color: AppColors.error)),
                ),
              );
            }
            final vouchers = snapshot.data ?? [];
            // Remove duplicates
            final seen = <String>{};
            final uniqueVouchers = vouchers.where((v) => seen.add(v.id)).toList();

            if (uniqueVouchers.isEmpty) {
              return const SizedBox(
                height: 250,
                child: Center(
                  child: Text('Tiệm hiện không có chương trình khuyến mãi nào.'),
                ),
              );
            }

            return Container(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Chọn mã giảm giá của tiệm',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  Flexible(
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: uniqueVouchers.length,
                      itemBuilder: (context, index) {
                        final voucher = uniqueVouchers[index];
                        final isPercentage = voucher.discountType == 'PERCENTAGE';
                        final isApplicable = subTotal >= voucher.minOrderValue;

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          color: isApplicable ? Colors.white : Colors.grey.shade100,
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: isApplicable ? AppColors.primaryTrans : Colors.grey.shade300,
                              child: Icon(
                                Icons.local_offer,
                                color: isApplicable ? AppColors.primary : Colors.grey,
                              ),
                            ),
                            title: Text(
                              voucher.code,
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: isApplicable ? AppColors.primary : Colors.grey,
                              ),
                            ),
                            subtitle: Text(
                              'Giảm: ${voucher.discountValue.toStringAsFixed(0)}${isPercentage ? "%" : "đ"}\nĐơn tối thiểu: ${voucher.minOrderValue.toStringAsFixed(0)}đ',
                              style: TextStyle(fontSize: 12, color: isApplicable ? Colors.black87 : Colors.grey),
                            ),
                            trailing: ElevatedButton(
                              onPressed: isApplicable
                                  ? () {
                                      _voucherController.text = voucher.code;
                                      Navigator.pop(context);
                                      _applyVoucher();
                                    }
                                  : null,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                disabledBackgroundColor: Colors.grey.shade300,
                              ),
                              child: Text(
                                isApplicable ? 'Chọn' : 'Chưa đủ điều kiện',
                                style: const TextStyle(fontSize: 11, color: Colors.white),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _applyVoucher() async {
    if (_voucherController.text.trim().isEmpty) return;
    
    final bp = context.read<BookingProvider>();
    final providerIds = widget.cartItems.map((item) => item.product.providerId).toSet().toList();
    final success = await bp.applyVoucher(
      _voucherController.text.trim(),
      subTotal,
      providerIds,
    );

    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Áp dụng mã giảm giá thành công!')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text(bp.error ?? 'Mã giảm giá không hợp lệ.'),
          ),
        );
      }
    }
  }

  void _checkout() async {
    final bp = context.read<BookingProvider>();
    try {
      final booking = await bp.createMultiItemBooking(
        cartItems: widget.cartItems,
        rentalFrom: _startDate,
        rentalTo: _endDate,
        customRequests: _notesController.text.trim(),
      );

      // Now create payment link for full payment
      final paymentUrl = await bp.getPaymentLink(booking.id, 'FULL_PAYMENT');
      if (paymentUrl.isNotEmpty && mounted) {
        // Open webview
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PayOSWebView(
              paymentUrl: paymentUrl,
              onSuccess: () {
                Navigator.pop(context); // Close webview
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const SuccessScreen()),
                );
              },
              onCancel: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Giao dịch thanh toán bị hủy.')),
                );
                Navigator.pop(context); // Close webview
              },
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text(e.toString()),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bp = context.watch<BookingProvider>();
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Thanh toán đặt lịch'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Selected Products list
            Text('Danh sách phục trang đặt thuê', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...widget.cartItems.map((item) {
              return Card(
                margin: const EdgeInsets.only(bottom: 8.0),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(
                          item.product.imageUrl ?? '',
                          width: 60,
                          height: 60,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            width: 60,
                            height: 60,
                            color: AppColors.primaryTrans,
                            child: const Icon(Icons.image, color: AppColors.primary),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.product.name,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Kích cỡ: ${item.selectedSize} | Màu: ${item.selectedColor} | Số lượng: ${item.quantity}',
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item.rentalType == 'HOURLY'
                                  ? 'Thuê theo giờ: ${item.startDate.day}/${item.startDate.month}/${item.startDate.year} (${item.startTime} - ${item.endTime})'
                                  : 'Thuê theo ngày: ${item.startDate.day}/${item.startDate.month} - ${item.endDate.day}/${item.endDate.month}',
                              style: const TextStyle(fontSize: 11, color: AppColors.goldDark, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item.rentalType == 'HOURLY'
                                  ? '${item.product.hourlyRate.toStringAsFixed(0)}đ / giờ'
                                  : '${item.product.price.toStringAsFixed(0)}đ / ngày',
                              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ],
                        ),
                      )
                    ],
                  ),
                ),
              );
            }).toList(),
            const SizedBox(height: 16),

            // Date picker box (Only editable if all items are DAILY)
            if (widget.cartItems.every((item) => item.rentalType == 'DAILY')) ...[
              Card(
                child: ListTile(
                  leading: const Icon(Icons.calendar_month, color: AppColors.primary),
                  title: const Text('Thời gian thuê (Tất cả sản phẩm)'),
                  subtitle: Text(
                    'Từ ${_startDate.day}/${_startDate.month} đến ${_endDate.day}/${_endDate.month} (${rentalDays} ngày)',
                  ),
                  trailing: const Icon(Icons.edit_calendar),
                  onTap: _selectDateRange,
                ),
              ),
            ] else ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: AppColors.primary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Thời gian đặt thuê cụ thể đã được cấu hình cho từng sản phẩm trong chi tiết đơn hàng.',
                          style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),

            // Color and custom notes
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Thông tin chi tiết thêm', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _notesController,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Ghi chú thêm cho tiệm',
                        hintText: 'Nhập yêu cầu riêng về số đo, phụ kiện đi kèm...',
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Voucher Code
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Khuyến mãi (Voucher)', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _voucherController,
                            decoration: InputDecoration(
                              hintText: 'Mã giảm giá (ví dụ: GIAM20)',
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              suffixIcon: IconButton(
                                icon: const Icon(Icons.loyalty, color: AppColors.primary),
                                tooltip: 'Chọn mã giảm giá',
                                onPressed: _showVoucherSelectionBottomSheet,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: _applyVoucher,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.gold,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          ),
                          child: const Text('ÁP DỤNG'),
                        )
                      ],
                    ),
                    if (bp.appliedVoucher != null) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Đã áp dụng: ${bp.appliedVoucher!.code}',
                            style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.bold),
                          ),
                          TextButton(
                            onPressed: () {
                              bp.removeVoucher();
                              _voucherController.clear();
                            },
                            child: const Text('Gỡ mã', style: TextStyle(color: AppColors.error)),
                          )
                        ],
                      )
                    ]
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Price Details
            // Price Details (Ticket Receipt Style)
            ClipPath(
              clipper: TicketClipper(),
              child: Card(
                elevation: 3,
                margin: EdgeInsets.zero,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 24.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'TÓM TẮT THANH TOÁN', 
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: AppColors.primary,
                          letterSpacing: 1.5,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Giá thuê tạm tính', style: TextStyle(color: AppColors.textSecondary)),
                          Text('${subTotal.toStringAsFixed(0)}đ', style: const TextStyle(fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Tiền cọc đảm bảo', style: TextStyle(color: AppColors.textSecondary)),
                          Text('${depositTotal.toStringAsFixed(0)}đ', style: const TextStyle(fontWeight: FontWeight.w600)),
                        ],
                      ),
                      if (bp.voucherDiscount > 0) ...[
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Giảm giá voucher', style: TextStyle(color: AppColors.textSecondary)),
                            Text(
                              '-${bp.voucherDiscount.toStringAsFixed(0)}đ',
                              style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 16),
                      // Dashed Divider at 65% height
                      CustomPaint(
                        painter: DashedLinePainter(),
                        size: const Size(double.infinity, 1),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Tổng tiền đặt lịch', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Text(
                            '${grandTotal.toStringAsFixed(0)}đ',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.bold,
                              fontSize: 20,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),

            bp.isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : ElevatedButton(
                    onPressed: _checkout,
                    child: const Text('XÁC NHẬN VÀ THANH TOÁN'),
                  ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class PayOSWebView extends StatefulWidget {
  final String paymentUrl;
  final VoidCallback onSuccess;
  final VoidCallback onCancel;

  const PayOSWebView({
    super.key,
    required this.paymentUrl,
    required this.onSuccess,
    required this.onCancel,
  });

  @override
  State<PayOSWebView> createState() => _PayOSWebViewState();
}

class _PayOSWebViewState extends State<PayOSWebView> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _redirectHandled = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
            });
            _checkRedirect(url);
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
            _checkRedirect(url);
          },
          onNavigationRequest: (NavigationRequest request) {
            if (_checkRedirect(request.url)) {
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.paymentUrl));
  }

  bool _checkRedirect(String url) {
    if (_redirectHandled) return false;

    // Chỉ detect đúng deep link của app — không dùng pattern lỏng lẻ
    if (url.startsWith('vibehue://payment/success')) {
      _redirectHandled = true;
      widget.onSuccess();
      return true;
    }
    if (url.startsWith('vibehue://payment/cancel')) {
      _redirectHandled = true;
      widget.onCancel();
      return true;
    }

    // Fallback: vẫn detect URL của PayOS thật (nếu có tích hợp thật)
    if (url.contains('status=PAID') || url.contains('status=SUCCESS')) {
      _redirectHandled = true;
      widget.onSuccess();
      return true;
    }
    if (url.contains('status=CANCELLED') || url.contains('status=CANCEL')) {
      _redirectHandled = true;
      widget.onCancel();
      return true;
    }

    return false;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thanh toán PayOS'),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
        ],
      ),
    );
  }
}

// Ticket Clipper for receipt notched details
class TicketClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    path.lineTo(0, size.height * 0.62 - 10);
    path.arcToPoint(
      Offset(0, size.height * 0.62 + 10),
      radius: const Radius.circular(10),
      clockwise: true,
    );
    path.lineTo(0, size.height);
    path.lineTo(size.width, size.height);
    path.lineTo(size.width, size.height * 0.62 + 10);
    path.arcToPoint(
      Offset(size.width, size.height * 0.62 - 10),
      radius: const Radius.circular(10),
      clockwise: true,
    );
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}

// Dashed Line Painter for ticket separator
class DashedLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    double dashWidth = 5, dashSpace = 3, startX = 0;
    final paint = Paint()
      ..color = AppColors.gold.withOpacity(0.4)
      ..strokeWidth = 1.2;
    while (startX < size.width) {
      canvas.drawLine(Offset(startX, 0), Offset(startX + dashWidth, 0), paint);
      startX += dashWidth + dashSpace;
    }
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}

// Animated Success Checkmark overlay
class SuccessScreen extends StatefulWidget {
  const SuccessScreen({super.key});

  @override
  State<SuccessScreen> createState() => _SuccessScreenState();
}

class _SuccessScreenState extends State<SuccessScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _scaleAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.elasticOut,
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.lightBg,
      body: Center(
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle,
                  color: AppColors.success,
                  size: 80,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'ĐẶT LỊCH THÀNH CÔNG!',
                style: TextStyle(
                  fontFamily: 'Playfair Display',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Chúc quý khách có hành trình Cố Đô trọn vẹn.',
                style: TextStyle(
                  fontSize: 14,
                  fontStyle: FontStyle.italic,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 40),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32.0),
                child: Column(
                  children: [
                    ElevatedButton(
                      onPressed: () {
                        Navigator.of(context).popUntil((route) => route.isFirst);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text(
                        'QUAY LẠI MUA SẮM',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1.1),
                      ),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () {
                        Navigator.of(context).popUntil((route) => route.isFirst);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const CustomerDashboardView()),
                        );
                      },
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.primary, width: 1.5),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text(
                        'XEM LỊCH SỬ ĐƠN',
                        style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, letterSpacing: 1.1),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}