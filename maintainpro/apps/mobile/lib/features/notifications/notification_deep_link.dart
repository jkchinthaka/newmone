/// Maps Nest/web deep links to mobile go_router paths.
/// Push payloads must use opaque IDs — never JWT or secrets.
String? resolveNotificationDeepLink({
  String? deepLink,
  String? referenceType,
  String? referenceId,
}) {
  final link = (deepLink ?? '').trim();
  if (link.isNotEmpty) {
    final mobile = _fromWebPath(link);
    if (mobile != null) return mobile;
  }

  final type = (referenceType ?? '').trim();
  final id = (referenceId ?? '').trim();
  if (type.isEmpty || id.isEmpty) return null;

  switch (type) {
    case 'WorkOrder':
      return '/work-orders/$id';
    case 'Vehicle':
      return '/fleet/vehicles/$id';
    case 'Asset':
      return '/assets/$id';
    case 'FacilityIssue':
      return '/facilities/issues/$id';
    case 'CleaningVisit':
      return '/facilities/cleaning/visits';
    case 'UtilityMeter':
      return '/facilities/utilities/$id';
    case 'PurchaseOrder':
      return '/inventory/purchase-orders/$id';
    case 'Accident':
      return '/compliance/accidents/$id';
    case 'InsuranceClaim':
      return '/compliance/insurance-claims/$id';
    case 'TrafficFine':
      return '/compliance/traffic-fines/$id';
    case 'VehicleDocument':
      return '/compliance/documents/$id';
    default:
      return null;
  }
}

String? _fromWebPath(String link) {
  var path = link;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    final uri = Uri.tryParse(path);
    if (uri == null) return null;
    path = uri.path;
    if (uri.queryParameters.isNotEmpty) {
      path = '$path?${uri.query}';
    }
  }
  if (!path.startsWith('/')) path = '/$path';

  final uri = Uri.parse(path);
  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  if (segments.isEmpty) return null;

  switch (segments.first) {
    case 'work-orders':
      final highlight = uri.queryParameters['highlight'];
      if (highlight != null && highlight.isNotEmpty) {
        return '/work-orders/$highlight';
      }
      if (segments.length >= 2) return '/work-orders/${segments[1]}';
      return '/work-orders';
    case 'vehicles':
      if (segments.length >= 2) return '/fleet/vehicles/${segments[1]}';
      return '/fleet';
    case 'assets':
      if (segments.length >= 2) return '/assets/${segments[1]}';
      return '/assets/list';
    case 'utilities':
      if (segments.length >= 3 && segments[1] == 'meters') {
        return '/facilities/utilities/${segments[2]}';
      }
      return '/facilities/utilities';
    case 'cleaning':
      if (segments.contains('issues')) {
        final issueId = uri.queryParameters['issueId'];
        if (issueId != null && issueId.isNotEmpty) {
          return '/facilities/issues/$issueId';
        }
        return '/facilities/issues';
      }
      if (segments.contains('visits')) return '/facilities/cleaning/visits';
      return '/facilities';
    case 'facilities':
      return '/facilities';
    case 'inventory':
      if (segments.contains('purchase-orders') && segments.length >= 3) {
        return '/inventory/purchase-orders/${segments.last}';
      }
      return '/inventory';
    case 'compliance':
      return '/compliance';
    case 'accidents':
      if (segments.length >= 2) return '/compliance/accidents/${segments[1]}';
      return '/compliance/accidents';
    case 'fg':
      return '/fg';
    default:
      return null;
  }
}
