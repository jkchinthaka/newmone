import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'admin_models.dart';

/// Nest admin / people / roles / audit / health client.
/// Critical mutations are online-only; never queue offline.
class AdminApiClient {
  AdminApiClient(this._dio);

  final Dio _dio;

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<List<AdminUserRow>> listAdminUsers() => _guarded(() async {
        final res = await _dio.get<dynamic>('/admin/users');
        return unwrapDataList(res.data).map(AdminUserRow.fromJson).toList();
      });

  Future<AdminUserRow> updateAdminUserStatus(String id, {required bool isActive}) =>
      _guarded(() async {
        final res = await _dio.patch<dynamic>(
          '/admin/users/$id/status',
          data: {'isActive': isActive},
        );
        return AdminUserRow.fromJson(unwrapDataMap(res.data));
      });

  Future<void> setAdminUserPassword(
    String id, {
    required String newPassword,
    bool mustChangePassword = true,
  }) =>
      _guarded(() async {
        await _dio.patch<dynamic>(
          '/admin/users/$id/password',
          data: {
            'newPassword': newPassword,
            'mustChangePassword': mustChangePassword,
          },
        );
      });

  Future<List<PersonRow>> listPeople({String? search, int page = 1, int pageSize = 30}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/people',
          queryParameters: {
            if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
            'page': page,
            'pageSize': pageSize,
          },
        );
        return unwrapDataList(res.data).map(PersonRow.fromJson).toList();
      });

  Future<PersonRow> getPerson(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/people/$id');
        return PersonRow.fromJson(unwrapDataMap(res.data));
      });

  Future<List<RoleRow>> listRoles() => _guarded(() async {
        final res = await _dio.get<dynamic>('/roles');
        return unwrapDataList(res.data).map(RoleRow.fromJson).toList();
      });

  Future<List<PermissionRow>> listPermissions() => _guarded(() async {
        final res = await _dio.get<dynamic>('/roles/permissions');
        return unwrapDataList(res.data).map(PermissionRow.fromJson).toList();
      });

  Future<Map<String, dynamic>> rolesPermissionsMatrix() => _guarded(() async {
        final res = await _dio.get<dynamic>('/admin/roles-permissions');
        return unwrapDataMap(res.data);
      });

  Future<List<TenantRow>> listTenants() => _guarded(() async {
        final res = await _dio.get<dynamic>('/admin/tenants');
        return unwrapDataList(res.data).map(TenantRow.fromJson).toList();
      });

  Future<List<InvitationRow>> listInvitations() => _guarded(() async {
        final res = await _dio.get<dynamic>('/admin/invitations');
        return unwrapDataList(res.data).map(InvitationRow.fromJson).toList();
      });

  Future<InvitationRow> createInvitation({
    required String email,
    String? firstName,
    String? lastName,
    String? membershipRole,
    String? tenantId,
  }) =>
      _guarded(() async {
        final res = await _dio.post<dynamic>(
          '/admin/invitations',
          data: {
            'email': email.trim(),
            if (firstName != null && firstName.isNotEmpty) 'firstName': firstName,
            if (lastName != null && lastName.isNotEmpty) 'lastName': lastName,
            if (membershipRole != null && membershipRole.isNotEmpty)
              'membershipRole': membershipRole,
            if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
          },
        );
        return InvitationRow.fromJson(unwrapDataMap(res.data));
      });

  Future<List<DepartmentRow>> listDepartments({String? q}) => _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/departments',
          queryParameters: {
            if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
            'pageSize': 100,
          },
        );
        return unwrapDataList(res.data).map(DepartmentRow.fromJson).toList();
      });

  Future<List<AuditLogRow>> listAuditLogs({
    String? module,
    String? entity,
    String? from,
    String? to,
    int page = 1,
    int pageSize = 30,
  }) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/audit-logs',
          queryParameters: {
            if (module != null && module.isNotEmpty) 'module': module,
            if (entity != null && entity.isNotEmpty) 'entity': entity,
            if (from != null && from.isNotEmpty) 'from': from,
            if (to != null && to.isNotEmpty) 'to': to,
            'page': page,
            'pageSize': pageSize,
          },
        );
        return unwrapDataList(res.data).map(AuditLogRow.fromJson).toList();
      });

  Future<SystemHealthSnapshot> systemHealthReadiness() => _guarded(() async {
        final res = await _dio.get<dynamic>('/health/readiness');
        return SystemHealthSnapshot.fromJson(unwrapDataMap(res.data).isEmpty
            ? asMap(res.data) ?? {}
            : unwrapDataMap(res.data));
      });

  Future<Map<String, dynamic>> publicHealth() => _guarded(() async {
        final res = await _dio.get<dynamic>('/health');
        return asMap(res.data) ?? unwrapDataMap(res.data);
      });

  Future<AdminUserRow> getUser(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/users/$id');
        return AdminUserRow.fromJson(unwrapDataMap(res.data));
      });

  Future<AdminUserRow> createUser({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String roleId,
    String? phone,
  }) =>
      _guarded(() async {
        final res = await _dio.post<dynamic>(
          '/users',
          data: {
            'email': email.trim(),
            'password': password,
            'firstName': firstName.trim(),
            'lastName': lastName.trim(),
            'roleId': roleId,
            if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
          },
        );
        return AdminUserRow.fromJson(unwrapDataMap(res.data));
      });

  Future<AdminUserRow> updateUser(
    String id, {
    String? firstName,
    String? lastName,
    String? phone,
    String? roleId,
  }) =>
      _guarded(() async {
        final res = await _dio.patch<dynamic>(
          '/users/$id',
          data: {
            if (firstName != null) 'firstName': firstName.trim(),
            if (lastName != null) 'lastName': lastName.trim(),
            if (phone != null) 'phone': phone.trim(),
            if (roleId != null) 'roleId': roleId,
          },
        );
        return AdminUserRow.fromJson(unwrapDataMap(res.data));
      });

  Future<PersonRow> deactivatePerson(String id) => _guarded(() async {
        final res = await _dio.post<dynamic>('/people/$id/deactivate');
        return PersonRow.fromJson(unwrapDataMap(res.data));
      });

  Future<PersonRow> reactivatePerson(String id) => _guarded(() async {
        final res = await _dio.post<dynamic>('/people/$id/reactivate');
        return PersonRow.fromJson(unwrapDataMap(res.data));
      });

  Future<Map<String, dynamic>> getOrganizationSettings() => _guarded(() async {
        final res = await _dio.get<dynamic>('/settings/organization');
        return unwrapDataMap(res.data);
      });

  Future<Map<String, dynamic>> getSystemSettings() => _guarded(() async {
        final res = await _dio.get<dynamic>('/settings/system');
        return unwrapDataMap(res.data);
      });

  Future<Map<String, dynamic>> getFeatureToggles() => _guarded(() async {
        final res = await _dio.get<dynamic>('/settings/feature-toggles');
        return unwrapDataMap(res.data);
      });
}

final adminApiClientProvider = Provider<AdminApiClient>((ref) {
  return AdminApiClient(ref.watch(dioProvider));
});
