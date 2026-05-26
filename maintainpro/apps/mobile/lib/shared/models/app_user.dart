enum UserRole {
  superAdmin,
  admin,
  manager,
  securityOfficer,
  technician,
  mechanic,
  assetManager,
  inventoryKeeper,
  supervisor,
  cleaner,
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
      case 'OPERATIONS_MANAGER':
      case 'FLEET_MANAGER':
      case 'COMPLIANCE_MANAGER':
      case 'MANAGER':
        return UserRole.manager;
      case 'SECURITY_OFFICER':
        return UserRole.securityOfficer;
      case 'TECHNICIAN':
        return UserRole.technician;
      case 'MECHANIC':
        return UserRole.mechanic;
      case 'ASSET_MANAGER':
        return UserRole.assetManager;
      case 'INVENTORY_KEEPER':
        return UserRole.inventoryKeeper;
      case 'SUPERVISOR':
        return UserRole.supervisor;
      case 'CLEANER':
        return UserRole.cleaner;
      case 'DRIVER':
        return UserRole.driver;
      case 'VIEWER':
        return UserRole.viewer;
      default:
        return UserRole.viewer;
    }
  }
}

extension UserRoleCapabilities on UserRole {
  bool get isManagerial => this == UserRole.superAdmin ||
      this == UserRole.admin ||
      this == UserRole.manager ||
      this == UserRole.assetManager ||
      this == UserRole.supervisor;

  bool get isTechnicianLike =>
      this == UserRole.technician || this == UserRole.mechanic;

  bool get supportsFieldOpsBriefing =>
      isManagerial ||
      isTechnicianLike ||
      this == UserRole.driver ||
      this == UserRole.securityOfficer;
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
