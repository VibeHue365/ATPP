import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../providers/provider_provider.dart';

class ScheduleManagerView extends StatefulWidget {
  const ScheduleManagerView({super.key});

  @override
  State<ScheduleManagerView> createState() => _ScheduleManagerViewState();
}

class _ScheduleManagerViewState extends State<ScheduleManagerView> {
  final List<String> _daysOfWeek = [
    'Chủ nhật',
    'Thứ hai',
    'Thứ ba',
    'Thứ tư',
    'Thứ năm',
    'Thứ sáu',
    'Thứ bảy',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProviderProvider>().loadSchedules();
    });
  }

  void _showAddRecurringSlotDialog(int dayOfWeek) {
    final startController = TextEditingController(text: '08:00');
    final endController = TextEditingController(text: '12:00');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Thêm khung giờ làm việc: ${_daysOfWeek[dayOfWeek]}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: startController,
              decoration: const InputDecoration(labelText: 'Giờ bắt đầu (HH:mm)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: endController,
              decoration: const InputDecoration(labelText: 'Giờ kết thúc (HH:mm)'),
            ),
          ],
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
              
              // Standard time formatting checks
              final newSlot = {
                'start': startController.text.trim(),
                'end': endController.text.trim(),
              };

              // Re-assemble slots array
              final List<Map<String, String>> currentSlots = [];
              final recurringSchedules = provider.schedules['recurring'] as List? ?? [];
              final foundDay = recurringSchedules.firstWhere(
                (element) => element['dayOfWeek'] == dayOfWeek,
                orElse: () => null,
              );
              if (foundDay != null && foundDay['workingHours'] != null) {
                for (var slot in foundDay['workingHours']) {
                  currentSlots.add({
                    'start': slot['start']?.toString() ?? '',
                    'end': slot['end']?.toString() ?? '',
                  });
                }
              }
              currentSlots.add(newSlot);

              final success = await provider.updateRecurringSchedule(dayOfWeek, currentSlots);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      success ? 'Đã thêm khung giờ làm việc mới!' : 'Thêm khung giờ làm việc thất bại.',
                    ),
                  ),
                );
              }
            },
            child: const Text('THÊM MỚI'),
          ),
        ],
      ),
    );
  }

  void _toggleOffDayDialog() {
    final dateController = TextEditingController(text: DateTime.now().add(const Duration(days: 1)).toIso8601String().substring(0, 10));
    bool isOff = true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setStateDialog) => AlertDialog(
          title: const Text('Chặn lịch ngày bận'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: dateController,
                decoration: const InputDecoration(
                  labelText: 'Ngày chọn (yyyy-MM-dd)',
                  suffixIcon: Icon(Icons.calendar_month),
                ),
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                title: const Text('Nghỉ cả ngày (Off Day)'),
                value: isOff,
                onChanged: (val) {
                  setStateDialog(() {
                    isOff = val;
                  });
                },
              )
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
                final provider = context.read<ProviderProvider>();
                final success = await provider.updateSpecificDateSchedule(
                  dateController.text.trim(),
                  isOff,
                  [], // empty slots if full off day
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        success ? 'Đã cập nhật lịch bận!' : 'Cập nhật lịch bận thất bại.',
                      ),
                    ),
                  );
                }
              },
              child: const Text('CẬP NHẬT'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProviderProvider>();
    final theme = Theme.of(context);

    final recurringSchedules = provider.schedules['recurring'] as List? ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Quản lý thời gian biểu'),
        actions: [
          IconButton(
            icon: const Icon(Icons.block, color: AppColors.primary),
            tooltip: 'Chặn lịch bận',
            onPressed: _toggleOffDayDialog,
          )
        ],
      ),
      body: provider.isLoading && provider.schedules.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () => provider.loadSchedules(),
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: 7,
                itemBuilder: (context, index) {
                  // Find existing schedules for this day of week
                  final daySched = recurringSchedules.firstWhere(
                    (element) => element['dayOfWeek'] == index,
                    orElse: () => null,
                  );
                  final List workingHours = daySched != null ? (daySched['workingHours'] as List? ?? []) : [];

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _daysOfWeek[index],
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                              IconButton(
                                icon: const Icon(Icons.add_circle_outline, color: AppColors.primary),
                                onPressed: () => _showAddRecurringSlotDialog(index),
                              ),
                            ],
                          ),
                          const Divider(),
                          workingHours.isEmpty
                              ? const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 8.0),
                                  child: Text(
                                    'Không có khung giờ làm việc (Đóng cửa)',
                                    style: TextStyle(color: AppColors.textSecondary, fontStyle: FontStyle.italic),
                                  ),
                                )
                              : Wrap(
                                  spacing: 8,
                                  children: workingHours.map((slot) {
                                    return Chip(
                                      label: Text('${slot['start']} - ${slot['end']}'),
                                      backgroundColor: AppColors.primaryTrans,
                                    );
                                  }).toList(),
                                )
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