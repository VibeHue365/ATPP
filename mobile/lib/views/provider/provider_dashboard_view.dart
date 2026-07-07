import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../providers/provider_provider.dart';
import '../../providers/auth_provider.dart';
import '../onboarding/onboarding_view.dart';
import '../customer/chat_rooms_view.dart';
import '../customer/notifications_view.dart';
import '../../providers/notification_provider.dart';
import 'voucher_manager_view.dart';
import 'reviews_dashboard_view.dart';
import 'product_manager_view.dart';


class ProviderDashboardView extends StatefulWidget {
  const ProviderDashboardView({super.key});

  @override
  State<ProviderDashboardView> createState() => _ProviderDashboardViewState();
}

class _ProviderDashboardViewState extends State<ProviderDashboardView> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProviderProvider>().loadProviderProfile();
      context.read<ProviderProvider>().loadProviderBookings();
      context.read<ProviderProvider>().loadReviewStats();
      context.read<NotificationProvider>().fetchNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> tabs = [
      const ProviderHomeTab(),
      const VoucherManagerView(),
      const ReviewsDashboardView(),
    ];

    return Scaffold(
      body: tabs[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondary.withOpacity(0.6),
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        elevation: 8,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Tổng quan',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.local_offer_outlined),
            activeIcon: Icon(Icons.local_offer),
            label: 'Khuyến mãi',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.rate_review_outlined),
            activeIcon: Icon(Icons.rate_review),
            label: 'Đánh giá',
          ),
        ],
      ),
    );
  }
}

class ProviderHomeTab extends StatefulWidget {
  const ProviderHomeTab({super.key});

  @override
  State<ProviderHomeTab> createState() => _ProviderHomeTabState();
}

class _ProviderHomeTabState extends State<ProviderHomeTab> {
  int _currentPage = 1;
  final int _pageSize = 5;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProviderProvider>();
    final auth = context.watch<AuthProvider>();
    final theme = Theme.of(context);

    final stats = provider.reviewStats;
    final double avgRating = (stats['averageRating'] ?? 0.0).toDouble();
    final int totalReviews = stats['totalReviews'] ?? 0;

    // Calculate detailed statistics from providerBookings
    final bookings = provider.providerBookings;
    final now = DateTime.now();

    double monthlyRevenue = 0;
    for (var b in bookings) {
      if (b.status.toUpperCase() == 'COMPLETED') {
        if (b.createdAt != null) {
          final date = DateTime.tryParse(b.createdAt!);
          if (date != null && date.month == now.month && date.year == now.year) {
            monthlyRevenue += b.pricingSummary.grandTotal;
          }
        }
      }
    }

    final int pendingBookings = bookings.where((b) {
      final s = b.status.toUpperCase();
      return s == 'PENDING' || s == 'PENDING_PAYMENT';
    }).length;

    final int activeBookings = bookings.where((b) {
      final s = b.status.toUpperCase();
      return s == 'CONFIRMED' ||
          s == 'DEPOSIT_PAID' ||
          s == 'PICKUP_PENDING' ||
          s == 'PICKED_UP' ||
          s == 'RETURN_PENDING' ||
          s == 'RETURNED';
    }).length;

    final int completedBookings = bookings.where((b) {
      return b.status.toUpperCase() == 'COMPLETED';
    }).length;

    final totalBookings = bookings.length;
    final totalPages = (totalBookings / _pageSize).ceil();
    if (_currentPage > totalPages && totalPages > 0) {
      _currentPage = totalPages;
    }
    final paginatedBookings = bookings
        .skip((_currentPage - 1) * _pageSize)
        .take(_pageSize)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bảng quản trị tiệm'),
        actions: [
          Consumer<NotificationProvider>(
            builder: (context, notificationProvider, _) {
              final unreadCount = notificationProvider.unreadCount;
              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications_outlined, color: AppColors.primary),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const NotificationsView()),
                      );
                    },
                  ),
                  if (unreadCount > 0)
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          '$unreadCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline, color: AppColors.primary),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ChatRoomsView()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: AppColors.error),
            onPressed: () async {
              await auth.logout();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => const OnboardingView()),
                  (route) => false,
                );
              }
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          await provider.loadProviderProfile();
          await provider.loadProviderBookings();
          await provider.loadReviewStats();
          await context.read<NotificationProvider>().fetchNotifications();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Welcome header
              Text(
                'Kính chào, ${provider.providerProfile['businessName'] ?? 'Chủ tiệm Di Sản'}',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 20,
                ),
              ),
              const SizedBox(height: 4),
              const Text('Xem báo cáo chi tiết và thống kê hoạt động bên dưới.'),
              const SizedBox(height: 20),

              if (provider.providerProfile['status'] == 'SUSPENDED') ...[
                Container(
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.shade300, width: 1.5),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 36),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              'CỬA HÀNG ĐANG BỊ ĐÌNH CHỈ',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.error,
                                fontSize: 14,
                                letterSpacing: 0.5,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Tài khoản đối tác của bạn đã bị tạm đình chỉ hoạt động. Tất cả các sản phẩm đã được ẩn khỏi cửa hàng và bạn không thể thực hiện giao dịch hay quản lý đơn hàng mới. Vui lòng liên hệ Admin để giải quyết.',
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 12,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Monthly Revenue Card
              Card(
                elevation: 3,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: Color(0xFFF0D8D9), width: 1),
                ),
                color: const Color(0xFFFFF7F7),
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'DOANH THU THÁNG NÀY',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                              letterSpacing: 1.1,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            monthlyRevenue > 0
                                ? '${monthlyRevenue.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}đ'
                                : '0đ',
                            style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                      const CircleAvatar(
                        backgroundColor: Color(0xFFFDE4E5),
                        radius: 28,
                        child: Icon(Icons.account_balance_wallet,
                            color: AppColors.primary, size: 28),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Grid of Status Stats (2x2)
              GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.35,
                children: [
                  _buildStatCard(
                    'Chờ thanh toán',
                    '$pendingBookings đơn',
                    Icons.pending_actions,
                    Colors.orange,
                  ),
                  _buildStatCard(
                    'Đang thực hiện',
                    '$activeBookings đơn',
                    Icons.sync,
                    const Color(0xFFC0A060),
                  ),
                  _buildStatCard(
                    'Đã hoàn thành',
                    '$completedBookings đơn',
                    Icons.check_circle_outline,
                    Colors.green,
                  ),
                  _buildStatCard(
                    'Đánh giá',
                    '$avgRating / 5.0 ($totalReviews lượt)',
                    Icons.star_outline,
                    Colors.amber,
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Manage Products Card Button
              Card(
                elevation: 3,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                color: AppColors.primaryTrans,
                child: InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ProductManagerView(),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 18.0, horizontal: 16.0),
                    child: Row(
                      children: [
                        Icon(
                          Icons.dry_cleaning,
                          color: AppColors.primary,
                          size: 36,
                        ),
                        SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Quản lý phục trang Áo Dài',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Thêm mới, sửa giá, mô tả và số lượng tồn kho',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          Icons.arrow_forward_ios,
                          color: AppColors.primary,
                          size: 16,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Active Bookings list

              Text(
                'Lịch đặt khách hàng mới nhất',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              provider.isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : bookings.isEmpty
                      ? const Card(
                          child: Padding(
                            padding: EdgeInsets.all(24.0),
                            child: Center(
                              child: Text('Chưa nhận được lịch đặt nào mới.'),
                            ),
                          ),
                        )
                      : Column(
                          children: [
                            ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: paginatedBookings.length,
                              itemBuilder: (context, index) {
                                final booking = paginatedBookings[index];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  child: ListTile(
                                    title: Text(
                                      'Đơn hàng: ${booking.bookingCode}',
                                      style: const TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                    subtitle: Text(
                                      'Tổng cộng: ${booking.pricingSummary.grandTotal.toStringAsFixed(0)}đ | Trạng thái: ${booking.status}',
                                    ),
                                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                                    onTap: () {
                                      // Can build detail/action screen if needed
                                    },
                                  ),
                                );
                              },
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
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
          ],
        ),
      ),
    );
  }
}