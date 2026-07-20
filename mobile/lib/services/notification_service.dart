import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../models/notification.dart';

class NotificationService {
  final Dio _dio = ApiClient.dio;

  Future<List<NotificationModel>> getNotifications() async {
    try {
      final response = await _dio.get('/notifications');
      final List data = response.data;
      return data.map((x) => NotificationModel.fromJson(x)).toList();
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to fetch notifications';
    }
  }

  Future<NotificationModel> markAsRead(String id) async {
    try {
      final response = await _dio.patch('/notifications/$id/read');
      return NotificationModel.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to mark notification as read';
    }
  }

  Future<int> markAllAsRead() async {
    try {
      final response = await _dio.post('/notifications/read-all');
      return response.data['modifiedCount'] ?? 0;
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Failed to mark all as read';
    }
  }
}
