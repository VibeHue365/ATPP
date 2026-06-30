import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

class NotificationItem {
  final String id;
  final String title;
  final String body;
  final DateTime timestamp;
  bool isRead;
  final IconData icon;
  final Color iconColor;

  NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.timestamp,
    this.isRead = false,
    required this.icon,
    this.iconColor = AppColors.primary,
  });
}

class NotificationsView extends StatefulWidget {
  const NotificationsView({super.key});

  @override
  State<NotificationsView> createState() => _NotificationsViewState();
}

class _NotificationsViewState extends State<NotificationsView> {
  final List<NotificationItem> _notifications = [
    NotificationItem(
      id: '1',
      title: 'Đăng ký tài khoản thành công',
      body: 'Chào mừng quý khách đến với VibeHue - Ứng dụng gìn giữ và quảng bá di sản Áo dài Việt cổ!',
      timestamp: DateTime.now().subtract(const Duration(hours: 4)),
      icon: Icons.celebration,
      iconColor: AppColors.gold,
    ),
    NotificationItem(
      id: '2',
      title: 'Voucher giảm giá 20% sắp hết hạn',
      body: 'Mã giảm giá HIEN20 dành riêng cho bạn sẽ hết hạn vào ngày mai. Hãy nhanh chóng lựa chọn phục trang ngay!',
      timestamp: DateTime.now().subtract(const Duration(days: 1)),
      icon: Icons.local_offer,
      iconColor: AppColors.primary,
      isRead: true,
    ),
    NotificationItem(
      id: '3',
      title: 'Đề xuất trang phục từ Trợ lý AI',
      body: 'Bộ Nhật Bình Xanh ngọc lục bảo rất hợp với sở thích chụp ngoại cảnh cung đình của bạn. Nhấn để xem chi tiết!',
      timestamp: DateTime.now().subtract(const Duration(days: 2)),
      icon: Icons.psychology,
      iconColor: Colors.purple,
      isRead: true,
    ),
    NotificationItem(
      id: '4',
      title: 'Lịch sử di sản: Áo ngũ thân',
      body: 'Bạn có biết Áo ngũ thân lập lĩnh ra đời dưới thời nhà Nguyễn không? Hãy cùng tìm hiểu nét đẹp xưa nhé.',
      timestamp: DateTime.now().subtract(const Duration(days: 3)),
      icon: Icons.auto_stories,
      iconColor: Colors.brown,
      isRead: true,
    ),
  ];

  void _markAllAsRead() {
    setState(() {
      for (var n in _notifications) {
        n.isRead = true;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Đã đánh dấu tất cả thông báo là đã đọc')),
    );
  }

  void _clearAll() {
    setState(() {
      _notifications.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Thông báo'),
        actions: [
          if (_notifications.isNotEmpty) ...[
            IconButton(
              icon: const Icon(Icons.mark_chat_read_outlined),
              tooltip: 'Đọc tất cả',
              onPressed: _markAllAsRead,
            ),
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined),
              tooltip: 'Xóa hết',
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Xóa tất cả'),
                    content: const Text('Quý khách muốn xóa toàn bộ thông báo?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('ĐÓNG'),
                      ),
                      ElevatedButton(
                        onPressed: () {
                          _clearAll();
                          Navigator.pop(ctx);
                        },
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                        child: const Text('XÓA'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ]
        ],
      ),
      body: _notifications.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_off_outlined,
                    size: 80,
                    color: AppColors.primary.withOpacity(0.3),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Không có thông báo nào mới',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppColors.textSecondary,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              itemCount: _notifications.length,
              itemBuilder: (context, index) {
                final item = _notifications[index];
                return Dismissible(
                  key: Key(item.id),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20.0),
                    margin: const EdgeInsets.symmetric(vertical: 6.0),
                    decoration: BoxDecoration(
                      color: AppColors.error,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.delete, color: Colors.white),
                  ),
                  onDismissed: (_) {
                    setState(() {
                      _notifications.removeAt(index);
                    });
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Đã xóa thông báo')),
                    );
                  },
                  child: Card(
                    elevation: item.isRead ? 1 : 3,
                    margin: const EdgeInsets.symmetric(vertical: 6.0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: item.isRead
                          ? BorderSide.none
                          : const BorderSide(color: AppColors.gold, width: 0.8),
                    ),
                    child: InkWell(
                      onTap: () {
                        setState(() {
                          item.isRead = true;
                        });
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        decoration: BoxDecoration(
                          color: item.isRead
                              ? Colors.white
                              : AppColors.primaryTrans.withOpacity(0.02),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              backgroundColor: item.iconColor.withOpacity(0.1),
                              radius: 20,
                              child: Icon(item.icon, color: item.iconColor, size: 20),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          item.title,
                                          style: TextStyle(
                                            fontWeight: item.isRead
                                                ? FontWeight.normal
                                                : FontWeight.bold,
                                            fontSize: 14,
                                            color: AppColors.textPrimary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (!item.isRead)
                                        Container(
                                          width: 8,
                                          height: 8,
                                          decoration: const BoxDecoration(
                                            color: AppColors.primary,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    item.body,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                      height: 1.4,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    _formatTime(item.timestamp),
                                    style: const TextStyle(
                                      fontSize: 10,
                                      color: AppColors.textSecondary,
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes} phút trước';
    } else if (diff.inHours < 24) {
      return '${diff.inHours} giờ trước';
    } else {
      return '${dt.day}/${dt.month}/${dt.year}';
    }
  }
}
