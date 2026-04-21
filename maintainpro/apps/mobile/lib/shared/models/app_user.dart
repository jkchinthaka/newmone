enum UserRole {
  superAdmin,
  admin,
  manager,
  technician,
  driver,
  viewer,
}

extension UserRoleParser on UserRole {
  static UserRole fromApiName(String? rawRole) {
    final normalized = (rawRole ?? '').trim().toUpperCase();
    switch (normalized) {
      case 'SUPER_ADMIN':
      case 'SUPERADMIN':
        return UserRole.superAdmin;
      case 'ADMIN':
        return UserRole.admin;
      case 'MANAGER':
        return UserRole.manager;
      case 'TECHNICIAN':
        return UserRole.technician;
      case 'DRIVER':
        return UserRole.driver;
      case 'VIEWER':
        return UserRole.viewer;
      default:
        return UserRole.technician;
    }
  }
}

class AppUser {
  AppUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.role,
  });

  final String id;
  final String email;
  final String displayName;
  final UserRole role;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    final rolePayload = json['role'];
    String? roleName;

    if (rolePayload is Map<String, dynamic>) {
      roleName = rolePayload['name']?.toString();
    } else {
      roleName = rolePayload?.toString();
    }

    final firstName = (json['firstName'] ?? '').toString().trim();
    final lastName = (json['lastName'] ?? '').toString().trim();
    final fallbackDisplayName = [firstName, lastName]
        .where((value) => value.isNotEmpty)
        .join(' ')
        .trim();

    final displayName = (json['displayName'] ?? '').toString().trim();
    final email = (json['email'] ?? '').toString().trim();

    return AppUser(
      id: (json['id'] ?? '').toString(),
      email: email,
      displayName: displayName.isNotEmpty
          ? displayName
          : (fallbackDisplayName.isNotEmpty ? fallbackDisplayName : email),
      role: UserRoleParser.fromApiName(roleName),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'displayName': displayName,
      'role': role.name,
    };
  }
}
