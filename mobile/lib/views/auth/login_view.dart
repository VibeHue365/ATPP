import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../providers/auth_provider.dart';
import 'register_view.dart';
import 'verify_otp_view.dart';
import '../customer/landing_view.dart';
import '../provider/provider_dashboard_view.dart';

class LoginView extends StatefulWidget {
  final String defaultRole;
  const LoginView({super.key, this.defaultRole = 'CUSTOMER'});

  @override
  State<LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<LoginView> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  late String _role;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _role = widget.defaultRole;
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (mounted) {
      if (success) {
        final user = authProvider.user;
        if (user != null) {
          if (!user.emailVerified) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Tài khoản chưa được xác minh. Vui lòng xác thực OTP.')),
            );
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => VerifyOtpView(email: user.email),
              ),
            );
          } else {
            if (user.role == 'PROVIDER') {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const ProviderDashboardView()),
              );
            } else {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const LandingView()),
              );
            }
          }
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text(authProvider.error ?? 'Đăng nhập thất bại. Vui lòng thử lại.'),
          ),
        );
      }
    }
  }

  Widget _socialButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.textSecondary.withOpacity(0.15), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 6,
              offset: const Offset(0, 3),
            )
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.textPrimary, size: 20),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProvider = context.watch<AuthProvider>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Stylized Logo Emblem
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.gold.withOpacity(0.4), width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withOpacity(0.08),
                            blurRadius: 16,
                            spreadRadius: 2,
                          )
                        ],
                      ),
                      child: const Icon(
                        Icons.auto_stories,
                        size: 38,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Chào mừng trở lại',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Đăng nhập để tiếp tục gìn giữ tinh hoa cổ phong',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Content Card Container for a Premium floating look
                  Card(
                    elevation: 6,
                    shadowColor: AppColors.primary.withOpacity(0.06),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: AppColors.gold.withOpacity(0.1), width: 1),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Email Field
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: 'Địa chỉ Email',
                              prefixIcon: Icon(Icons.email_outlined, color: AppColors.primary),
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) return 'Vui lòng nhập Email';
                              if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value.trim())) {
                                return 'Email không hợp lệ';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

                          // Password Field
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: 'Mật khẩu',
                              prefixIcon: const Icon(Icons.lock_outlined, color: AppColors.primary),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                  color: AppColors.textSecondary.withOpacity(0.7),
                                  size: 20,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscurePassword = !_obscurePassword;
                                  });
                                },
                              ),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) return 'Vui lòng nhập mật khẩu';
                              if (value.length < 6) return 'Mật khẩu phải dài ít nhất 6 ký tự';
                              return null;
                            },
                          ),
                          const SizedBox(height: 10),

                          // Forgot Password link aligned to right
                          Align(
                            alignment: Alignment.centerRight,
                            child: InkWell(
                              onTap: () {
                                showDialog(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Quên mật khẩu?'),
                                    content: const Text(
                                      'Vui lòng liên hệ bộ phận hỗ trợ khách hàng VibeHue qua Hotline hoặc Email để được hướng dẫn đặt lại mật khẩu.',
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(ctx),
                                        child: const Text('ĐỒNG Ý'),
                                      ),
                                    ],
                                  ),
                                );
                              },
                              child: const Padding(
                                padding: EdgeInsets.symmetric(vertical: 4.0),
                                child: Text(
                                  'Quên mật khẩu?',
                                  style: TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Login Button
                          authProvider.isLoading
                              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                              : ElevatedButton(
                                  onPressed: _submit,
                                  style: ElevatedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child: const Text(
                                    'ĐĂNG NHẬP',
                                    style: TextStyle(letterSpacing: 1.2, fontWeight: FontWeight.bold),
                                  ),
                                ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Divider "Or continue with"
                  Row(
                    children: [
                      Expanded(child: Divider(color: AppColors.textSecondary.withOpacity(0.15))),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'Hoặc tiếp tục bằng',
                          style: TextStyle(color: AppColors.textSecondary.withOpacity(0.5), fontSize: 12),
                        ),
                      ),
                      Expanded(child: Divider(color: AppColors.textSecondary.withOpacity(0.15))),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Social Logins
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _socialButton(
                        icon: Icons.g_mobiledata,
                        label: 'Google',
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Tính năng đang được phát triển.')),
                          );
                        },
                      ),
                      const SizedBox(width: 16),
                      _socialButton(
                        icon: Icons.apple,
                        label: 'Apple',
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Tính năng đang được phát triển.')),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // Go to register link
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Chưa có tài khoản? ',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => RegisterView(defaultRole: _role),
                            ),
                          );
                        },
                        child: const Text(
                          'Đăng ký ngay',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      )
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}