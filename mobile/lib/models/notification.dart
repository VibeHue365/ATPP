import 'package:flutter/material.dart';

class NotificationModel {
  final String id;
  final String title;
  final String content;
  final String type;
  final DateTime createdAt;
  bool isRead;
  final Map<String, dynamic> metadata;

  NotificationModel({
    required this.id,
    required this.title,
    required this.content,
    required this.type,
    required this.createdAt,
    this.isRead = false,
    this.metadata = const {},
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['_id'] ?? json['id'] ?? '',
      title: json['title'] ?? '',
      content: json['content'] ?? '',
      type: json['type'] ?? 'SYSTEM',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      isRead: json['isRead'] ?? false,
      metadata: json['metadata'] ?? {},
    );
  }

  IconData get icon {
    switch (type) {
      case 'BOOKING':
        return Icons.calendar_today;
      case 'PAYMENT':
        return Icons.payment;
      case 'HANDOVER':
        return Icons.handshake;
      case 'REFUND':
        return Icons.replay;
      case 'DISPUTE':
        return Icons.gavel;
      case 'SYSTEM':
      default:
        return Icons.celebration;
    }
  }

  Color get iconColor {
    switch (type) {
      case 'BOOKING':
        return Colors.blue;
      case 'PAYMENT':
        return Colors.green;
      case 'HANDOVER':
        return Colors.orange;
      case 'REFUND':
        return Colors.purple;
      case 'DISPUTE':
        return Colors.red;
      case 'SYSTEM':
      default:
        return const Color(0xFFC0A060); // AppColors.gold equivalent
    }
  }
}
