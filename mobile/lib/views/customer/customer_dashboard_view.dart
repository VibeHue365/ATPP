import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/booking.dart';
import '../../providers/booking_provider.dart';

class CustomerDashboardView extends StatefulWidget {
  const CustomerDashboardView({super.key});

  @override
  State<CustomerDashboardView> createState() => _CustomerDashboardViewState();
}

class _CustomerDashboardViewState extends State<CustomerDashboardView> {
  int _currentPage = 1;
  final int _pageSize = 5;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<BookingProvider>().loadMyBookings();
    });
  }

  void _showCancelDialog(Booking booking) {
    final reasonController = TextEditingController();
    bool isSubmitting = false;

    // Statuses mà hủy sẽ bị phạt (đã thanh toán cọc trở lên)
    final isPaidStatus = !['DRAFT', 'PENDING_PAYMENT'].contains(booking.status);

    showDialog(
      context: context,
      barrierDismissible: !isSubmitting,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setStateDialog) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Colors.red, size: 22),
              const SizedBox(width: 8),
              Text(
                'Xác nhận hủy lịch đặt',
                style: GoogleFonts.playfairDisplay(
                  fontWeight: FontWeight.bold,
                  color: Colors.red.shade800,
                  fontSize: 17,
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Mã đơn
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primaryTrans,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Mã đơn: ${booking.bookingCode}',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 13),
                  ),
                ),
                const SizedBox(height: 12),

                // Cảnh báo chính sách hoàn tiền
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.info_outline, size: 15, color: Colors.red.shade700),
                          const SizedBox(width: 6),
                          Text(
                            'QUY ĐỊNH HOÀN TIỀN CỌC',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: Colors.red.shade800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      _buildPolicyRow('Hủy trước 72 giờ:', 'Hoàn trả 100% tiền cọc'),
                      const SizedBox(height: 4),
                      _buildPolicyRow('Hủy trong vòng 72 giờ:', 'Phạt 100% tiền thuê dịch vụ'),
                      const SizedBox(height: 4),
                      _buildPolicyRow('Đơn chưa thanh toán:', 'Hủy miễn phí bất kỳ lúc nào'),
                      if (isPaidStatus) ...[
                        const SizedBox(height: 6),
                        const Divider(height: 1),
                        const SizedBox(height: 6),
                        Text(
                          'Đơn này đã thanh toán cọc — áp dụng chính sách phạt nếu hủy sát giờ.',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.red.shade700,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Nhập lý do hủy
                Text(
                  'Lý do hủy lịch (bắt buộc)',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade800,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: reasonController,
                  maxLines: 3,
                  enabled: !isSubmitting,
                  decoration: InputDecoration(
                    hintText: 'Vui lòng cung cấp lý do để chúng tôi cải thiện dịch vụ...',
                    hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.primary),
                    ),
                    contentPadding: const EdgeInsets.all(12),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
              child: const Text('QUAY LẠI', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton.icon(
              icon: isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.cancel_outlined, size: 16),
              label: Text(isSubmitting ? 'ĐANG HỦY...' : 'XÁC NHẬN HỦY'),
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final reason = reasonController.text.trim();
                      if (reason.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Vui lòng nhập lý do hủy lịch!'),
                            backgroundColor: Colors.orange,
                          ),
                        );
                        return;
                      }

                      setStateDialog(() => isSubmitting = true);
                      Navigator.pop(ctx);

                      try {
                        final result = await context
                            .read<BookingProvider>()
                            .cancelBookingWithResult(booking.id, reason);

                        if (context.mounted) {
                          final isFree = result['isFreeCancel'] as bool? ?? true;
                          final refund = result['refundAmount'] as double? ?? 0.0;
                          final penaltyReason = result['penaltyReason'] as String? ?? '';

                          if (isFree) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Hủy đơn thành công! Hoàn trả 100% (${_formatCurrency(refund)}).',
                                ),
                                backgroundColor: Colors.green,
                                duration: const Duration(seconds: 4),
                              ),
                            );
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Đã hủy lịch. $penaltyReason Hoàn lại: ${_formatCurrency(refund)}.',
                                ),
                                backgroundColor: Colors.orange,
                                duration: const Duration(seconds: 5),
                              ),
                            );
                          }
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Không thể hủy đơn: $e'),
                              backgroundColor: AppColors.error,
                            ),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade700,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPolicyRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('• ', style: TextStyle(fontSize: 11.5, color: Colors.red)),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF7F1D1D)),
              children: [
                TextSpan(text: label, style: const TextStyle(fontWeight: FontWeight.bold)),
                TextSpan(text: ' $value'),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _formatCurrency(double amount) {
    return '${amount.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}đ';
  }

  void _showReviewDialog(Booking booking, BookingItem item) {
    int rating = 5;
    final commentController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setStateDialog) => AlertDialog(
          title: const Text('Đánh giá dịch vụ'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
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
                    onPressed: () {
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
                decoration: const InputDecoration(
                  hintText: 'Hãy chia sẻ cảm nhận của bạn về phục trang và dịch vụ...',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('ĐÓNG'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await context.read<BookingProvider>().submitReview(
                      bookingId: booking.id,
                      bookingItemId: item.id,
                      rating: rating,
                      comment: commentController.text.trim(),
                      productId: item.productId,
                      photographyPackageId: item.photographyPackageId,
                    );
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Cảm ơn bạn đã gửi đánh giá!')),
                  );
                  context.read<BookingProvider>().loadMyBookings();
                }
              },
              child: const Text('GỬI ĐÁNH GIÁ'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final parsed = DateTime.parse(dateStr);
      return '${parsed.day}/${parsed.month}/${parsed.year}';
    } catch (_) {
      return dateStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    final bp = context.watch<BookingProvider>();
    final theme = Theme.of(context);

    final totalBookings = bp.myBookings.length;
    final totalPages = (totalBookings / _pageSize).ceil();
    if (_currentPage > totalPages && totalPages > 0) {
      _currentPage = totalPages;
    }
    final paginatedBookings = bp.myBookings
        .skip((_currentPage - 1) * _pageSize)
        .take(_pageSize)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lịch sử đặt hàng'),
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => bp.loadMyBookings(),
        child: bp.isLoading && bp.myBookings.isEmpty
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : bp.myBookings.isEmpty
                ? const Center(
                    child: Text('Quý khách chưa có đơn đặt lịch nào.'),
                  )
                : Column(
                    children: [
                      Expanded(
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: paginatedBookings.length,
                          itemBuilder: (context, index) {
                            final booking = paginatedBookings[index];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 16),
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          'Mã đơn: ${booking.bookingCode}',
                                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                                        ),
                                        Chip(
                                          label: Text(booking.status),
                                          visualDensity: VisualDensity.compact,
                                        )
                                      ],
                                    ),
                                    const Divider(height: 20),
                                    
                                    // Items list inside booking
                                    ...booking.items.map((item) {
                                      return Padding(
                                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              item.itemType == 'PRODUCT' ? 'Thuê trang phục' : 'Gói chụp ảnh',
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textSecondary),
                                            ),
                                            const SizedBox(height: 2),
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Text('Kích cỡ: ${item.selectedSize ?? 'M'} | SL: ${item.quantity}'),
                                                Text(
                                                  '${item.unitPrice.toStringAsFixed(0)}đ',
                                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                                ),
                                              ],
                                            ),
                                            // Render date details
                                            if (item.shootTimeSlot != null && item.shootTimeSlot!.isNotEmpty)
                                              Text(
                                                'Thuê theo giờ: ${_formatDate(item.shootDate ?? item.rentalFrom)} (${item.shootTimeSlot})',
                                                style: const TextStyle(fontSize: 12, color: AppColors.goldDark, fontWeight: FontWeight.w600),
                                              )
                                            else if (item.rentalFrom != null)
                                              Text(
                                                'Thời gian: ${_formatDate(item.rentalFrom)} - ${_formatDate(item.rentalTo)}',
                                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                              ),
                                            if (booking.status == 'COMPLETED') ...[
                                              const SizedBox(height: 6),
                                              Align(
                                                alignment: Alignment.centerRight,
                                                child: item.isReviewed
                                                    ? const Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Icon(Icons.check_circle_outline, size: 14, color: Colors.green),
                                                          SizedBox(width: 4),
                                                          Text(
                                                            'Đã đánh giá',
                                                            style: TextStyle(fontSize: 12, color: Colors.green, fontWeight: FontWeight.bold),
                                                          ),
                                                        ],
                                                      )
                                                    : TextButton.icon(
                                                        icon: const Icon(Icons.star, size: 16, color: AppColors.gold),
                                                        label: const Text('Đánh giá dịch vụ', style: TextStyle(fontSize: 12)),
                                                        onPressed: () => _showReviewDialog(booking, item),
                                                      ),
                                              )
                                            ]
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                    
                                    const Divider(height: 20),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text('Tổng tiền:'),
                                        Text(
                                          '${booking.pricingSummary.grandTotal.toStringAsFixed(0)}đ',
                                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 16),
                                        ),
                                      ],
                                    ),
                                    
                                    if (booking.status != 'CANCELLED' &&
                                        booking.status != 'COMPLETED' &&
                                        booking.status != 'RETURNED' &&
                                        booking.status != 'PICKED_UP' &&
                                        booking.status != 'DISPUTED') ...[
                                      const SizedBox(height: 12),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.end,
                                        children: [
                                          OutlinedButton.icon(
                                            icon: const Icon(Icons.cancel_outlined, size: 16),
                                            label: const Text('HỦY LỊCH'),
                                            onPressed: () => _showCancelDialog(booking),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: Colors.red.shade700,
                                              side: BorderSide(color: Colors.red.shade700),
                                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                            ),
                                          ),
                                        ],
                                      )
                                    ]
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      if (totalPages > 1)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12.0),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.arrow_back_ios, size: 16),
                                onPressed: _currentPage > 1
                                    ? () {
                                        setState(() {
                                          _currentPage--;
                                        });
                                      }
                                    : null,
                              ),
                              Text(
                                'Trang $_currentPage / $totalPages',
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              IconButton(
                                icon: const Icon(Icons.arrow_forward_ios, size: 16),
                                onPressed: _currentPage < totalPages
                                    ? () {
                                        setState(() {
                                          _currentPage++;
                                        });
                                      }
                                    : null,
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
      ),
    );
  }
}