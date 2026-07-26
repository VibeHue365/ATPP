import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../providers/provider_provider.dart';

class ReviewsDashboardView extends StatefulWidget {
  const ReviewsDashboardView({super.key});

  @override
  State<ReviewsDashboardView> createState() => _ReviewsDashboardViewState();
}

class _ReviewsDashboardViewState extends State<ReviewsDashboardView> {
  int _currentPage = 1;
  final int _pageSize = 5;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProviderProvider>().loadProviderProfile();
    });
  }

  void _showReplyDialog(String reviewId) {
    final replyController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Phản hồi đánh giá'),
        content: TextField(
          controller: replyController,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Nhập phản hồi của bạn đến khách hàng...',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ĐÓNG'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (replyController.text.trim().isNotEmpty) {
                Navigator.pop(ctx);
                final success = await context.read<ProviderProvider>().replyToReview(
                      reviewId,
                      replyController.text.trim(),
                    );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        success ? 'Đã phản hồi đánh giá thành công!' : 'Phản hồi thất bại.',
                      ),
                    ),
                  );
                }
              }
            },
            child: const Text('GỬI PHẢN HỒI'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProviderProvider>();
    final list = provider.reviews;

    final totalReviews = list.length;
    final totalPages = (totalReviews / _pageSize).ceil();
    if (_currentPage > totalPages && totalPages > 0) {
      _currentPage = totalPages;
    }
    final paginatedReviews = list
        .skip((_currentPage - 1) * _pageSize)
        .take(_pageSize)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Đánh giá từ khách hàng'),
      ),
      body: provider.isLoading && list.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () => provider.loadProviderProfile(),
              child: list.isEmpty
                  ? const Center(
                      child: Text('Chưa có đánh giá nào từ khách hàng.'),
                    )
                  : Column(
                      children: [
                        Expanded(
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: paginatedReviews.length,
                            itemBuilder: (context, index) {
                              final review = paginatedReviews[index];
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
                                            review.customerName,
                                            style: const TextStyle(fontWeight: FontWeight.bold),
                                          ),
                                          Row(
                                            children: List.generate(5, (starIdx) {
                                              return Icon(
                                                starIdx < review.rating ? Icons.star : Icons.star_border,
                                                color: AppColors.gold,
                                                size: 16,
                                              );
                                            }),
                                          )
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        review.comment,
                                        style: const TextStyle(height: 1.4),
                                      ),
                                      if (review.reply != null && review.reply!.isNotEmpty) ...[
                                        const SizedBox(height: 12),
                                        Container(
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: AppColors.primaryTrans,
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text(
                                                'Phản hồi của bạn:',
                                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.primary),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(review.reply!),
                                            ],
                                          ),
                                        )
                                      ] else ...[
                                        const SizedBox(height: 12),
                                        Align(
                                          alignment: Alignment.centerRight,
                                          child: OutlinedButton.icon(
                                            icon: const Icon(Icons.reply, size: 16),
                                            label: const Text('Phản hồi'),
                                            onPressed: () => _showReplyDialog(review.id),
                                            style: OutlinedButton.styleFrom(
                                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                              visualDensity: VisualDensity.compact,
                                            ),
                                          ),
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