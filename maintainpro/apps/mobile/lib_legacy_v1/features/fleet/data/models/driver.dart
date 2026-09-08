class Driver {
  Driver({
    required this.id,
    required this.userId,
    required this.licenseNumber,
    required this.licenseClass,
    required this.licenseExpiry,
    this.isAvailable = true,
    this.user,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String userId;
  final String licenseNumber;
  final String licenseClass;
  final DateTime licenseExpiry;
  final bool isAvailable;
  final DriverUser? user;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool get licenseExpired => licenseExpiry.isBefore(DateTime.now());

  bool get licenseExpiresSoon {
    final diff = licenseExpiry.difference(DateTime.now());
    return !diff.isNegative && diff.inDays <= 30;
  }

  String get displayName {
    final u = user;
    if (u == null) return 'Driver';
    final first = u.firstName.trim();
    final last = u.lastName.trim();
    final full = [first, last].where((s) => s.isNotEmpty).join(' ');
    if (full.isNotEmpty) return full;
    if (u.email.isNotEmpty) return u.email;
    return 'Driver';
  }

  factory Driver.fromJson(Map<String, dynamic> json) {
    DateTime? d(dynamic v) =>
        v == null ? null : DateTime.tryParse(v.toString());
    final u = json['user'];
    return Driver(
      id: (json['id'] ?? '').toString(),
      userId: (json['userId'] ?? '').toString(),
      licenseNumber: (json['licenseNumber'] ?? '').toString(),
      licenseClass: (json['licenseClass'] ?? '').toString(),
      licenseExpiry: d(json['licenseExpiry']) ?? DateTime.now(),
      isAvailable: json['isAvailable'] == true,
      user: u is Map ? DriverUser.fromJson(Map<String, dynamic>.from(u)) : null,
      createdAt: d(json['createdAt']),
      updatedAt: d(json['updatedAt']),
    );
  }
}

class DriverUser {
  DriverUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    this.phone,
    this.avatarUrl,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String? phone;
  final String? avatarUrl;

  factory DriverUser.fromJson(Map<String, dynamic> json) => DriverUser(
        id: (json['id'] ?? '').toString(),
        firstName: (json['firstName'] ?? '').toString(),
        lastName: (json['lastName'] ?? '').toString(),
        email: (json['email'] ?? '').toString(),
        phone: json['phone']?.toString(),
        avatarUrl: json['avatarUrl']?.toString(),
      );
}
