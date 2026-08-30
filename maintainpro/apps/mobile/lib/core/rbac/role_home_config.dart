/// Role → home cards / default queues (mirrors web ROLE_DEFAULT_FAVORITE_NAV_IDS).
library;

class HomeCard {
  const HomeCard({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.route,
    required this.iconName,
  });

  final String id;
  final String title;
  final String subtitle;
  final String route;
  final String iconName;
}

abstract final class RoleHomeConfig {
  static const _technicianCards = [
    HomeCard(
      id: 'my-tasks',
      title: 'My Tasks',
      subtitle: 'Work orders assigned to you',
      route: '/tasks',
      iconName: 'assignment',
    ),
    HomeCard(
      id: 'waiting-evidence',
      title: 'Evidence Needed',
      subtitle: 'Jobs waiting on photos or notes',
      route: '/tasks?queue=waiting-evidence',
      iconName: 'photo_camera',
    ),
    HomeCard(
      id: 'work-orders',
      title: 'Work Orders',
      subtitle: 'Browse and update jobs',
      route: '/work-orders',
      iconName: 'build',
    ),
    HomeCard(
      id: 'vehicles',
      title: 'Vehicles',
      subtitle: 'Fleet vehicle context',
      route: '/fleet/vehicles',
      iconName: 'directions_car',
    ),
    HomeCard(
      id: 'scan',
      title: 'Scan',
      subtitle: 'Asset, QR, or barcode lookup',
      route: '/scan',
      iconName: 'qr_code_scanner',
    ),
  ];

  static const _supervisorCards = [
    HomeCard(
      id: 'supervisor-verification',
      title: 'Pending Verification',
      subtitle: 'Jobs awaiting your sign-off',
      route: '/tasks?queue=supervisor-verification',
      iconName: 'verified',
    ),
    HomeCard(
      id: 'action-center',
      title: 'Action Center',
      subtitle: 'Priorities needing attention',
      route: '/tasks',
      iconName: 'notifications_active',
    ),
    HomeCard(
      id: 'high-risk',
      title: 'High Risk',
      subtitle: 'Elevated risk work orders',
      route: '/tasks?queue=high-risk',
      iconName: 'warning',
    ),
    HomeCard(
      id: 'work-orders',
      title: 'Work Orders',
      subtitle: 'Team workload',
      route: '/work-orders',
      iconName: 'build',
    ),
  ];

  static const _managerCards = [
    HomeCard(
      id: 'high-risk',
      title: 'High Risk',
      subtitle: 'Elevated risk queue',
      route: '/tasks?queue=high-risk',
      iconName: 'warning',
    ),
    HomeCard(
      id: 'action-center',
      title: 'Action Center',
      subtitle: 'Operational priorities',
      route: '/tasks',
      iconName: 'notifications_active',
    ),
    HomeCard(
      id: 'fleet',
      title: 'Fleet',
      subtitle: 'Vehicles, trips, fuel',
      route: '/fleet',
      iconName: 'directions_car',
    ),
    HomeCard(
      id: 'work-orders',
      title: 'Work Orders',
      subtitle: 'Operations overview',
      route: '/work-orders',
      iconName: 'build',
    ),
    HomeCard(
      id: 'more',
      title: 'Modules',
      subtitle: 'Reports, fleet, inventory…',
      route: '/more',
      iconName: 'grid_view',
    ),
  ];

  static const _securityCards = [
    HomeCard(
      id: 'fleet-gate',
      title: 'Gate',
      subtitle: 'Vehicle check-in / check-out',
      route: '/gate',
      iconName: 'local_shipping',
    ),
    HomeCard(
      id: 'action-center',
      title: 'Action Center',
      subtitle: 'Today’s priorities',
      route: '/tasks',
      iconName: 'notifications_active',
    ),
    HomeCard(
      id: 'scan',
      title: 'Scan',
      subtitle: 'Verify vehicle or asset',
      route: '/scan',
      iconName: 'qr_code_scanner',
    ),
  ];

  static const _driverCards = [
    HomeCard(
      id: 'my-vehicle',
      title: 'My Vehicle',
      subtitle: 'Fleet vehicles and trips',
      route: '/fleet/vehicles',
      iconName: 'directions_car',
    ),
    HomeCard(
      id: 'tasks',
      title: 'My Trips / Tasks',
      subtitle: 'Assigned driving work',
      route: '/fleet',
      iconName: 'local_shipping',
    ),
    HomeCard(
      id: 'scan',
      title: 'Scan',
      subtitle: 'Vehicle or document scan',
      route: '/scan',
      iconName: 'qr_code_scanner',
    ),
    HomeCard(
      id: 'alerts',
      title: 'Alerts',
      subtitle: 'Notifications',
      route: '/alerts',
      iconName: 'notifications',
    ),
  ];

  static const _adminCards = [
    HomeCard(
      id: 'system-health',
      title: 'Diagnostics',
      subtitle: 'Connectivity and sync health',
      route: '/diagnostics',
      iconName: 'monitor_heart',
    ),
    HomeCard(
      id: 'action-center',
      title: 'Action Center',
      subtitle: 'Tenant priorities',
      route: '/tasks',
      iconName: 'notifications_active',
    ),
    HomeCard(
      id: 'work-orders',
      title: 'Work Orders',
      subtitle: 'All jobs',
      route: '/work-orders',
      iconName: 'build',
    ),
    HomeCard(
      id: 'more',
      title: 'Administration',
      subtitle: 'Modules and settings',
      route: '/more',
      iconName: 'admin_panel_settings',
    ),
  ];

  static const _defaultCards = [
    HomeCard(
      id: 'home',
      title: 'Workspace',
      subtitle: 'Your daily shortcuts',
      route: '/home',
      iconName: 'home',
    ),
    HomeCard(
      id: 'tasks',
      title: 'Tasks',
      subtitle: 'Action center',
      route: '/tasks',
      iconName: 'task_alt',
    ),
    HomeCard(
      id: 'more',
      title: 'Modules',
      subtitle: 'Browse available modules',
      route: '/more',
      iconName: 'apps',
    ),
  ];

  static List<HomeCard> cardsForRole(String role) {
    switch (role.toUpperCase()) {
      case 'TECHNICIAN':
      case 'MECHANIC':
        return _technicianCards;
      case 'SUPERVISOR':
      case 'MAINTENANCE_SUPERVISOR':
        return _supervisorCards;
      case 'MANAGER':
      case 'OPERATIONS_MANAGER':
      case 'FACILITY_MANAGER':
        return _managerCards;
      case 'SECURITY_OFFICER':
        return _securityCards;
      case 'DRIVER':
        return _driverCards;
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return _adminCards;
      default:
        return _defaultCards;
    }
  }
}
