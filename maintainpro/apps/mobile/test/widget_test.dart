import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/config/app_flavor.dart';
import 'package:maintainpro_mobile/core/rbac/role_home_config.dart';
import 'package:maintainpro_mobile/design_system/tokens/colors.dart';

void main() {
  test('brand primary is MaintainPro teal', () {
    expect(MpColors.primary.toARGB32(), 0xFF0F766E);
    expect(MpColors.primaryLight.toARGB32(), 0xFF14B8A6);
  });

  test('default flavor is dev when unset', () {
    expect(AppFlavor.fromDefine(), AppFlavor.dev);
  });

  test('technician home cards include my tasks', () {
    final cards = RoleHomeConfig.cardsForRole('TECHNICIAN');
    expect(cards.map((c) => c.id), contains('my-tasks'));
  });
}
