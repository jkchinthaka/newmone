enum UserRole {
  superAdmin,
  admin,
  manager,
  technician,
  driver,
  viewer,
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
}
