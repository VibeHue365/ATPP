import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../providers/provider_provider.dart';

class VoucherManagerView extends StatefulWidget {
  const VoucherManagerView({super.key});

  @override
  State<VoucherManagerView> createState() => _VoucherManagerViewState();
}

class _VoucherManagerViewState extends State<VoucherManagerView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProviderProvider>().loadProviderVouchers();
    });
  }

  void _showAddVoucherDialog() {
    final codeController = TextEditingController();
    final nameController = TextEditingController();
    final discountValController = TextEditingController();
    final minOrderValController = TextEditingController();
    String discountType = 'PERCENTAGE';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Tạo mã giảm giá mới'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: codeController,
                decoration: const InputDecoration(labelText: 'Mã giảm giá (ví dụ: UUDAI30)'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Tên chiến dịch'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: discountType,
                decoration: const InputDecoration(labelText: 'Loại giảm giá'),
                items: const [
                  DropdownMenuItem(value: 'PERCENTAGE', child: Text('Giảm theo phần trăm (%)')),
                  DropdownMenuItem(value: 'FIXED_AMOUNT', child: Text('Giảm theo số tiền cố định')),
                ],
                onChanged: (val) {
                  if (val != null) discountType = val;
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: discountValController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Giá trị giảm (phần trăm hoặc số tiền)'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: minOrderValController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Giá trị đơn tối thiểu để áp dụng'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('HỦY BỎ'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final provider = context.read<ProviderProvider>();
              final success = await provider.createVoucher({
                'code': codeController.text.trim().toUpperCase(),
                'name': nameController.text.trim(),
                'discountType': discountType,
                'discountValue': double.tryParse(discountValController.text) ?? 0.0,
                'minOrderValue': double.tryParse(minOrderValController.text) ?? 0.0,
                'startDate': DateTime.now().toIso8601String(),
                'endDate': DateTime.now().add(const Duration(days: 30)).toIso8601String(),
              });

              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      success ? 'Đã tạo mã giảm giá mới thành công!' : 'Tạo mã giảm giá thất bại.',
                    ),
                  ),
                );
              }
            },
            child: const Text('TẠO MỚI'),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(String voucherId) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa mã giảm giá'),
        content: const Text('Bạn có chắc chắn muốn xóa mã giảm giá này? Người dùng sẽ không thể áp dụng mã này nữa.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('HỦY'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await context.read<ProviderProvider>().deleteVoucher(voucherId);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      success ? 'Đã xóa mã thành công!' : 'Xóa mã thất bại.',
                    ),
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('XÓA'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProviderProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Quản lý khuyến mãi'),
      ),
      body: provider.isLoading && provider.providerVouchers.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () => provider.loadProviderVouchers(),
              child: provider.providerVouchers.isEmpty
                  ? const Center(
                      child: Text('Bạn chưa tạo chương trình khuyến mãi nào.'),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: provider.providerVouchers.length,
                      itemBuilder: (context, index) {
                        final voucher = provider.providerVouchers[index];
                        final isPercentage = voucher.discountType == 'PERCENTAGE';
                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: ListTile(
                            leading: const CircleAvatar(
                              backgroundColor: AppColors.primaryTrans,
                              child: Icon(Icons.local_offer, color: AppColors.primary),
                            ),
                            title: Text(
                              voucher.code,
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                            ),
                            subtitle: Text(
                              'Giảm: ${voucher.discountValue.toStringAsFixed(0)}${isPercentage ? "%" : "đ"} | Đơn tối thiểu: ${voucher.minOrderValue.toStringAsFixed(0)}đ',
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline, color: AppColors.error),
                              onPressed: () => _confirmDelete(voucher.id),
                            ),
                          ),
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddVoucherDialog,
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}