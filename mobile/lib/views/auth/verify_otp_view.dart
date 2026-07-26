import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../providers/auth_provider.dart';
import 'login_view.dart';

class VerifyOtpView extends StatefulWidget {
  final String email;
  const VerifyOtpView({super.key, required this.email});

  @override
  State<VerifyOtpView> createState() => _VerifyOtpViewState();
}

class _VerifyOtpViewState extends State<VerifyOtpView> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  void _verify() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.verifyEmail(
      email: widget.email,
      otp: _otpController.text.trim(),
    );

    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Xác minh thành công! Vui lòng đăng nhập lại.')),
        );
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => LoginView(defaultRole: authProvider.user?.role ?? 'CUSTOMER')),
          (route) => false,
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text(authProvider.error ?? 'Mã xác minh không chính xác.'),
          ),
        );
      }
    }
  }

  void _resend() async {
    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.resendVerificationCode(email: widget.email);

    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mã OTP mới đã được gửi lại vào hòm thư của bạn.')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text(authProvider.error ?? 'Không thể gửi lại mã OTP.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProvider = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Xác thực OTP'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.mark_email_unread_outlined,
                size: 64,
                color: AppColors.primary,
              ),
              const SizedBox(height: 24),
              Text(
                'Nhập mã xác thực',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Chúng tôi đã gửi mã xác thực gồm 6 chữ số vào địa chỉ email:\n${widget.email}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 32),
              
              // OTP Field
              TextFormField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 8),
                decoration: const InputDecoration(
                  hintText: '000000',
                  counterText: '',
                ),
                maxLength: 6,
                validator: (value) {
                  if (value == null || value.trim().length != 6) {
                    return 'Mã OTP phải có đúng 6 chữ số';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              
              // Verify Button
              authProvider.isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : ElevatedButton(
                      onPressed: _verify,
                      child: const Text('XÁC THỰC NGAY'),
                    ),
              const SizedBox(height: 20),
              
              // Resend code link
              TextButton(
                onPressed: authProvider.isLoading ? null : _resend,
                child: const Text(
                  'Gửi lại mã OTP',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}