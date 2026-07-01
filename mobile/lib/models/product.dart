import '../core/network/api_client.dart';

class Product {
  final String id;
  final String name;
  final String description;
  final double price;
  final double depositPrice;
  final String? imageUrl;
  final String category;
  final String categoryId;
  final String providerId;
  final String? providerUserId;
  final List<String> availableSizes;

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
    this.imageUrl,
    required this.category,
    required this.categoryId,
    required this.providerId,
    this.providerUserId,
    this.availableSizes = const [],
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      price: ((json['basePrice'] ?? json['price'] ?? 0) as num).toDouble(),
      depositPrice: ((json['depositAmount'] ?? json['depositPrice'] ?? 0) as num).toDouble(),
      imageUrl: (json['images'] != null && (json['images'] as List).isNotEmpty)
          ? (json['images'] as List).first as String
          : (json['imageUrl'] ?? json['image']),
      category: (json['categoryId'] is Map ? json['categoryId']['name'] : null) ?? json['category'] ?? 'Ao Dai',
      categoryId: (json['categoryId'] is Map ? (json['categoryId']['_id'] ?? json['categoryId']['id']) : json['categoryId']) ?? '',
      providerId: (json['providerId'] is Map ? (json['providerId']['_id'] ?? json['providerId']['id']) : json['providerId']) ?? (json['provider'] is Map ? (json['provider']['_id'] ?? json['provider']['id']) : json['provider']) ?? '',
      providerUserId: (json['providerId'] is Map
          ? (json['providerId']['userId'] is Map
              ? (json['providerId']['userId']['_id'] ?? json['providerId']['userId']['id'])
              : json['providerId']['userId'])
          : null)?.toString(),
      availableSizes: List<String>.from(json['sizes'] ?? json['availableSizes'] ?? []),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'price': price,
      'depositPrice': depositPrice,
      'imageUrl': imageUrl,
      'category': category,
      'categoryId': categoryId,
      'providerId': providerId,
      'providerUserId': providerUserId,
      'availableSizes': availableSizes,
    };
  }
}

