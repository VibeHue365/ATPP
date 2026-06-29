class Booking {
  final String id;
  final String bookingCode;
  final String customerId;
  final List<String> providerIds;
  final String bookingType; // 'AODAI_RENTAL', 'PHOTOGRAPHY', 'COMBO'
  final String status; // 'DRAFT', 'PENDING_PAYMENT', 'DEPOSIT_PAID', 'CONFIRMED', 'COMPLETED', 'CANCELLED'
  final BookingPricingSummary pricingSummary;
  final BookingPaymentSummary paymentSummary;
  final BookingCancellation? cancellation;
  final List<BookingItem> items;
  final String? contractId;
  final String? createdAt;

  Booking({
    required this.id,
    required this.bookingCode,
    required this.customerId,
    required this.providerIds,
    required this.bookingType,
    required this.status,
    required this.pricingSummary,
    required this.paymentSummary,
    this.cancellation,
    this.items = const [],
    this.contractId,
    this.createdAt,
  });

  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      id: json['_id'] ?? json['id'] ?? '',
      bookingCode: json['bookingCode'] ?? '',
      customerId: json['customerId'] is Map
          ? (json['customerId']['_id'] ?? json['customerId']['id'] ?? '').toString()
          : (json['customerId'] ?? '').toString(),
      providerIds: List<String>.from((json['providerIds'] ?? []).map((x) {
        if (x is Map) {
          return (x['_id'] ?? x['id'] ?? '').toString();
        }
        return x.toString();
      })),
      bookingType: json['bookingType'] ?? 'AODAI_RENTAL',
      status: json['status'] ?? 'DRAFT',
      pricingSummary: BookingPricingSummary.fromJson(json['pricingSummary'] ?? {}),
      paymentSummary: BookingPaymentSummary.fromJson(json['paymentSummary'] ?? {}),
      cancellation: json['cancellation'] != null ? BookingCancellation.fromJson(json['cancellation']) : null,
      items: json['items'] != null
          ? List<BookingItem>.from(json['items'].map((x) => BookingItem.fromJson(x)))
          : [],
      contractId: json['contractId'] is Map
          ? (json['contractId']['_id'] ?? json['contractId']['id'] ?? '').toString()
          : json['contractId']?.toString(),
      createdAt: json['createdAt'],
    );
  }
}

class BookingPricingSummary {
  final double subTotal;
  final double depositTotal;
  final double discountAmount;
  final double travelFee;
  final double overtimeFee;
  final double lateFee;
  final double damageFee;
  final double grandTotal;

  BookingPricingSummary({
    this.subTotal = 0.0,
    this.depositTotal = 0.0,
    this.discountAmount = 0.0,
    this.travelFee = 0.0,
    this.overtimeFee = 0.0,
    this.lateFee = 0.0,
    this.damageFee = 0.0,
    this.grandTotal = 0.0,
  });

  factory BookingPricingSummary.fromJson(Map<String, dynamic> json) {
    return BookingPricingSummary(
      subTotal: (json['subTotal'] ?? 0.0).toDouble(),
      depositTotal: (json['depositTotal'] ?? 0.0).toDouble(),
      discountAmount: (json['discountAmount'] ?? 0.0).toDouble(),
      travelFee: (json['travelFee'] ?? 0.0).toDouble(),
      overtimeFee: (json['overtimeFee'] ?? 0.0).toDouble(),
      lateFee: (json['lateFee'] ?? 0.0).toDouble(),
      damageFee: (json['damageFee'] ?? 0.0).toDouble(),
      grandTotal: (json['grandTotal'] ?? 0.0).toDouble(),
    );
  }
}

class BookingPaymentSummary {
  final double totalPaid;
  final double totalRefunded;
  final String paymentStatus; // 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'

  BookingPaymentSummary({
    this.totalPaid = 0.0,
    this.totalRefunded = 0.0,
    this.paymentStatus = 'UNPAID',
  });

  factory BookingPaymentSummary.fromJson(Map<String, dynamic> json) {
    return BookingPaymentSummary(
      totalPaid: (json['totalPaid'] ?? 0.0).toDouble(),
      totalRefunded: (json['totalRefunded'] ?? 0.0).toDouble(),
      paymentStatus: json['paymentStatus'] ?? 'UNPAID',
    );
  }
}

class BookingCancellation {
  final String? cancelledBy;
  final String? reason;
  final String? cancelledAt;
  final double refundAmount;

  BookingCancellation({
    this.cancelledBy,
    this.reason,
    this.cancelledAt,
    this.refundAmount = 0.0,
  });

  factory BookingCancellation.fromJson(Map<String, dynamic> json) {
    return BookingCancellation(
      cancelledBy: json['cancelledBy'],
      reason: json['reason'],
      cancelledAt: json['cancelledAt'],
      refundAmount: (json['refundAmount'] ?? 0.0).toDouble(),
    );
  }
}

class BookingItem {
  final String id;
  final String bookingId;
  final String providerId;
  final String itemType; // 'PRODUCT', 'PHOTOGRAPHY_PACKAGE'
  final String? productId;
  final String? photographyPackageId;
  final double unitPrice;
  final double depositAmount;
  final int quantity;
  final String? rentalFrom;
  final String? rentalTo;
  final String? shootDate;
  final String? shootTimeSlot;
  final String? shootLocation;
  final String? shootConcept;
  final String? selectedSize;
  final String? selectedColor;
  final String? customRequests;

  BookingItem({
    required this.id,
    required this.bookingId,
    required this.providerId,
    required this.itemType,
    this.productId,
    this.photographyPackageId,
    required this.unitPrice,
    required this.depositAmount,
    required this.quantity,
    this.rentalFrom,
    this.rentalTo,
    this.shootDate,
    this.shootTimeSlot,
    this.shootLocation,
    this.shootConcept,
    this.selectedSize,
    this.selectedColor,
    this.customRequests,
  });

  factory BookingItem.fromJson(Map<String, dynamic> json) {
    return BookingItem(
      id: json['_id'] ?? json['id'] ?? '',
      bookingId: json['bookingId'] ?? '',
      providerId: json['providerId'] is Map
          ? (json['providerId']['_id'] ?? json['providerId']['id'] ?? '').toString()
          : (json['providerId'] ?? '').toString(),
      itemType: json['itemType'] ?? 'PRODUCT',
      productId: json['productId'] is Map
          ? (json['productId']['_id'] ?? json['productId']['id'] ?? '').toString()
          : json['productId']?.toString(),
      photographyPackageId: json['photographyPackageId'] is Map
          ? (json['photographyPackageId']['_id'] ?? json['photographyPackageId']['id'] ?? '').toString()
          : json['photographyPackageId']?.toString(),
      unitPrice: (json['unitPrice'] ?? 0.0).toDouble(),
      depositAmount: (json['depositAmount'] ?? 0.0).toDouble(),
      quantity: json['quantity'] ?? 1,
      rentalFrom: json['rentalFrom'],
      rentalTo: json['rentalTo'],
      shootDate: json['shootDate'],
      shootTimeSlot: json['shootTimeSlot'],
      shootLocation: json['shootLocation'],
      shootConcept: json['shootConcept'],
      selectedSize: json['selectedSize'],
      selectedColor: json['selectedColor'],
      customRequests: json['customRequests'],
    );
  }
}