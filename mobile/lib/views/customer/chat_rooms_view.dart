import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/constants/colors.dart';
import '../../providers/user_chat_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart';
import 'chat_view.dart';

class ChatRoomsView extends StatefulWidget {
  const ChatRoomsView({super.key});

  @override
  State<ChatRoomsView> createState() => _ChatRoomsViewState();
}

class _ChatRoomsViewState extends State<ChatRoomsView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final chatProvider = context.read<UserChatProvider>();
      chatProvider.initSocket();
      chatProvider.loadRooms();
    });
  }

  String _formatTime(DateTime? dateTime) {
    if (dateTime == null) return '';
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 7) {
      return DateFormat('dd/MM/yyyy').format(dateTime);
    } else if (difference.inDays >= 1) {
      return '${difference.inDays} ngày trước';
    } else if (difference.inHours >= 1) {
      return '${difference.inHours} giờ trước';
    } else if (difference.inMinutes >= 1) {
      return '${difference.inMinutes} phút trước';
    } else {
      return 'Vừa xong';
    }
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = context.watch<UserChatProvider>();
    final currentUser = context.read<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tin nhắn liên hệ'),
        actions: [
          IconButton(
            icon: Icon(
              chatProvider.isConnected ? Icons.cloud_done : Icons.cloud_off,
              color: chatProvider.isConnected ? Colors.green : Colors.grey,
              size: 20,
            ),
            onPressed: () {
              if (!chatProvider.isConnected) {
                chatProvider.initSocket();
              }
            },
          ),
        ],
      ),
      body: Container(
        color: AppColors.lightBg,
        child: chatProvider.isLoadingRooms
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              )
            : chatProvider.rooms.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.forum_outlined,
                          size: 72,
                          color: AppColors.gold.withOpacity(0.5),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Chưa có cuộc trò chuyện nào',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 48),
                          child: Text(
                            currentUser?.role == 'PROVIDER'
                                ? 'Các cuộc nhắn tin liên hệ của khách hàng khi đặt lịch sẽ xuất hiện ở đây.'
                                : 'Bạn có thể nhắn tin trực tiếp với Nhà cung cấp/Nhiếp ảnh gia từ trang chi tiết sản phẩm hoặc thợ chụp.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () => chatProvider.loadRooms(),
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: chatProvider.rooms.length,
                      separatorBuilder: (context, index) => const Divider(
                        height: 1,
                        indent: 76,
                        endIndent: 16,
                        color: AppColors.lightBorder,
                      ),
                      itemBuilder: (context, index) {
                        final room = chatProvider.rooms[index];
                        final otherUser = room.otherParticipant;
                        final lastMsg = room.lastMessage;

                        if (otherUser == null) return const SizedBox.shrink();

                        // Determine if there is an unread message
                        final bool hasUnread = lastMsg != null &&
                            !lastMsg.isRead &&
                            lastMsg.senderId != currentUser?.id;

                        // Roles label format
                        String roleLabel = 'Khách hàng';
                        if (otherUser.roles.contains('PROVIDER')) {
                          roleLabel = 'Nhà cung cấp';
                        }
                        if (otherUser.roles.contains('PHOTOGRAPHER') ||
                            otherUser.fullName.toLowerCase().contains('photo') ||
                            otherUser.fullName.toLowerCase().contains('nhiếp ảnh')) {
                          roleLabel = 'Thợ chụp ảnh';
                        }

                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 4,
                          ),
                          leading: Stack(
                            children: [
                              CircleAvatar(
                                radius: 26,
                                backgroundColor: AppColors.primaryTrans,
                                backgroundImage: otherUser.avatarUrl != null
                                    ? NetworkImage(otherUser.avatarUrl!)
                                    : null,
                                child: otherUser.avatarUrl == null
                                    ? const Icon(
                                        Icons.person,
                                        color: AppColors.primary,
                                        size: 26,
                                      )
                                    : null,
                              ),
                              if (chatProvider.isConnected)
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    width: 12,
                                    height: 12,
                                    decoration: BoxDecoration(
                                      color: Colors.green,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: Colors.white,
                                        width: 1.5,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          title: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  otherUser.fullName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _formatTime(room.lastMessageAt),
                                style: TextStyle(
                                  fontSize: 11,
                                  color: hasUnread
                                      ? AppColors.primary
                                      : AppColors.textSecondary,
                                  fontWeight: hasUnread
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                                ),
                              ),
                            ],
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4.0),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  margin: const EdgeInsets.only(right: 8),
                                  decoration: BoxDecoration(
                                    color: AppColors.gold.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: AppColors.gold.withOpacity(0.3),
                                      width: 0.5,
                                    ),
                                  ),
                                  child: Text(
                                    roleLabel.toUpperCase(),
                                    style: const TextStyle(
                                      fontSize: 8.5,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.goldDark,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Text(
                                    lastMsg != null
                                        ? (lastMsg.senderId == currentUser?.id
                                            ? 'Bạn: ${lastMsg.messageText}'
                                            : lastMsg.messageText)
                                        : 'Nhấn để bắt đầu trò chuyện',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: hasUnread
                                          ? AppColors.textPrimary
                                          : AppColors.textSecondary,
                                      fontWeight: hasUnread
                                          ? FontWeight.bold
                                          : FontWeight.normal,
                                    ),
                                  ),
                                ),
                                if (hasUnread)
                                  Container(
                                    width: 10,
                                    height: 10,
                                    margin: const EdgeInsets.only(left: 8),
                                    decoration: const BoxDecoration(
                                      color: AppColors.primary,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          onTap: () {
                            chatProvider.enterRoom(room.id);
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ChatView(
                                  roomId: room.id,
                                  otherParticipantName: otherUser.fullName,
                                  otherParticipantAvatar: otherUser.avatarUrl,
                                ),
                              ),
                            );
                          },
                        );
                      },
                    ),
                  ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showNewChatBottomSheet(context),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add_comment_outlined),
      ),
    );
  }

  void _showNewChatBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const _NewChatBottomSheet(),
    );
  }
}

class _NewChatBottomSheet extends StatefulWidget {
  const _NewChatBottomSheet();

  @override
  State<_NewChatBottomSheet> createState() => _NewChatBottomSheetState();
}

class _NewChatBottomSheetState extends State<_NewChatBottomSheet> {
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bookingProvider = context.watch<BookingProvider>();
    final chatProvider = context.watch<UserChatProvider>();
    final photographers = bookingProvider.photographers;

    // Filter list
    final filtered = photographers.where((p) {
      final name = (p['businessName'] ?? p['fullName'] ?? 'Nhiếp ảnh gia').toString().toLowerCase();
      return name.contains(_searchQuery.toLowerCase());
    }).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.lightBg,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // Bottom sheet drag handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 8, bottom: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Title
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Bắt đầu trò chuyện',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    )
                  ],
                ),
              ),

              // Search Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12.0),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey[300]!),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.search, color: Colors.grey),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          decoration: const InputDecoration(
                            hintText: 'Tìm thợ chụp ảnh & nhà cung cấp...',
                            border: InputBorder.none,
                          ),
                          onChanged: (val) {
                            setState(() {
                              _searchQuery = val;
                            });
                          },
                        ),
                      ),
                      if (_searchQuery.isNotEmpty)
                        GestureDetector(
                          onTap: () {
                            _searchController.clear();
                            setState(() {
                              _searchQuery = '';
                            });
                          },
                          child: const Icon(Icons.clear, color: Colors.grey),
                        ),
                    ],
                  ),
                ),
              ),

              const Divider(),

              // Photographers List
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text(
                          photographers.isEmpty
                              ? 'Đang tải danh sách nhiếp ảnh gia...'
                              : 'Không tìm thấy thợ chụp nào',
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                      )
                    : ListView.separated(
                        controller: scrollController,
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: filtered.length,
                        separatorBuilder: (context, index) => const Divider(
                          height: 1,
                          indent: 72,
                          color: AppColors.lightBorder,
                        ),
                        itemBuilder: (context, index) {
                          final photo = filtered[index];
                          final contact = photo['contact'] ?? {};
                          final String? otherUserId = photo['userId']?.toString();

                          return ListTile(
                            leading: CircleAvatar(
                              radius: 22,
                              backgroundColor: AppColors.primaryTrans,
                              backgroundImage: photo['avatarUrl'] != null
                                  ? NetworkImage(photo['avatarUrl']!)
                                  : null,
                              child: photo['avatarUrl'] == null
                                  ? const Icon(
                                      Icons.person,
                                      color: AppColors.primary,
                                    )
                                  : null,
                            ),
                            title: Text(
                              photo['businessName'] ?? 'Photographer',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            subtitle: Text(
                              contact['phone'] ?? 'Thợ chụp ảnh chuyên nghiệp',
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.textSecondary),
                            ),
                            onTap: () async {
                              if (otherUserId == null) return;

                              // Show loading spinner
                              showDialog(
                                context: context,
                                barrierDismissible: false,
                                builder: (_) => const Center(
                                  child: CircularProgressIndicator(
                                    color: AppColors.primary,
                                  ),
                                ),
                              );

                              try {
                                final roomId = await chatProvider.startChat(otherUserId);

                                if (context.mounted) {
                                  Navigator.pop(context); // Dismiss loading
                                  Navigator.pop(context); // Dismiss bottom sheet

                                  chatProvider.enterRoom(roomId);
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => ChatView(
                                        roomId: roomId,
                                        otherParticipantName: photo['businessName'] ?? 'Nhiếp ảnh gia',
                                        otherParticipantAvatar: photo['avatarUrl'],
                                      ),
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  Navigator.pop(context); // Dismiss loading
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Không thể mở chat: $e')),
                                  );
                                }
                              }
                            },
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}
