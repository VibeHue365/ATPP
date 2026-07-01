class UserFavorite {
  final String targetType;
  final String targetId;
  final DateTime addedAt;

  UserFavorite({
    required this.targetType,
    required this.targetId,
    required this.addedAt,
  });

  factory UserFavorite.fromJson(Map<String, dynamic> json) {
    return UserFavorite(
      targetType: json['targetType'] ?? '',
      targetId: json['targetId'] ?? '',
      addedAt: json['addedAt'] != null ? DateTime.parse(json['addedAt']) : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'targetType': targetType,
        'targetId': targetId,
        'addedAt': addedAt.toIso8601String(),
      };
}

class User {
  final String id;
  final String email;
  final String? phone;
  final bool emailVerified;
  final bool phoneVerified;
  final String status;
  final List<String> roles;
  final UserProfile? profile;
  final List<UserFavorite> favorites;

  // Convenience
  String get role => roles.isNotEmpty ? roles.first : 'CUSTOMER';
  String get name => profile?.fullName ?? email;
  String? get avatarUrl {
    final url = profile?.avatarUrl;
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('http')) return url;
    return 'http://10.0.2.2:3000$url';
  }


  User({
    required this.id,
    required this.email,
    this.phone,
    this.emailVerified = false,
    this.phoneVerified = false,
    this.status = 'active',
    this.roles = const [],
    this.profile,
    this.favorites = const [],
  });

  factory User.fromJson(Map<String, dynamic> json) {
    var favList = json['favorites'] as List?;
    List<UserFavorite> parsedFavorites = favList != null
        ? favList.map((x) => UserFavorite.fromJson(x)).toList()
        : [];

    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'],
      emailVerified: json['emailVerified'] ?? false,
      phoneVerified: json['phoneVerified'] ?? false,
      status: json['status'] ?? 'active',
      roles: List<String>.from(json['roles'] ?? []),
      profile: json['profile'] != null ? UserProfile.fromJson(json['profile']) : null,
      favorites: parsedFavorites,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'phone': phone,
        'emailVerified': emailVerified,
        'phoneVerified': phoneVerified,
        'status': status,
        'roles': roles,
        'profile': profile?.toJson(),
        'favorites': favorites.map((x) => x.toJson()).toList(),
      };
}


class UserProfile {
  final String? fullName;
  final String? phone;
  final String? gender;
  final String? dateOfBirth;
  final String? avatarUrl;

  UserProfile({
    this.fullName,
    this.phone,
    this.gender,
    this.dateOfBirth,
    this.avatarUrl,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      fullName: json['fullName'],
      phone: json['phone'],
      gender: json['gender'],
      dateOfBirth: json['dateOfBirth'],
      avatarUrl: json['avatarUrl'],
    );
  }

  Map<String, dynamic> toJson() => {
        'fullName': fullName,
        'phone': phone,
        'gender': gender,
        'dateOfBirth': dateOfBirth,
        'avatarUrl': avatarUrl,
      };
}
