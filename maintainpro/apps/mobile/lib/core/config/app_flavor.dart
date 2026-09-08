/// App build flavors selected via `--dart-define=APP_FLAVOR=dev|uat|prod`.
enum AppFlavor {
  dev,
  uat,
  prod;

  static AppFlavor fromDefine() {
    const raw = String.fromEnvironment('APP_FLAVOR', defaultValue: 'dev');
    switch (raw.toLowerCase()) {
      case 'prod':
      case 'production':
        return AppFlavor.prod;
      case 'uat':
      case 'staging':
        return AppFlavor.uat;
      case 'dev':
      case 'development':
      default:
        return AppFlavor.dev;
    }
  }

  String get label => name.toUpperCase();
}
