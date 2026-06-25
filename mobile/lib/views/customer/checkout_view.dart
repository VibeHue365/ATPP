import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/constants/colors.dart';
import '../../models/product.dart';
import '../../providers/booking_provider.dart';

class CheckoutView extends StatefulWidget {
  final Product product;
  final String selectedSize;

  const CheckoutView({
    super.key,
    required this.product,
    required this.selectedSize,
  });

  @override
  State<CheckoutView> createState() => _CheckoutViewState();
}

class _CheckoutViewState extends State<CheckoutView> {
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  DateTime _endDate = DateTime.now().add(const Duration(days: 2));
  final _voucherController = TextEditingController();
  final _colorController = TextEditingController(text: 'Đỏ Đô');
  final _notesController = TextEditingController();

  int get rentalDays => _endDate.difference(_startDate).inDays > 0
      ? _endDate.difference(_startDate).inDays
      : 1;

  double get subTotal => widget.product.price * rentalDays;
  double get depositTotal => widget.product.depositPrice;
  double get grandTotal {
    final discount = context.watch<BookingProvider>().voucherDiscount;
    return subTotal + depositTotal - discount;
  }

  @override
  void dispose() {
    _voucherController.dispose();
    _colorController.dispose();
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
    final success = await bp.applyVoucher(
      _voucherController.text.trim(),
      subTotal,
      [widget.product.providerId],
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
      final booking = await bp.createProductBooking(
        productId: widget.product.id,
        size: widget.selectedSize,
        color: _colorController.text.trim(),
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
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Thanh toán tiền cọc thành công!')),
                );
                Navigator.pop(context); // Close webview
                Navigator.pop(context); // Close checkout
                // Jump to dashboard/receipts
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
            // Selected Product Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        widget.product.imageUrl ?? '',
                        width: 80,
                        height: 80,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 80,
                          height: 80,
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
                            widget.product.name,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                          const SizedBox(height: 4),
                          Text('Kích cỡ: ${widget.selectedSize}'),
                          const SizedBox(height: 4),
                          Text(
                            '${widget.product.price.toStringAsFixed(0)}đ / ngày',
                            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    )
                  ],
                ),
              ),
            ),
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
                      controller: _colorController,
                      decoration: const InputDecoration(labelText: 'Màu sắc mong muốn'),
                    ),
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
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Tóm tắt thanh toán', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Giá thuê tạm tính'),
                        Text('${subTotal.toStringAsFixed(0)}đ'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Tiền cọc đảm bảo'),
                        Text('${depositTotal.toStringAsFixed(0)}đ'),
                      ],
                    ),
                    if (bp.voucherDiscount > 0) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Giảm giá voucher'),
                          Text(
                            '-${bp.voucherDiscount.toStringAsFixed(0)}đ',
                            style: const TextStyle(color: AppColors.success),
                          ),
                        ],
                      ),
                    ],
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Tổng tiền đặt lịch', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        Text(
                          '${grandTotal.toStringAsFixed(0)}đ',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                      ],
                    ),
                  ],
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
    if (url.contains('status=PAID') || url.contains('status=SUCCESS') || url.contains('/success')) {
      widget.onSuccess();
      return true;
    } else if (url.contains('status=CANCELLED') || url.contains('/cancel')) {
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