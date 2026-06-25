class User {
  final String id;
  final String email;
  final String? phone;
  final bool emailVerified;
  final bool phoneVerified;
  final String status;
  final List<String> roles;
  final UserProfile? profile;

  // Convenience
  String get role => roles.isNotEmpty ? roles.first : 'CUSTOMER';
  String get name => profile?.fullName ?? email;
  String? get avatarUrl => profile?.avatarUrl;

  User({
    required this.id,
    required this.email,
    this.phone,
    this.emailVerified = false,
    this.phoneVerified = false,
    this.status = 'active',
    this.roles = const [],
    this.profile,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'],
      emailVerified: json['emailVerified'] ?? false,
      phoneVerified: json['phoneVerified'] ?? false,
      status: json['status'] ?? 'active',
      roles: List<String>.from(json['roles'] ?? []),
      profile: json['profile'] != null ? UserProfile.fromJson(json['profile']) : null,
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
