import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../core/rbac/permissions.dart';
import '../../design_system/design_system.dart';
import 'data/inventory_api_client.dart';
import 'data/inventory_models.dart';

/// Inventory / procurement hub — read-first surfaces backed by Nest.
class InventoryHubScreen extends ConsumerStatefulWidget {
  const InventoryHubScreen({super.key});

  @override
  ConsumerState<InventoryHubScreen> createState() => _InventoryHubScreenState();
}

class _InventoryHubScreenState extends ConsumerState<InventoryHubScreen> {
  bool _loading = true;
  String? _error;
  InventoryDashboardSummary? _dashboard;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  bool get _offline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  bool _canInventory(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.has(perms, MpPermissions.inventoryManage);
  }

  bool _canPurchaseOrders(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.has(perms, MpPermissions.purchaseOrdersView);
  }

  bool _canErp(List<String> perms, String role) {
    if (role == 'SUPER_ADMIN' || role == 'ADMIN') return true;
    return MpPermissions.has(perms, MpPermissions.erpView);
  }

  Future<void> _load() async {
    final user = ref.read(authControllerProvider).user;
    final role = user?.role ?? '';
    final perms = user?.permissions ?? const [];
    if (!_canInventory(perms, role)) {
      setState(() {
        _loading = false;
        _error = 'inventory.manage permission required for stock surfaces';
      });
      return;
    }
    if (_offline && _dashboard == null) {
      setState(() {
        _loading = false;
        _error = 'Inventory dashboard requires connection';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dash = await ref.read(inventoryApiClientProvider).dashboard();
      if (!mounted) return;
      setState(() {
        _dashboard = dash;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final role = user?.role ?? '';
    final perms = user?.permissions ?? const [];
    final canInventory = _canInventory(perms, role);
    final canPo = _canPurchaseOrders(perms, role);
    final canErp = _canErp(perms, role);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Inventory')),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          Text(
            'Parts & procurement',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: MpSpacing.xs),
          Text(
            'Stock quantities and PO totals come from Nest — mobile never adjusts authoritative balances.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: MpSpacing.lg),
          if (_offline)
            MpCard(
              color: scheme.errorContainer,
              child: Row(
                children: [
                  Icon(Icons.cloud_off, color: scheme.onErrorContainer),
                  const SizedBox(width: MpSpacing.sm),
                  Expanded(
                    child: Text(
                      'Stock issue, receiving, and approvals require connection.',
                      style: TextStyle(color: scheme.onErrorContainer),
                    ),
                  ),
                ],
              ),
            ),
          if (_offline) const SizedBox(height: MpSpacing.lg),
          if (!canInventory && !canPo)
            const MpErrorState(
              title: 'Inventory access required',
              message:
                  'Your role needs inventory.manage or purchase_orders.view.',
            )
          else ...[
            if (canInventory) ...[
              if (_loading)
                const MpLoading(message: 'Loading inventory…')
              else if (_error != null && _dashboard == null)
                MpErrorState(
                  title: 'Inventory unavailable',
                  message: _error,
                  onRetry: _load,
                )
              else if (_dashboard != null) ...[
                Wrap(
                  spacing: MpSpacing.sm,
                  runSpacing: MpSpacing.sm,
                  children: [
                    MpStatusChip(label: 'On hand ${_dashboard!.onHand}'),
                    MpStatusChip(label: 'Available ${_dashboard!.available}'),
                    if (_dashboard!.lowStock > 0)
                      MpStatusChip(
                        label: 'Low ${_dashboard!.lowStock}',
                        tone: MpStatusTone.warning,
                      ),
                    if (_dashboard!.outOfStock > 0)
                      MpStatusChip(
                        label: 'Out ${_dashboard!.outOfStock}',
                        tone: MpStatusTone.error,
                      ),
                  ],
                ),
                const SizedBox(height: MpSpacing.lg),
              ],
              _link(
                context,
                icon: Icons.inventory_2_outlined,
                title: 'Parts',
                subtitle: 'Search catalog and balances',
                route: '/inventory/parts',
              ),
              _link(
                context,
                icon: Icons.warning_amber_outlined,
                title: 'Low stock',
                subtitle: 'Server low-stock list',
                route: '/inventory/low-stock',
              ),
              _link(
                context,
                icon: Icons.warehouse_outlined,
                title: 'Warehouses',
                subtitle: 'Active warehouse sites',
                route: '/inventory/warehouses',
              ),
              _link(
                context,
                icon: Icons.inventory_outlined,
                title: 'Warehouse balances',
                subtitle: 'Per-warehouse stock rows (server)',
                route: '/inventory/warehouse-balances',
              ),
              _link(
                context,
                icon: Icons.request_page_outlined,
                title: 'Part requests',
                subtitle: 'Global request inbox (read-only)',
                route: '/inventory/part-requests',
              ),
              _link(
                context,
                icon: Icons.local_shipping_outlined,
                title: 'Suppliers',
                subtitle: 'Vendor directory',
                route: '/inventory/suppliers',
              ),
            ],
            if (canPo) ...[
              const SizedBox(height: MpSpacing.md),
              _link(
                context,
                icon: Icons.receipt_long_outlined,
                title: 'Purchase orders',
                subtitle: 'Status, lines, approvals (read-only)',
                route: '/inventory/purchase-orders',
              ),
            ],
            if (canErp) ...[
              const SizedBox(height: MpSpacing.md),
              _link(
                context,
                icon: Icons.sync_outlined,
                title: 'ERP status',
                subtitle: 'Sync readiness (read-only)',
                route: '/inventory/erp',
              ),
            ],
            const SizedBox(height: MpSpacing.lg),
            const MpSectionHeader(title: 'Online-only (not on mobile)'),
            const MpCard(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.block),
                title: Text('Stock mutations blocked'),
                subtitle: Text(
                  'Issue, return, adjustment, transfer, receiving, and PO approval require desktop workflows with server idempotency.',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _link(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required String route,
  }) {
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
