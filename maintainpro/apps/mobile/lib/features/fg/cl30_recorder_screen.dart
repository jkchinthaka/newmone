import 'data/fg_form_config.dart';
import 'fg_form_recorder_screen.dart';

/// CL30 freezer-truck recorder — thin wrapper over [FgFormRecorderScreen].
class Cl30RecorderScreen extends FgFormRecorderScreen {
  const Cl30RecorderScreen({
    super.key,
    super.recordId,
    super.resumeDraftId,
  }) : super(config: FgFormConfig.cl30);
}
