import 'dart:io';
import '../core/network/api_client.dart';

class Product {
  final String id;
  final String name;
  final String description;
  final double price;
  final double depositPrice;
  final double? hourlyPrice;
  final String? imageUrl;
  final String category;
  final String categoryId;
  final String providerId;
  final String? providerUserId;
  final String? providerName;
  final List<String> availableSizes;
  final List<String> availableColors;

  String get fullImageUrl {
    if (imageUrl == null || imageUrl!.isEmpty) {
      return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600';
    }
    if (imageUrl!.startsWith('http')) {
      return imageUrl!;
    }
    return '${ApiClient.baseUrl}$imageUrl';
  }

  Product({

    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.depositPrice,
    this.hourlyPrice = 0.0,
    this.imageUrl,
    required this.category,
    required this.categoryId,
    required this.providerId,
    this.providerUserId,
    this.providerName,
    this.availableSizes = const [],
    this.availableColors = const [],
  });

  double get hourlyRate {
    try {
      final hp = hourlyPrice;
      if (hp != null && hp > 0) {
        return hp;
      }
    } catch (_) {}
    return (price * 0.3).roundToDouble();
  }

  static String? _normalizeUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('/')) {
      return '${ApiClient.baseUrl}$url';
    }
    if (url.startsWith('uploads/')) {
      return '${ApiClient.baseUrl}/$url';
    }
    if (Platform.isAndroid) {
      return url.replaceAll('127.0.0.1', '10.0.2.2').replaceAll('localhost', '10.0.2.2');
    }
    return url;
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    final rawImgUrl = (json['images'] != null && (json['images'] as List).isNotEmpty)
        ? (json['images'] as List).first as String
        : (json['imageUrl'] ?? json['image']);

    final sizesRaw = json['sizes'] ?? json['availableSizes'];
    final colorsRaw = json['colors'] ?? json['availableColors'];

    final basePrice = ((json['basePrice'] ?? json['price'] ?? 0) as num).toDouble();

    return Product(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      price: basePrice,
      depositPrice: ((json['depositAmount'] ?? json['depositPrice'] ?? 0) as num).toDouble(),
      hourlyPrice: ((json['hourlyPrice'] ?? (basePrice * 0.3).round()) as num).toDouble(),
      imageUrl: _normalizeUrl(rawImgUrl),
      category: (json['categoryId'] is Map ? json['categoryId']['name'] : null) ?? json['category'] ?? 'Ao Dai',
      categoryId: (json['categoryId'] is Map ? (json['categoryId']['_id'] ?? json['categoryId']['id']) : json['categoryId']) ?? '',
      providerId: (json['providerId'] is Map ? (json['providerId']['_id'] ?? json['providerId']['id']) : json['providerId']) ?? (json['provider'] is Map ? (json['provider']['_id'] ?? json['provider']['id']) : json['provider']) ?? '',
      providerUserId: (json['providerId'] is Map
          ? (json['providerId']['userId'] is Map
              ? (json['providerId']['userId']['_id'] ?? json['providerId']['userId']['id'])
              : json['providerId']['userId'])
          : null)?.toString(),
      providerName: (json['providerId'] is Map
          ? json['providerId']['businessName']
          : (json['provider'] is Map ? json['provider']['businessName'] : null))?.toString(),
      availableSizes: sizesRaw is List ? List<String>.from(sizesRaw.map((x) => x.toString())) : const <String>[],
      availableColors: colorsRaw is List ? List<String>.from(colorsRaw.map((x) => x.toString())) : const <String>[],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'price': price,
      'depositPrice': depositPrice,
      'hourlyPrice': hourlyPrice,
      'imageUrl': imageUrl,
      'category': category,
      'categoryId': categoryId,
      'providerId': providerId,
      'providerUserId': providerUserId,
      'providerName': providerName,
      'availableSizes': availableSizes,
      'availableColors': availableColors,
    };
  }
}
