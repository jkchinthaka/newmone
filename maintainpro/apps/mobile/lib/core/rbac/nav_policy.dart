/// Mobile module hub visibility — mirrors web `navigation.ts` role patterns.
/// UI hide is not security; API enforces access.
library;

class ModuleNavItem {
  const ModuleNavItem({
    required this.id,
    required this.label,
    required this.route,
    required this.allowedRoles,
    this.requiredPermissions = const [],
    this.description,
  });

  final String id;
  final String label;
  final String route;
  final List<String> allowedRoles;
  final List<String> requiredPermissions;
  final String? description;
}

class ModuleNavGroup {
  const ModuleNavGroup({
    required this.id,
    required this.label,
    required this.items,
  });

  final String id;
  final String label;
  final List<ModuleNavItem> items;
}

abstract final class NavRoles {
  static const admin = ['SUPER_ADMIN', 'ADMIN'];
  static const management = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'OPERATIONS_MANAGER',
  ];
  static const supervisor = ['MAINTENANCE_SUPERVISOR', 'SUPERVISOR'];
  static const technician = ['TECHNICIAN', 'MECHANIC'];
  static const security = ['SECURITY_OFFICER'];
  static const driver = ['DRIVER'];
  static const inventory = ['INVENTORY_KEEPER', 'STOREKEEPER'];
  static const procurement = ['PROCUREMENT_OFFICER'];
  static const finance = ['FINANCE', 'FINANCE_APPROVER'];
  static const readOnly = ['VIEWER', 'AUDITOR'];
  static const facility = ['FACILITY_MANAGER', 'BUILDING_SUPERVISOR'];
  static const fleet = ['FLEET_MANAGER'];
  static const compliance = ['COMPLIANCE_MANAGER'];
  static const asset = ['ASSET_MANAGER'];
  static const farm = [
    'FARM_OWNER',
    'FARM_MANAGER',
    'FIELD_SUPERVISOR',
    'AGRONOMIST',
    'VETERINARIAN',
    'FARM_WORKER',
    'IRRIGATION_OPERATOR',
    'HARVEST_CREW',
  ];
  static const cleaning = ['CLEANER'];

  static List<String> merge(List<List<String>> groups) {
    final set = <String>{};
    for (final g in groups) {
      set.addAll(g);
    }
    return set.toList()..sort();
  }
}

abstract final class NavPolicy {
  static final List<ModuleNavGroup> moduleGroups = [
    ModuleNavGroup(
      id: 'maintenance',
      label: 'Maintenance',
      items: [
        ModuleNavItem(
          id: 'work-orders',
          label: 'Work Orders',
          route: '/work-orders',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.supervisor,
            NavRoles.technician,
            NavRoles.asset,
          ]),
        ),
        ModuleNavItem(
          id: 'assets',
          label: 'Assets',
          route: '/assets',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.supervisor,
            NavRoles.asset,
            NavRoles.readOnly,
            const ['MECHANIC'],
          ]),
          description: 'Tags, locations, service dates',
        ),
        ModuleNavItem(
          id: 'job-codes',
          label: 'Job Codes',
          route: '/assets/job-codes',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.supervisor,
            NavRoles.admin,
            NavRoles.technician,
            NavRoles.readOnly,
          ]),
          description: 'Field job code catalog',
        ),
        ModuleNavItem(
          id: 'pm-schedules',
          label: 'Preventive Maintenance',
          route: '/assets/pm',
          allowedRoles: NavRoles.merge([
            NavRoles.admin,
            NavRoles.asset,
            const ['MECHANIC'],
          ]),
          description: 'Nest PM schedules',
        ),
      ],
    ),
    ModuleNavGroup(
      id: 'fleet',
      label: 'Fleet',
      items: [
        ModuleNavItem(
          id: 'fleet',
          label: 'Fleet',
          route: '/fleet',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.security,
            NavRoles.driver,
            NavRoles.fleet,
            NavRoles.technician,
          ]),
          requiredPermissions: const ['vehicles.view'],
        ),
        ModuleNavItem(
          id: 'fleet-gate',
          label: 'Gate',
          route: '/gate',
          allowedRoles: NavRoles.merge([
            NavRoles.security,
            NavRoles.admin,
            NavRoles.management,
            NavRoles.fleet,
          ]),
          requiredPermissions: const [
            'gate.in.create',
            'gate.out.create',
            'vehicles.view',
          ],
        ),
        ModuleNavItem(
          id: 'vehicles',
          label: 'Vehicles',
          route: '/fleet/vehicles',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.driver,
            NavRoles.asset,
            NavRoles.fleet,
            NavRoles.technician,
          ]),
          requiredPermissions: const ['vehicles.view'],
        ),
      ],
    ),
    ModuleNavGroup(
      id: 'inventory',
      label: 'Inventory',
      items: [
        ModuleNavItem(
          id: 'inventory',
          label: 'Inventory',
          route: '/inventory',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.inventory,
            NavRoles.procurement,
            NavRoles.technician,
          ]),
          requiredPermissions: const ['inventory.manage'],
        ),
        ModuleNavItem(
          id: 'procurement',
          label: 'Procurement',
          route: '/inventory/purchase-orders',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.inventory,
            NavRoles.procurement,
            NavRoles.finance,
          ]),
          requiredPermissions: const ['purchase_orders.view'],
        ),
      ],
    ),
    ModuleNavGroup(
      id: 'fg',
      label: 'FG Digital Records',
      items: [
        ModuleNavItem(
          id: 'fg-digital-recording',
          label: 'FG Digital Recording',
          route: '/fg',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.supervisor,
            NavRoles.technician,
            NavRoles.admin,
          ]),
          requiredPermissions: const ['fg.access'],
        ),
      ],
    ),
    ModuleNavGroup(
      id: 'facilities',
      label: 'Facilities',
      items: [
        ModuleNavItem(
          id: 'facilities',
          label: 'Facilities',
          route: '/facilities',
          allowedRoles: NavRoles.merge([
            NavRoles.admin,
            NavRoles.management,
            NavRoles.facility,
            NavRoles.supervisor,
            NavRoles.readOnly,
          ]),
          requiredPermissions: const ['facilities.view'],
        ),
        ModuleNavItem(
          id: 'cleaning',
          label: 'Cleaning',
          route: '/facilities/cleaning',
          allowedRoles: NavRoles.merge([
            NavRoles.admin,
            NavRoles.management,
            NavRoles.facility,
            NavRoles.cleaning,
            NavRoles.supervisor,
          ]),
        ),
        ModuleNavItem(
          id: 'utilities',
          label: 'Utilities',
          route: '/facilities/utilities',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.admin,
            NavRoles.facility,
          ]),
          requiredPermissions: const ['utilities.manage'],
        ),
      ],
    ),
    ModuleNavGroup(
      id: 'farm',
      label: 'Farm',
      items: [
        ModuleNavItem(
          id: 'farm',
          label: 'Farm Operations',
          route: '/more',
          allowedRoles: NavRoles.merge([
            NavRoles.farm,
            NavRoles.admin,
            NavRoles.management,
          ]),
        ),
      ],
    ),
    ModuleNavGroup(
      id: 'compliance',
      label: 'Compliance & Safety',
      items: [
        ModuleNavItem(
          id: 'compliance',
          label: 'Compliance',
          route: '/more',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.compliance,
            NavRoles.admin,
          ]),
        ),
        ModuleNavItem(
          id: 'accidents',
          label: 'Accidents',
          route: '/more',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.compliance,
            NavRoles.admin,
          ]),
        ),
        ModuleNavItem(
          id: 'insurance-claims',
          label: 'Insurance Claims',
          route: '/more',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.compliance,
            NavRoles.admin,
          ]),
        ),
        ModuleNavItem(
          id: 'traffic-fines',
          label: 'Traffic Fines',
          route: '/more',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.compliance,
            NavRoles.admin,
            NavRoles.fleet,
          ]),
        ),
      ],
    ),
    ModuleNavGroup(
      id: 'reports',
      label: 'Reports & Intelligence',
      items: [
        ModuleNavItem(
          id: 'reports',
          label: 'Reports',
          route: '/more',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.supervisor,
            NavRoles.readOnly,
            NavRoles.compliance,
            NavRoles.admin,
            NavRoles.finance,
          ]),
        ),
        ModuleNavItem(
          id: 'management-intelligence',
          label: 'Management Intelligence',
          route: '/more',
          allowedRoles: NavRoles.merge([
            NavRoles.management,
            NavRoles.admin,
            NavRoles.finance,
          ]),
        ),
      ],
    ),
    ModuleNavGroup(
      id: 'administration',
      label: 'Administration',
      items: [
        const ModuleNavItem(
          id: 'admin-console',
          label: 'Admin Console',
          route: '/more',
          allowedRoles: NavRoles.admin,
        ),
        const ModuleNavItem(
          id: 'system-health',
          label: 'System Health',
          route: '/diagnostics',
          allowedRoles: NavRoles.admin,
        ),
        ModuleNavItem(
          id: 'settings',
          label: 'Settings',
          route: '/settings',
          allowedRoles: NavRoles.merge([
            NavRoles.admin,
            NavRoles.management,
          ]),
        ),
        ModuleNavItem(
          id: 'master-data',
          label: 'Master Data',
          route: '/more',
          allowedRoles: NavRoles.merge([
            NavRoles.admin,
            ['MANAGER'],
          ]),
        ),
      ],
    ),
    const ModuleNavGroup(
      id: 'archive',
      label: 'Archive',
      items: [
        ModuleNavItem(
          id: 'legacy-fms',
          label: 'Legacy FMS',
          route: '/more',
          allowedRoles: NavRoles.admin,
          description: 'Archived FMS surfaces',
        ),
      ],
    ),
  ];

  static bool roleAllowed(String role, List<String> allowedRoles) {
    final normalized = role.toUpperCase();
    if (NavRoles.admin.contains(normalized)) return true;
    return allowedRoles.map((e) => e.toUpperCase()).contains(normalized);
  }

  static bool canSeeItem({
    required String role,
    required List<String> permissions,
    required ModuleNavItem item,
  }) {
    if (!roleAllowed(role, item.allowedRoles)) return false;
    if (item.requiredPermissions.isEmpty) return true;
    // Permission check is soft UX filter; empty permissions list from JWT
    // should not hide items when role already allows.
    if (permissions.isEmpty) return true;
    for (final required in item.requiredPermissions) {
      if (permissions.contains(required) ||
          permissions.contains('*') ||
          permissions.contains('admin.*')) {
        return true;
      }
      final prefix = required.split('.').first;
      if (permissions.contains('$prefix.*')) return true;
    }
    return false;
  }

  static List<ModuleNavGroup> visibleGroups({
    required String role,
    List<String> permissions = const [],
  }) {
    final groups = <ModuleNavGroup>[];
    for (final group in moduleGroups) {
      final items = group.items
          .where(
            (item) => canSeeItem(
              role: role,
              permissions: permissions,
              item: item,
            ),
          )
          .toList();
      if (items.isNotEmpty) {
        groups.add(ModuleNavGroup(
          id: group.id,
          label: group.label,
          items: items,
        ));
      }
    }
    return groups;
  }
}
