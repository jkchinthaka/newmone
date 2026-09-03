import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/design_system/design_system.dart';

void main() {
  testWidgets('MpHubTile renders title and subtitle', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MpHubTile(
            icon: Icons.build_outlined,
            title: 'Work Orders',
            subtitle: 'Assigned and open jobs',
            onTap: () {},
          ),
        ),
      ),
    );
    expect(find.text('Work Orders'), findsOneWidget);
    expect(find.text('Assigned and open jobs'), findsOneWidget);
  });

  testWidgets('MpWorkOrderCard shows status chip', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MpWorkOrderCard(
            title: 'Replace filter',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            assetName: 'Pump A',
            onTap: () {},
          ),
        ),
      ),
    );
    expect(find.text('Replace filter'), findsOneWidget);
    expect(find.textContaining('IN PROGRESS'), findsOneWidget);
  });

  testWidgets('MpKpiCard renders label and value', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            height: 140,
            width: 180,
            child: MpKpiCard(
              label: 'Open WOs',
              value: '12',
              subLabel: 'This week',
            ),
          ),
        ),
      ),
    );
    expect(find.text('Open WOs'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
  });
}
