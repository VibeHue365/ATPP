class Product {
  final String id;
  final String name;
  final String description;
  final double price;
  final double depositPrice;
  final String? imageUrl;
  final String category;
  final String providerId;
  final List<String> availableSizes;

  Product({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.depositPrice,
    this.imageUrl,
    required this.category,
    required this.providerId,
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
      providerId: (json['providerId'] is Map ? (json['providerId']['_id'] ?? json['providerId']['id']) : json['providerId']) ?? (json['provider'] is Map ? (json['provider']['_id'] ?? json['provider']['id']) : json['provider']) ?? '',
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
      'providerId': providerId,
      'availableSizes': availableSizes,
    };
  }
}
