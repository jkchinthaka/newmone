import '../config/app_config.dart';

/// All API endpoints for the MaintainPro backend.
/// Methods that take an id return the full path string.
class ApiEndpoints {
  ApiEndpoints._();

  static String get baseUrl => AppConfig.apiBaseUrl;

  // ── Auth ──
  static const String register = '/auth/register';
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String me = '/auth/me';

  // ── Users ──
  static const String users = '/users';
  static String userById(String id) => '/users/$id';

  // ── Tenancy ──
  static const String tenancyCreate = '/tenancy/create';
  static const String tenancyList = '/tenancy/list';
  static const String tenancyInvite = '/tenancy/invite';
  static String tenancyAcceptInvite(String token) =>
      '/tenancy/accept-invite/$token';

  // ── Assets ──
  static const String assets = '/assets';
  static const String assetsValidateTag = '/assets/validate-tag';
  static const String assetsFilterOptions = '/assets/filter-options';
  static const String assetsSummary = '/assets/summary';
  static String assetById(String id) => '/assets/$id';
  static String assetQr(String id) => '/assets/$id/qr-code';
  static String assetMaintenanceHistory(String id) =>
      '/assets/$id/maintenance-history';
  static String assetStatus(String id) => '/assets/$id/status';
  static const String assetsBatchUpload = '/assets/bulk-import';

  // ── Work Orders ──
  static const String workOrders = '/work-orders';
  static String workOrderById(String id) => '/work-orders/$id';
  static String workOrderAssign(String id) => '/work-orders/$id/assign';
  static String workOrderStatus(String id) => '/work-orders/$id/status';
  static String workOrderParts(String id) => '/work-orders/$id/parts';
  static String workOrderNotes(String id) => '/work-orders/$id/notes';
  static String workOrderAttachments(String id) =>
      '/work-orders/$id/attachments';

  // ── Maintenance ──
  static const String maintenanceSchedules = '/maintenance/schedules';
  static String maintenanceScheduleById(String id) =>
      '/maintenance/schedules/$id';
  static const String maintenanceLogs = '/maintenance/logs';

  // ── Fleet · Vehicles ──
  static const String vehicles = '/vehicles';
  static const String vehiclesSummary = '/vehicles/summary';
  static const String vehiclesAlerts = '/vehicles/alerts';
  static String vehicleById(String id) => '/vehicles/$id';
  static String vehicleAssignDriver(String id) => '/vehicles/$id/assign-driver';
  static String vehicleFuelLog(String id) => '/vehicles/$id/fuel-log';
  static String vehicleFuelLogs(String id) => '/vehicles/$id/fuel-logs';
  static String vehicleFuelAnalytics(String id) =>
      '/vehicles/$id/fuel-analytics';
  static String vehicleTripStart(String id) => '/vehicles/$id/trip-start';
  static String vehicleTripEnd(String id) => '/vehicles/$id/trip-end';
  static String vehicleTrips(String id) => '/vehicles/$id/trips';
  static String vehicleHistory(String id) => '/vehicles/$id/history';
  static String vehicleGpsUpdate(String id) => '/vehicles/$id/gps-update';

  // ── Fleet · Drivers ──
  static const String drivers = '/drivers';
  static String driverById(String id) => '/drivers/$id';

  // ── Fleet · Aggregate ──
  static const String fleetLiveMap = '/fleet/live-map';
  static const String fleetAlerts = '/fleet/alerts';
  static const String fleetGeofences = '/fleet/geofences';
  static String fleetGeofenceById(String id) => '/fleet/geofences/$id';
  static const String fleetStreetView = '/fleet/street-view';
  static const String fuelLogs = '/fuel/logs';
  static const String tripLogs = '/trips';

  // ── Inventory ──
  static const String inventory = '/inventory';
  static String inventoryById(String id) => '/inventory/$id';
  static String inventoryMovements(String id) => '/inventory/$id/movements';

  // ── Cleaning ──
  static const String cleaningLocations = '/cleaning/locations';
  static String cleaningLocationById(String id) => '/cleaning/locations/$id';
  static String cleaningLocationQr(String id) => '/cleaning/locations/$id/qr';
  static String cleaningLocationRegenerateQr(String id) =>
      '/cleaning/locations/$id/regenerate-qr';
  static const String cleaners = '/cleaning/users/cleaners';
  static const String cleaningScan = '/cleaning/scan';
  static const String cleaningVisitsScan = '/cleaning/visits/scan';
  static const String cleaningVisits = '/cleaning/visits';
  static String cleaningVisitById(String id) => '/cleaning/visits/$id';
  static String cleaningVisitSubmit(String id) => '/cleaning/visits/$id/submit';
  static String cleaningVisitSignOff(String id) =>
      '/cleaning/visits/$id/sign-off';
  static const String cleaningIssues = '/cleaning/issues';
  static String cleaningIssueById(String id) => '/cleaning/issues/$id';
  static const String cleaningDashboard = '/cleaning/dashboard';
  static const String cleaningAnalytics = '/cleaning/analytics';
  static const String cleaningCalendar = '/cleaning/schedule/calendar';

  // ── Farm ──
  static const String farmFields = '/farm/fields';
  static String farmFieldById(String id) => '/farm/fields/$id';
  static const String farmCrops = '/farm/crops';
  static String farmCropById(String id) => '/farm/crops/$id';
  static const String farmHarvest = '/farm/harvest';
  static const String farmLivestock = '/farm/livestock';
  static String farmLivestockById(String id) => '/farm/livestock/$id';
  static const String farmIrrigation = '/farm/irrigation';
  static const String farmSpray = '/farm/spray-logs';
  static const String farmSoilTests = '/farm/soil-tests';
  static const String farmWeather = '/farm/weather';
  static const String farmFinance = '/farm/finance';

  // ── Utilities ──
  static const String utilityMeters = '/utilities/meters';
  static String utilityMeterById(String id) => '/utilities/meters/$id';
  static String utilityMeterReadings(String id) =>
      '/utilities/meters/$id/readings';
  static const String utilityBills = '/utilities/bills';
  static String utilityBillById(String id) => '/utilities/bills/$id';
  static const String utilityAnalytics = '/utilities/analytics';

  // ── Suppliers ──
  static const String suppliers = '/suppliers';
  static String supplierById(String id) => '/suppliers/$id';
  static const String purchaseOrders = '/purchase-orders';
  static String purchaseOrderById(String id) => '/purchase-orders/$id';
  static String purchaseOrderStatus(String id) => '/purchase-orders/$id/status';

  // ── Notifications ──
  static const String notifications = '/notifications';
  static String notificationRead(String id) => '/notifications/$id/read';
  static const String notificationsReadAll = '/notifications/read-all';
  static const String notificationsUnreadCount = '/notifications/unread-count';

  // ── Reports ──
  static const String reportsAssets = '/reports/assets';
  static const String reportsMaintenance = '/reports/maintenance';
  static const String reportsFleet = '/reports/fleet';
  static const String reportsInventory = '/reports/inventory';
  static const String reportsCleaning = '/reports/cleaning';
  static const String reportsFarm = '/reports/farm';

  // ── Billing ──
  static const String billingPlan = '/billing/plan';
  static const String billingInvoices = '/billing/invoices';
  static const String billingCheckout = '/billing/checkout';

  // ── Settings ──
  static const String settings = '/settings';

  // ── Predictive AI ──
  static String predictiveAsset(String id) =>
      '/predictive-ai/asset/$id/prediction';
  static const String predictiveCopilotChat = '/predictive-ai/copilot/chat';

  // ── Health ──
  static const String health = '/health';

  // ── Dashboard (aggregate) ──
  static const String dashboard = '/reports/dashboard';
}
