import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../providers/provider_provider.dart';
import '../../providers/auth_provider.dart';
import '../onboarding/onboarding_view.dart';
import 'schedule_manager_view.dart';
import 'portfolio_manager_view.dart';
import 'voucher_manager_view.dart';
import 'reviews_dashboard_view.dart';

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
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> tabs = [
      const ProviderHomeTab(),
      const ScheduleManagerView(),
      const PortfolioManagerView(),
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
            icon: Icon(Icons.calendar_month_outlined),
            activeIcon: Icon(Icons.calendar_month),
            label: 'Lịch rảnh',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.collections_outlined),
            activeIcon: Icon(Icons.collections),
            label: 'Portfolio',
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

class ProviderHomeTab extends StatelessWidget {
  const ProviderHomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProviderProvider>();
    final auth = context.watch<AuthProvider>();
    final theme = Theme.of(context);

    final stats = provider.reviewStats;
    final double avgRating = (stats['averageRating'] ?? 0.0).toDouble();
    final int totalReviews = stats['totalReviews'] ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bảng quản trị tiệm'),
        actions: [
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
                  fontSize: 22,
                ),
              ),
              const SizedBox(height: 4),
              const Text('Hôm nay của bạn thế nào? Xem thống kê tình hình hoạt động bên dưới.'),
              const SizedBox(height: 20),

              // Stats summary row
              Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      'Đánh giá trung bình',
                      '$avgRating / 5.0',
                      Icons.star,
                      AppColors.gold,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _buildStatCard(
                      'Tổng số lượt đánh giá',
                      '$totalReviews lượt',
                      Icons.rate_review,
                      AppColors.primary,
                    ),
                  ),
                ],
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
                  : provider.providerBookings.isEmpty
                      ? const Card(
                          child: Padding(
                            padding: EdgeInsets.all(24.0),
                            child: Center(
                              child: Text('Chưa nhận được lịch đặt nào mới.'),
                            ),
                          ),
                        )
                      : ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: provider.providerBookings.length,
                          itemBuilder: (context, index) {
                            final booking = provider.providerBookings[index];
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