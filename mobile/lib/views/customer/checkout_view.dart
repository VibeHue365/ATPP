import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/constants/colors.dart';
import '../../models/product.dart';
import '../../models/cart_item.dart';
import '../../providers/booking_provider.dart';

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

  int get rentalDays => _endDate.difference(_startDate).inDays > 0
      ? _endDate.difference(_startDate).inDays
      : 1;

  double get subTotal => widget.cartItems.fold(0.0, (sum, item) => sum + (item.product.price * item.quantity)) * rentalDays;
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

      // Now create payment link for deposit
      final paymentUrl = await bp.getPaymentLink(booking.id, 'DEPOSIT_PAYMENT');
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
                Future.delayed(const Duration(milliseconds: 2500), () {
                  if (context.mounted) {
                    Navigator.pop(context); // Close SuccessScreen
                  }
                });
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
                              '${item.product.price.toStringAsFixed(0)}đ / ngày',
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

            // Date picker box
            Card(
              child: ListTile(
                leading: const Icon(Icons.calendar_month, color: AppColors.primary),
                title: const Text('Thời gian thuê'),
                subtitle: Text(
                  'Từ ${_startDate.day}/${_startDate.month} đến ${_endDate.day}/${_endDate.month} (${rentalDays} ngày)',
                ),
                trailing: const Icon(Icons.edit_calendar),
                onTap: _selectDateRange,
              ),
            ),
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
                            decoration: const InputDecoration(
                              hintText: 'Mã giảm giá (ví dụ: GIAM20)',
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                    child: const Text('XÁC NHẬN VÀ THANH TOÁN ĐẶT CỌC'),
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
    // PayOS success or cancel URL detection
    if (url.contains('status=PAID') || 
        url.contains('status=SUCCESS') || 
        url.contains('/success') || 
        url.contains('/dashboard/profile') || 
        url.contains('profile?tab=payments')) {
      widget.onSuccess();
      return true;
    } else if (url.contains('status=CANCELLED') || 
               url.contains('/cancel') || 
               url.contains('/cart')) {
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
            ],
          ),
        ),
      ),
    );
  }
}