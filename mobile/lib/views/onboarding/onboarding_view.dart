import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../auth/login_view.dart';

class OnboardingView extends StatefulWidget {
  const OnboardingView({super.key});

  @override
  State<OnboardingView> createState() => _OnboardingViewState();
}

class _OnboardingViewState extends State<OnboardingView> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<Map<String, String>> _slides = [
    {
      'title': 'Gìn Giữ Hồn Cốt Di Sản',
      'desc': 'Khám phá và khoác lên mình tà áo ngũ thân, áo giao lĩnh, nhật bình đầy kiêu sa và lộng lẫy từ ngàn xưa.',
      'image': 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600',
    },
    {
      'title': 'Nhiếp Ảnh Chuyên Nghiệp',
      'desc': 'Kết nối dễ dàng với hàng trăm thợ ảnh am hiểu cổ phong tại Cố Đô để bắt trọn những khoảnh khắc thanh xuân rực rỡ.',
      'image': 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=600',
    },
    {
      'title': 'Đặt Lịch Tự Động & An Toàn',
      'desc': 'Quy trình đặt lịch thuê đồ và thanh toán đặt cọc trực tuyến cực kỳ nhanh chóng và minh bạch qua cổng PayOS.',
      'image': 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=600',
    }
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _navigateToLogin(String role) {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => LoginView(defaultRole: role),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: Stack(
        children: [
          // Background page view
          PageView.builder(
            controller: _pageController,
            itemCount: _slides.length,
            onPageChanged: (index) {
              setState(() {
                _currentPage = index;
              });
            },
            itemBuilder: (context, index) {
              final slide = _slides[index];
              return Stack(
                children: [
                  // Background image
                  Container(
                    width: double.infinity,
                    height: double.infinity,
                    decoration: BoxDecoration(
                      image: DecorationImage(
                        image: NetworkImage(slide['image']!),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  // Gradient Overlay
                  Container(
                    width: double.infinity,
                    height: double.infinity,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.black.withOpacity(0.2),
                          Colors.black.withOpacity(0.6),
                          Colors.black.withOpacity(0.9),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                  // Content details
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Spacer(flex: 4),
                          // Brand Icon
                          if (index == 0)
                            Center(
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  border: Border.all(color: AppColors.gold, width: 2),
                                  borderRadius: BorderRadius.circular(50),
                                ),
                                child: const Icon(
                                  Icons.auto_stories,
                                  size: 36,
                                  color: AppColors.goldLight,
                                ),
                              ),
                            ),
                          const SizedBox(height: 16),
                          Text(
                            slide['title']!,
                            textAlign: TextAlign.center,
                            style: theme.textTheme.displayLarge?.copyWith(
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              shadows: [
                                const Shadow(
                                  blurRadius: 10,
                                  color: Colors.black45,
                                  offset: Offset(0, 2),
                                )
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8.0),
                            child: Text(
                              slide['desc']!,
                              textAlign: TextAlign.center,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: Colors.white.withOpacity(0.75),
                                fontSize: 15,
                                height: 1.6,
                              ),
                            ),
                          ),
                          const Spacer(flex: 3),
                        ],
                      ),
                    ),
                  )
                ],
              );
            },
          ),

          // Indicators & Navigation Row
          Positioned(
            bottom: 40,
            left: 24,
            right: 24,
            child: Column(
              children: [
                // Indicators
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(_slides.length, (index) {
                    final isSelected = _currentPage == index;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: isSelected ? 24 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.goldLight : Colors.white24,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 32),

                // Actions buttons
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: _currentPage == _slides.length - 1
                      ? Column(
                          key: const ValueKey('last_slide_actions'),
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            ElevatedButton(
                              onPressed: () => _navigateToLogin('CUSTOMER'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                              ),
                              child: const Text('TÔI LÀ KHÁCH HÀNG'),
                            ),
                            const SizedBox(height: 12),
                            OutlinedButton(
                              onPressed: () => _navigateToLogin('PROVIDER'),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppColors.gold, width: 1.5),
                                foregroundColor: AppColors.goldLight,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                              ),
                              child: const Text('TÔI LÀ NHÀ CUNG CẤP / PHOTOGRAPHER'),
                            ),
                          ],
                        )
                      : Row(
                          key: const ValueKey('normal_slide_actions'),
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            TextButton(
                              onPressed: () {
                                _pageController.jumpToPage(_slides.length - 1);
                              },
                              child: const Text(
                                'BỎ QUA',
                                style: TextStyle(color: Colors.white54, fontWeight: FontWeight.bold),
                              ),
                            ),
                            ElevatedButton(
                              onPressed: () {
                                _pageController.nextPage(
                                  duration: const Duration(milliseconds: 350),
                                  curve: Curves.easeInOut,
                                );
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.gold,
                              ),
                              child: const Row(
                                children: [
                                  Text('TIẾP THEO'),
                                  SizedBox(width: 4),
                                  Icon(Icons.chevron_right, size: 18),
                                ],
                              ),
                            )
                          ],
                        ),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}