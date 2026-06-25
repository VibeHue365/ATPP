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
      price: (json['price'] ?? 0.0).toDouble(),
      depositPrice: (json['depositPrice'] ?? 0.0).toDouble(),
      imageUrl: json['imageUrl'] ?? json['image'],
      category: json['category'] ?? 'Ao Dai',
      providerId: json['providerId'] ?? json['provider'] ?? '',
      availableSizes: List<String>.from(json['availableSizes'] ?? json['sizes'] ?? []),
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
