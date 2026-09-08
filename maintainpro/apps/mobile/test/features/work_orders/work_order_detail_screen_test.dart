import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maintainpro_mobile/core/network/api_exception.dart';
import 'package:maintainpro_mobile/features/work_orders/data/work_orders_repository.dart';
import 'package:maintainpro_mobile/features/work_orders/presentation/work_order_detail_screen.dart';

void main() {
  testWidgets('WorkOrderDetailScreen shows loading then title', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          workOrderDetailProvider.overrideWith((ref, id) async {
            await Future<void>.delayed(const Duration(milliseconds: 20));
            return WorkOrderDetail.fromJson({
              'id': id,
              'title': 'HVAC repair',
              'status': 'OPEN',
              'priority': 'HIGH',
            });
          }),
          workOrderEvidenceProvider.overrideWith((ref, id) async => const []),
          workOrderPartsProvider.overrideWith((ref, id) async => const []),
          workOrderActivityProvider.overrideWith((ref, id) async => const []),
        ],
        child: const MaterialApp(
          home: WorkOrderDetailScreen(workOrderId: 'wo-test'),
        ),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsWidgets);
    await tester.pumpAndSettle();
    expect(find.text('HVAC repair'), findsOneWidget);
    expect(find.text('Evidence'), findsOneWidget);
    expect(find.text('Parts'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);
  });

  testWidgets('WorkOrderDetailScreen shows error state', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          workOrderDetailProvider.overrideWith((ref, id) async {
            throw const NotFoundException('missing');
          }),
        ],
        child: const MaterialApp(
          home: WorkOrderDetailScreen(workOrderId: 'missing'),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Could not load work order'), findsOneWidget);
    expect(find.text('missing'), findsOneWidget);
  });
}
