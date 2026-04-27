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
  static const String maintenanceCalendar = '/maintenance/calendar';
  static const String maintenancePredictiveAlerts =
      '/maintenance/predictive-alerts';
  static String maintenancePredictiveAlertAck(String id) =>
      '/maintenance/predictive-alerts/$id/acknowledge';

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
  static const String inventoryParts = '/inventory/parts';
  static String inventoryPartById(String id) => '/inventory/parts/$id';
  static String inventoryPartStockIn(String id) =>
      '/inventory/parts/$id/stock-in';
  static String inventoryPartStockOut(String id) =>
      '/inventory/parts/$id/stock-out';
  static String inventoryPartMovements(String id) =>
      '/inventory/parts/$id/movements';
  static String inventoryPartWorkOrders(String id) =>
      '/inventory/parts/$id/work-orders';
  static String inventoryPartPurchaseHistory(String id) =>
      '/inventory/parts/$id/purchase-history';
  static const String inventoryLowStock = '/inventory/low-stock';
  static const String inventoryUsageTrend = '/inventory/analytics/usage';
  static const String inventoryTopUsed = '/inventory/analytics/top-used';
  static const String inventoryPurchaseOrders = '/inventory/purchase-orders';
  static String inventoryPurchaseOrderById(String id) =>
      '/inventory/purchase-orders/$id';

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
  static String farmHarvestById(String id) => '/farm/harvest/$id';
  static const String farmLivestockAnimals = '/farm/livestock/animals';
  static String farmLivestockAnimalById(String id) =>
      '/farm/livestock/animals/$id';
  static String farmAnimalHealth(String id) =>
      '/farm/livestock/animals/$id/health';
  static String farmAnimalProduction(String id) =>
      '/farm/livestock/animals/$id/production';
  static const String farmFeeding = '/farm/livestock/feeding';
  static const String farmIrrigation = '/farm/irrigation';
  static String farmIrrigationById(String id) => '/farm/irrigation/$id';
  static const String farmSpray = '/farm/spray-logs';
  static String farmSprayById(String id) => '/farm/spray-logs/$id';
  static const String farmSprayCompliance = '/farm/spray-logs/compliance';
  static const String farmSoilTests = '/farm/soil-tests';
  static String farmSoilTestById(String id) => '/farm/soil-tests/$id';
  static const String farmWeather = '/farm/weather';
  static const String farmWeatherAlerts = '/farm/weather/alerts';
  static const String farmWeatherPoll = '/farm/weather/poll';
  static const String farmWorkers = '/farm/workers';
  static String farmWorkerById(String id) => '/farm/workers/$id';
  static String farmWorkerAttendance(String id) =>
      '/farm/workers/$id/attendance';
  static const String farmWorkersAttendance = '/farm/workers/attendance';
  static const String farmFinanceSummary = '/farm/finance/summary';
  static const String farmFinanceExpenses = '/farm/finance/expenses';
  static String farmFinanceExpenseById(String id) =>
      '/farm/finance/expenses/$id';
  static const String farmFinanceIncome = '/farm/finance/income';
  static String farmFinanceIncomeById(String id) => '/farm/finance/income/$id';
  static const String farmTraceability = '/farm/traceability';
  static String farmTraceabilityPublic(String batchCode) =>
      '/farm/traceability/public/$batchCode';

  // ── Utilities ──
  static const String utilityMeters = '/utilities/meters';
  static String utilityMeterById(String id) => '/utilities/meters/$id';
  static String utilityMeterReadings(String id) =>
      '/utilities/meters/$id/readings';
  static String utilityMeterConsumptionChart(String id) =>
      '/utilities/meters/$id/consumption-chart';
  static const String utilityReadings = '/utilities/readings';
  static const String utilityBills = '/utilities/bills';
  static String utilityBillById(String id) => '/utilities/bills/$id';
  static String utilityBillPay(String id) => '/utilities/bills/$id/pay';
  static const String utilityBillsOverdue = '/utilities/bills/overdue';
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
  static const String reportsDashboard = '/reports/dashboard';
  static const String reportsMaintenanceCost = '/reports/maintenance-cost';
  static const String reportsFleetEfficiency = '/reports/fleet-efficiency';
  static const String reportsDowntime = '/reports/downtime';
  static const String reportsWorkOrders = '/reports/work-orders';
  static const String reportsInventory = '/reports/inventory';
  static const String reportsUtilities = '/reports/utilities';

  // ── Billing ──
  static const String billingSubscription = '/billing/subscription';
  static const String billingUsage = '/billing/usage';
  static const String billingCheckoutSession = '/billing/checkout-session';

  // ── Settings ──
  static const String settingsProfile = '/settings/profile';
  static const String settingsOrganization = '/settings/organization';
  static const String settingsSystem = '/settings/system';
  static const String settingsIntegrations = '/settings/integrations';
  static const String settingsFeatureToggles = '/settings/feature-toggles';
  static const String settingsAutomationRules = '/settings/automation-rules';
  static const String settingsDigestSchedules = '/settings/digest-schedules';
  static const String settingsAuditLogs = '/settings/audit-logs';

  // ── Predictive AI ──
  static String predictiveAsset(String id) =>
      '/predictive-ai/asset/$id/prediction';
  static const String predictiveCopilotChat = '/predictive-ai/copilot/chat';

  // ── AI Copilot / Assistant ──
  static const String aiCopilot = '/ai/copilot';
  static const String aiContext = '/ai/context';
  static const String aiConversations = '/ai/conversations';
  static String aiConversationById(String id) => '/ai/conversations/$id';
  static String aiConversationMessages(String id) =>
      '/ai/conversations/$id/messages';
  static const String aiActionCreateWorkOrder = '/ai/actions/create-work-order';
  static const String aiActionScheduleMaintenance =
      '/ai/actions/schedule-maintenance';
  static const String aiActionAssignTechnician =
      '/ai/actions/assign-technician';
  static const String aiActionGenerateReport = '/ai/actions/generate-report';

  // ── Health ──
  static const String health = '/health';

  // ── Dashboard (aggregate) ──
  static const String dashboard = '/reports/dashboard';
}
