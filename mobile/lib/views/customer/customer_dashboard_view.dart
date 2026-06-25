import 'package:flutter/material.dart';
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
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<BookingProvider>().loadMyBookings();
    });
  }

  void _showCancelDialog(String bookingId) {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hủy lịch đặt'),
        content: TextField(
          controller: reasonController,
          decoration: const InputDecoration(
            hintText: 'Nhập lý do hủy lịch...',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ĐÓNG'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (reasonController.text.trim().isNotEmpty) {
                Navigator.pop(ctx);
                await context.read<BookingProvider>().cancelBooking(
                      bookingId,
                      reasonController.text.trim(),
                    );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('HỦY LỊCH'),
          ),
        ],
      ),
    );
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
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: bp.myBookings.length,
                    itemBuilder: (context, index) {
                      final booking = bp.myBookings[index];
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
                                      if (item.rentalFrom != null)
                                        Text(
                                          'Thời gian: ${_formatDate(item.rentalFrom)} - ${_formatDate(item.rentalTo)}',
                                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                        ),
                                      if (booking.status == 'COMPLETED') ...[
                                        const SizedBox(height: 6),
                                        Align(
                                          alignment: Alignment.centerRight,
                                          child: TextButton.icon(
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
                              
                              if (booking.status == 'PENDING_PAYMENT' || booking.status == 'DRAFT') ...[
                                const SizedBox(height: 12),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    OutlinedButton(
                                      onPressed: () => _showCancelDialog(booking.id),
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: AppColors.error,
                                        side: const BorderSide(color: AppColors.error),
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                      ),
                                      child: const Text('HỦY LỊCH'),
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
    );
  }
}