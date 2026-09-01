/// Tolerant parsers for Nest admin / reports envelopes.

Map<String, dynamic>? asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

List<Map<String, dynamic>> asMapList(dynamic value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();
}

dynamic unwrapData(dynamic body) {
  final map = asMap(body);
  if (map == null) return body;
  if (map.containsKey('data')) return map['data'];
  return body;
}

Map<String, dynamic> unwrapDataMap(dynamic body) {
  final data = unwrapData(body);
  return asMap(data) ?? {};
}

List<Map<String, dynamic>> unwrapDataList(dynamic body) {
  final data = unwrapData(body);
  if (data is List) return asMapList(data);
  final map = asMap(data);
  if (map == null) return const [];
  for (final key in ['items', 'results', 'users', 'people', 'roles', 'tenants', 'invitations', 'logs']) {
    if (map[key] is List) return asMapList(map[key]);
  }
  return const [];
}

class AdminUserRow {
  const AdminUserRow({
    required this.id,
    required this.displayName,
    required this.email,
    this.roleName,
    this.tenantId,
    this.tenantName,
    this.isActive = true,
    this.lastLogin,
  });

  final String id;
  final String displayName;
  final String email;
  final String? roleName;
  final String? tenantId;
  final String? tenantName;
  final bool isActive;
  final String? lastLogin;

  factory AdminUserRow.fromJson(Map<String, dynamic> json) {
    final role = asMap(json['role']);
    return AdminUserRow(
      id: (json['id'] ?? '').toString(),
      displayName: (json['displayName'] ??
              '${json['firstName'] ?? ''} ${json['lastName'] ?? ''}'.trim())
          .toString()
          .trim()
          .isEmpty
          ? (json['email'] ?? 'User').toString()
          : (json['displayName'] ??
                  '${json['firstName'] ?? ''} ${json['lastName'] ?? ''}'.trim())
              .toString(),
      email: (json['email'] ?? '').toString(),
      roleName: (json['roleName'] ?? role?['name'])?.toString(),
      tenantId: json['tenantId']?.toString(),
      tenantName: json['tenantName']?.toString(),
      isActive: json['isActive'] != false,
      lastLogin: json['lastLogin']?.toString(),
    );
  }
}

class PersonRow {
  const PersonRow({
    required this.id,
    required this.fullName,
    this.email,
    this.phone,
    this.designation,
    this.departmentName,
    this.active = true,
    this.canLogin = false,
    this.linkedUserId,
    this.roleName,
    this.inviteStatus,
  });

  final String id;
  final String fullName;
  final String? email;
  final String? phone;
  final String? designation;
  final String? departmentName;
  final bool active;
  final bool canLogin;
  final String? linkedUserId;
  final String? roleName;
  final String? inviteStatus;

  factory PersonRow.fromJson(Map<String, dynamic> json) {
    final dept = asMap(json['department']);
    final role = asMap(json['role']);
    return PersonRow(
      id: (json['id'] ?? '').toString(),
      fullName: (json['fullName'] ?? json['name'] ?? 'Person').toString(),
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      designation: json['designation']?.toString(),
      departmentName: (json['departmentName'] ?? dept?['name'])?.toString(),
      active: json['active'] != false && json['isActive'] != false,
      canLogin: json['canLogin'] == true,
      linkedUserId: json['linkedUserId']?.toString(),
      roleName: (json['roleName'] ?? role?['name'])?.toString(),
      inviteStatus: json['inviteStatus']?.toString(),
    );
  }
}

class RoleRow {
  const RoleRow({
    required this.id,
    required this.name,
    this.permissionCount = 0,
    this.tenantId,
    this.tenantName,
    this.permissionKeys = const [],
    this.isBuiltIn = false,
  });

  final String id;
  final String name;
  final int permissionCount;
  final String? tenantId;
  final String? tenantName;
  final List<String> permissionKeys;
  final bool isBuiltIn;

  factory RoleRow.fromJson(Map<String, dynamic> json) {
    final keys = json['permissionKeys'];
    return RoleRow(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      permissionCount: (json['permissionCount'] as num?)?.toInt() ??
          (keys is List ? keys.length : 0),
      tenantId: json['tenantId']?.toString(),
      tenantName: json['tenantName']?.toString(),
      permissionKeys: keys is List
          ? keys.map((e) => e.toString()).toList()
          : const [],
      isBuiltIn: json['isBuiltIn'] == true,
    );
  }
}

class PermissionRow {
  const PermissionRow({
    required this.id,
    required this.key,
    this.module,
    this.description,
  });

  final String id;
  final String key;
  final String? module;
  final String? description;

  factory PermissionRow.fromJson(Map<String, dynamic> json) {
    return PermissionRow(
      id: (json['id'] ?? '').toString(),
      key: (json['key'] ?? '').toString(),
      module: json['module']?.toString(),
      description: json['description']?.toString(),
    );
  }
}

class TenantRow {
  const TenantRow({
    required this.id,
    required this.name,
    this.slug,
    this.isActive = true,
    this.memberCount = 0,
  });

  final String id;
  final String name;
  final String? slug;
  final bool isActive;
  final int memberCount;

  factory TenantRow.fromJson(Map<String, dynamic> json) {
    return TenantRow(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      slug: json['slug']?.toString(),
      isActive: json['isActive'] != false,
      memberCount: (json['memberCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class InvitationRow {
  const InvitationRow({
    required this.id,
    required this.email,
    this.inviteeDisplayName,
    this.membershipRole,
    this.status,
    this.tenantName,
    this.expiresAt,
    this.createdAt,
  });

  final String id;
  final String email;
  final String? inviteeDisplayName;
  final String? membershipRole;
  final String? status;
  final String? tenantName;
  final String? expiresAt;
  final String? createdAt;

  factory InvitationRow.fromJson(Map<String, dynamic> json) {
    return InvitationRow(
      id: (json['id'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      inviteeDisplayName: json['inviteeDisplayName']?.toString(),
      membershipRole: json['membershipRole']?.toString(),
      status: json['status']?.toString(),
      tenantName: json['tenantName']?.toString(),
      expiresAt: json['expiresAt']?.toString(),
      createdAt: json['createdAt']?.toString(),
    );
  }
}

class DepartmentRow {
  const DepartmentRow({
    required this.id,
    required this.name,
    this.code,
    this.parentName,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String? code;
  final String? parentName;
  final bool isActive;

  factory DepartmentRow.fromJson(Map<String, dynamic> json) {
    final parent = asMap(json['parent']);
    return DepartmentRow(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      code: json['code']?.toString(),
      parentName: parent?['name']?.toString(),
      isActive: json['isActive'] != false,
    );
  }
}

class AuditLogRow {
  const AuditLogRow({
    required this.id,
    required this.createdAt,
    this.actorName,
    this.actorId,
    this.module,
    this.entity,
    this.entityId,
    this.action,
    this.reason,
  });

  final String id;
  final String createdAt;
  final String? actorName;
  final String? actorId;
  final String? module;
  final String? entity;
  final String? entityId;
  final String? action;
  final String? reason;

  factory AuditLogRow.fromJson(Map<String, dynamic> json) {
    final actor = asMap(json['actor']);
    final actorName = [
      actor?['firstName'],
      actor?['lastName'],
      actor?['email'],
      json['actorName'],
    ].where((e) => e != null && e.toString().trim().isNotEmpty).map((e) => e.toString()).join(' ');
    return AuditLogRow(
      id: (json['id'] ?? '').toString(),
      createdAt: (json['createdAt'] ?? '').toString(),
      actorName: actorName.isEmpty ? null : actorName,
      actorId: (json['actorId'] ?? actor?['id'])?.toString(),
      module: json['module']?.toString(),
      entity: json['entity']?.toString(),
      entityId: json['entityId']?.toString(),
      action: json['action']?.toString(),
      reason: json['reason']?.toString(),
    );
  }
}

class SystemHealthSnapshot {
  const SystemHealthSnapshot({
    required this.raw,
    this.status,
    this.checks = const {},
  });

  final Map<String, dynamic> raw;
  final String? status;
  final Map<String, dynamic> checks;

  factory SystemHealthSnapshot.fromJson(Map<String, dynamic> json) {
    return SystemHealthSnapshot(
      raw: json,
      status: (json['status'] ?? json['overall'] ?? json['state'])?.toString(),
      checks: asMap(json['checks']) ??
          asMap(json['dependencies']) ??
          asMap(json['components']) ??
          {},
    );
  }

  /// Safe summary keys only — never expose connection strings.
  List<MapEntry<String, String>> get summaryRows {
    final rows = <MapEntry<String, String>>[];
    if (status != null) rows.add(MapEntry('Overall', status!));
    void addIfPresent(String label, dynamic value) {
      if (value == null) return;
      if (value is Map) {
        final st = value['status'] ?? value['state'] ?? value['ok'];
        if (st != null) rows.add(MapEntry(label, st.toString()));
      } else {
        rows.add(MapEntry(label, value.toString()));
      }
    }

    addIfPresent('Database', checks['database'] ?? raw['database'] ?? raw['db']);
    addIfPresent('Redis', checks['redis'] ?? raw['redis']);
    addIfPresent('Queues', checks['queues'] ?? raw['queues']);
    addIfPresent('Object storage', checks['objectStorage'] ?? raw['objectStorage']);
    addIfPresent('Notifications', checks['notifications'] ?? raw['notification']);
    addIfPresent('ERP', checks['erp'] ?? raw['erp']);
    addIfPresent('FG', checks['fg'] ?? raw['fg'] ?? raw['fgDigitalRecording']);
    addIfPresent('Replication', checks['replication'] ?? raw['backupReplication']);
    return rows;
  }
}
