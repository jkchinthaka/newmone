import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/facilities_api_client.dart';
import 'data/facilities_models.dart';
import 'facilities_permissions.dart';

class FacilityRoomDetailScreen extends ConsumerStatefulWidget {
  const FacilityRoomDetailScreen({super.key, required this.roomId});

  final String roomId;

  @override
  ConsumerState<FacilityRoomDetailScreen> createState() =>
      _FacilityRoomDetailScreenState();
}

class _FacilityRoomDetailScreenState extends ConsumerState<FacilityRoomDetailScreen> {
  bool _loading = true;
  String? _error;
  RoomSummary? _room;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final room =
          await ref.read(facilitiesApiClientProvider).getRoom(widget.roomId);
      if (!mounted) return;
      setState(() {
        _room = room;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final room = _room;
    return Scaffold(
      appBar: AppBar(title: Text(room?.name ?? 'Room')),
      body: _loading
          ? const MpLoading(message: 'Loading room…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : room == null
                  ? const MpEmptyState(title: 'Room not found')
                  : ListView(
                      padding: const EdgeInsets.all(MpSpacing.screenPadding),
                      children: [
                        MpCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Code: ${room.code ?? '—'}'),
                              Text('Type: ${room.roomType ?? '—'}'),
                              Text('Floor: ${room.floorName ?? '—'}'),
                              Text('Building: ${room.buildingName ?? '—'}'),
                            ],
                          ),
                        ),
                        const SizedBox(height: MpSpacing.md),
                        if (FacilitiesPermissions.canReportIssue(
                            ref.watch(authControllerProvider).user?.role))
                          MpButton(
                            label: 'Report issue',
                            icon: Icons.report_outlined,
                            onPressed: () => context.push(
                              '/facilities/issues/report?roomId=${room.id}&roomLabel=${Uri.encodeComponent(room.name)}',
                            ),
                          ),
                        const SizedBox(height: MpSpacing.sm),
                        MpButton(
                          label: 'View facility issues',
                          icon: Icons.report_problem_outlined,
                          onPressed: () => context.push('/facilities/issues'),
                        ),
                      ],
                    ),
    );
  }
}
