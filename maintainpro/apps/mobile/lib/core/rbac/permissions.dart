/// Permission helpers. UI hiding is UX only — backend RBAC is authoritative.
library;

abstract final class MpPermissions {
  static const workOrdersView = 'work_orders.view';
  static const workOrdersUpdate = 'work_orders.update';
  static const inventoryView = 'inventory.view';
  static const inventoryAdjust = 'inventory.adjust';
  static const fleetView = 'fleet.view';
  static const fleetGate = 'fleet.gate';
  static const gateInCreate = 'gate.in.create';
  static const gateOutCreate = 'gate.out.create';
  static const gateOverrideApprove = 'gate.override.approve';
  static const vehiclesView = 'vehicles.view';
  static const assetsView = 'assets.view';
  static const reportsView = 'reports.view';
  static const complianceView = 'compliance.view';
  static const farmView = 'farm.view';
  static const cleaningView = 'cleaning.view';
  static const fgAccess = 'fg.access';
  static const fgRecordingView = 'fg.recording.view';
  static const fgRecordingCreate = 'fg.recording.create';
  static const fgRecordingEdit = 'fg.recording.edit';
  static const fgRecordingSubmit = 'fg.recording.submit';
  static const fgReviewView = 'fg.review.view';
  static const fgReviewPerform = 'fg.review.perform';
  static const fgQaView = 'fg.qa.view';
  static const fgQaDisposition = 'fg.qa.disposition';
  static const adminAccess = 'admin.access';
  static const settingsManage = 'settings.manage';

  static bool has(List<String> granted, String permission) {
    if (granted.contains('*') || granted.contains('admin.*')) return true;
    if (granted.contains(permission)) return true;
    final prefix = permission.split('.').first;
    return granted.contains('$prefix.*');
  }

  static bool hasAny(List<String> granted, Iterable<String> required) {
    for (final p in required) {
      if (has(granted, p)) return true;
    }
    return false;
  }
}
