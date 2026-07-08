class Voucher {
  final String id;
  final String code;
  final String discountType; // 'PERCENTAGE' or 'FIXED'
  final double discountValue;
  final double minOrderValue;
  final double maxDiscount;
  final DateTime? startDate;
  final DateTime? endDate;
  final bool isActive;

  Voucher({
    required this.id,
    required this.code,
    required this.discountType,
    required this.discountValue,
    this.minOrderValue = 0.0,
    this.maxDiscount = 0.0,
    this.startDate,
    this.endDate,
    this.isActive = true,
  });

  factory Voucher.fromJson(Map<String, dynamic> json) {
    return Voucher(
      id: json['_id'] ?? json['id'] ?? '',
      code: json['code'] ?? '',
      discountType: json['discountType'] ?? 'PERCENTAGE',
      discountValue: (json['discountValue'] ?? 0.0).toDouble(),
      minOrderValue: (json['minOrderValue'] ?? 0.0).toDouble(),
      maxDiscount: (json['maxDiscount'] ?? 0.0).toDouble(),
      startDate: json['startDate'] != null ? DateTime.parse(json['startDate']) : null,
      endDate: json['endDate'] != null ? DateTime.parse(json['endDate']) : null,
      isActive: json['isActive'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'code': code,
      'discountType': discountType,
      'discountValue': discountValue,
      'minOrderValue': minOrderValue,
      'maxDiscount': maxDiscount,
      'startDate': startDate?.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'isActive': isActive,
    };
  }
}
