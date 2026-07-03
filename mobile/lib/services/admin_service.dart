import 'package:dio/dio.dart';
import '../core/network/api_client.dart';

class AdminStats {
  final int totalCustomers;
  final int totalProviders;
  final int totalBookings;
  final double totalRevenue;
  final List<Map<String, dynamic>> revenueByWeek;
  final List<Map<String, dynamic>> revenueByMonth;
  final List<Map<String, dynamic>> revenueByYear;

  AdminStats({
    required this.totalCustomers,
    required this.totalProviders,
    required this.totalBookings,
    required this.totalRevenue,
    required this.revenueByWeek,
    required this.revenueByMonth,
    required this.revenueByYear,
  });

  factory AdminStats.fromJson(Map<String, dynamic> json) {
    final listWeek = json['revenueByWeek'] != null
        ? List<Map<String, dynamic>>.from(json['revenueByWeek'])
        : <Map<String, dynamic>>[];
    final listMonth = json['revenueByMonth'] != null
        ? List<Map<String, dynamic>>.from(json['revenueByMonth'])
        : <Map<String, dynamic>>[];
    final listYear = json['revenueByYear'] != null
        ? List<Map<String, dynamic>>.from(json['revenueByYear'])
        : <Map<String, dynamic>>[];

    return AdminStats(
      totalCustomers: json['totalCustomers'] ?? 0,
      totalProviders: json['totalProviders'] ?? 0,
      totalBookings: json['totalBookings'] ?? 0,
      totalRevenue: (json['totalRevenue'] ?? 0.0).toDouble(),
      revenueByWeek: listWeek,
      revenueByMonth: listMonth,
      revenueByYear: listYear,
    );
  }
}

class AdminCustomer {
  final String id;
  final String fullName;
  final String avatarUrl;
  final String email;
  final String phone;
  final String gender;
  final String accountStatus;
  final String? createdAt;

  AdminCustomer({
    required this.id,
    required this.fullName,
    required this.avatarUrl,
    required this.email,
    required this.phone,
    required this.gender,
    required this.accountStatus,
    this.createdAt,
  });

  factory AdminCustomer.fromJson(Map<String, dynamic> json) {
    return AdminCustomer(
      id: json['id'] ?? '',
      fullName: json['fullName'] ?? 'Khách hàng',
      avatarUrl: json['avatarUrl'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      gender: json['gender'] ?? 'N/A',
      accountStatus: json['accountStatus'] ?? 'ACTIVE',
      createdAt: json['createdAt'],
    );
  }
}

class AdminProviderModel {
  final String id;
  final String businessName;
  final String email;
  final String phone;
  final String city;
  final String addressLine;
  final String status;
  final String? createdAt;

  AdminProviderModel({
    required this.id,
    required this.businessName,
    required this.email,
    required this.phone,
    required this.city,
    required this.addressLine,
    required this.status,
    this.createdAt,
  });

  factory AdminProviderModel.fromJson(Map<String, dynamic> json) {
    return AdminProviderModel(
      id: json['id'] ?? '',
      businessName: json['businessName'] ?? 'Đối tác',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      city: json['city'] ?? '',
      addressLine: json['addressLine'] ?? '',
      status: json['status'] ?? 'PENDING_APPROVAL',
      createdAt: json['createdAt'],
    );
  }
}

class AdminService {
  final Dio _dio = ApiClient.dio;

  Future<AdminStats> getStats() async {
    try {
      final response = await _dio.get('/admin/dashboard/stats');
      return AdminStats.fromJson(response.data);
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Lỗi khi lấy dữ liệu thống kê';
    }
  }

  Future<Map<String, dynamic>> getCustomers({int page = 1, int limit = 10}) async {
    try {
      final response = await _dio.get(
        '/admin/dashboard/customers',
        queryParameters: {'page': page, 'limit': limit},
      );
      final Map<String, dynamic> data = response.data;
      final List itemsRaw = data['items'] ?? [];
      final list = itemsRaw.map((x) => AdminCustomer.fromJson(x)).toList();
      return {
        'items': list,
        'total': data['total'] ?? 0,
        'page': data['page'] ?? 1,
        'totalPages': data['totalPages'] ?? 1,
      };
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Lỗi khi lấy danh sách khách hàng';
    }
  }

  Future<Map<String, dynamic>> getProviders({int page = 1, int limit = 10}) async {
    try {
      final response = await _dio.get(
        '/admin/dashboard/providers',
        queryParameters: {'page': page, 'limit': limit},
      );
      final Map<String, dynamic> data = response.data;
      final List itemsRaw = data['items'] ?? [];
      final list = itemsRaw.map((x) => AdminProviderModel.fromJson(x)).toList();
      return {
        'items': list,
        'total': data['total'] ?? 0,
        'page': data['page'] ?? 1,
        'totalPages': data['totalPages'] ?? 1,
      };
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Lỗi khi lấy danh sách đối tác';
    }
  }

  Future<void> banCustomer(String id) async {
    try {
      await _dio.patch('/admin/dashboard/customers/$id/ban');
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Lỗi khi khóa khách hàng';
    }
  }

  Future<void> unbanCustomer(String id) async {
    try {
      await _dio.patch('/admin/dashboard/customers/$id/unban');
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Lỗi khi mở khóa khách hàng';
    }
  }

  Future<void> suspendProvider(String id, String reason) async {
    try {
      await _dio.patch('/admin/providers/$id/suspend', data: {
        'reason': reason,
        'note': reason,
      });
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Lỗi khi đình chỉ đối tác';
    }
  }

  Future<void> unsuspendProvider(String id) async {
    try {
      await _dio.patch('/admin/providers/$id/unsuspend', data: {
        'reason': 'Mở khóa hoạt động',
        'note': 'Mở khóa hoạt động',
      });
    } on DioException catch (e) {
      throw e.response?.data?['message'] ?? 'Lỗi khi khôi phục đối tác';
    }
  }
}
