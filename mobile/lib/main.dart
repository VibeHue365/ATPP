import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/constants/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/booking_provider.dart';
import 'providers/provider_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/user_chat_provider.dart';
import 'providers/notification_provider.dart';
import 'views/onboarding/onboarding_view.dart';
import 'views/customer/landing_view.dart';
import 'views/provider/provider_dashboard_view.dart';
import 'views/admin/admin_dashboard_view.dart';
import 'core/constants/colors.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => BookingProvider()),
        ChangeNotifierProvider(create: (_) => ProviderProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => UserChatProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return MaterialApp(
            title: 'Di Sản Áo Dài',
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeProvider.themeMode,
            debugShowCheckedModeBanner: false,
            home: const RootHandler(),
          );
        },
      ),
    );
  }
}

class RootHandler extends StatelessWidget {
  const RootHandler({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    if (authProvider.isLoading) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: AppColors.primary),
              SizedBox(height: 12),
              Text(
                "Đang tải hồn cốt quê hương...",
                style: TextStyle(
                  fontStyle: FontStyle.italic,
                  color: AppColors.primaryDark,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (authProvider.isAuthenticated) {
      final user = authProvider.user;
      if (user != null) {
        final roles = user.roles.map((r) => r.toUpperCase()).toList();
        if (roles.contains('ADMIN')) {
          return const AdminDashboardView();
        } else if (roles.contains('PROVIDER')) {
          return const ProviderDashboardView();
        }
      }
      return const LandingView();
    }

    return const OnboardingView();
  }
}