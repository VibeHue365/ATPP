class Review {
  final String id;
  final String bookingId;
  final String customerId;
  final String customerName;
  final String? customerAvatar;
  final String providerId;
  final int rating;
  final String comment;
  final String? reply;
  final DateTime createdAt;
  final bool isReported;

  Review({
    required this.id,
    required this.bookingId,
    required this.customerId,
    required this.customerName,
    this.customerAvatar,
    required this.providerId,
    required this.rating,
    required this.comment,
    this.reply,
    required this.createdAt,
    this.isReported = false,
  });

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['_id'] ?? json['id'] ?? '',
      bookingId: json['bookingId'] ?? '',
      customerId: json['customerId'] ?? json['customer']?['_id'] ?? '',
      customerName: json['customerName'] ?? json['customer']?['name'] ?? '',
      customerAvatar: json['customerAvatar'] ?? json['customer']?['avatarUrl'],
      providerId: json['providerId'] ?? '',
      rating: json['rating'] ?? 5,
      comment: json['comment'] ?? '',
      reply: json['reply'],
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      isReported: json['isReported'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'bookingId': bookingId,
      'customerId': customerId,
      'customerName': customerName,
      'customerAvatar': customerAvatar,
      'providerId': providerId,
      'rating': rating,
      'comment': comment,
      'reply': reply,
      'createdAt': createdAt.toIso8601String(),
      'isReported': isReported,
    };
  }
}
