/// English string catalog — foundation for future Sinhala / Tamil ARB files.
library;

abstract final class AppStrings {
  static const appName = 'MaintainPro';
  static const tagline = 'Field operations, done right';

  static const loginTitle = 'Sign in';
  static const loginSubtitle = 'Use your MaintainPro account';
  static const emailLabel = 'Email';
  static const passwordLabel = 'Password';
  static const signIn = 'Sign in';
  static const signOut = 'Sign out';
  static const invalidCredentials = 'Invalid email or password';
  static const fieldRequired = 'Required';
  static const invalidEmail = 'Enter a valid email';

  static const navHome = 'Home';
  static const navTasks = 'Tasks';
  static const navScan = 'Scan';
  static const navAlerts = 'Alerts';
  static const navMore = 'More';

  static const searchTitle = 'Search';
  static const searchHint = 'Search work orders, assets, vehicles…';
  static const profileTitle = 'Profile';
  static const settingsTitle = 'Settings';
  static const diagnosticsTitle = 'Diagnostics';
  static const draftsTitle = 'Drafts';
  static const syncTitle = 'Sync center';
  static const workOrdersTitle = 'Work orders';
  static const workOrderDetailTitle = 'Work order';

  static const loading = 'Loading…';
  static const retry = 'Retry';
  static const emptyGeneric = 'Nothing here yet';
  static const emptyWorkOrders = 'No work orders found';
  static const emptyTasks = 'No tasks in this queue';
  static const emptyAlerts = 'You are all caught up';
  static const emptyDrafts = 'No local drafts';
  static const emptySync = 'Outbox is empty';
  static const offlineBanner = 'You are offline — changes will sync later';
  static const online = 'Online';
  static const offline = 'Offline';

  static const startWork = 'Start';
  static const completeWork = 'Complete';
  static const statusUpdated = 'Status updated';
  static const actionFailed = 'Action failed';

  static const themeLight = 'Light';
  static const themeDark = 'Dark';
  static const themeSystem = 'System';
  static const languageEnglish = 'English';
  static const languageComingSoon = 'Sinhala & Tamil coming soon';

  static const moduleHubTitle = 'Modules';
  static const scanHint = 'Point at a QR code or barcode';
  static const scanManualHint = 'Or enter a code manually';
  static const comingSoon = 'Coming in a later milestone';
}
