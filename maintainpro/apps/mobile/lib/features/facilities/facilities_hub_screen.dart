import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/rbac/permissions.dart';
import 'facilities_permissions.dart';
import '../../design_system/design_system.dart';

class FacilitiesHubScreen extends ConsumerWidget {
  const FacilitiesHubScreen({super.key});

  bool _canFacilities(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.has(perms, MpPermissions.facilitiesView);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final role = user?.role ?? '';
    final perms = user?.permissions ?? const [];
    final canFacilities = _canFacilities(perms, role);

    return Scaffold(
      appBar: AppBar(title: const Text('Facilities')),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          Text(
            'Facilities & utilities',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: MpSpacing.xs),
          Text(
            'Hierarchy, issues, cleaning, and meters from Nest — read-first on mobile.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: MpSpacing.lg),
          if (!canFacilities)
            const MpErrorState(
              title: 'Facilities access required',
              message: 'Your role needs facilities.view to browse sites.',
            )
          else ...[
            _link(context, 'Rooms & sites', 'Search facility rooms', '/facilities/rooms', Icons.apartment_outlined),
            _link(context, 'Facility issues', 'Open defects and requests', '/facilities/issues', Icons.report_problem_outlined),
            _link(context, 'Cleaning locations', 'Scheduled cleaning sites', '/facilities/cleaning', Icons.cleaning_services_outlined),
            if (FacilitiesPermissions.canViewCleaningVisits(role))
              _link(context, 'Cleaning visits', 'Visit history and status', '/facilities/cleaning/visits', Icons.history),
            _link(context, 'Utility meters', 'Electricity, water, gas', '/facilities/utilities', Icons.speed_outlined),
            const SizedBox(height: MpSpacing.lg),
            const MpCard(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.block),
                title: Text('Mutations blocked on mobile'),
                subtitle: Text(
                  'Cleaning completion, meter entry, issue status changes, and hierarchy edits require proven server idempotency — use web for now.',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _link(BuildContext context, String title, String subtitle, String route, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: MpSpacing.sm),
      child: MpCard(
        onTap: () => context.push(route),
        child: ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon),
          title: Text(title),
          subtitle: Text(subtitle),
          trailing: const Icon(Icons.chevron_right),
        ),
      ),
    );
  }
}
