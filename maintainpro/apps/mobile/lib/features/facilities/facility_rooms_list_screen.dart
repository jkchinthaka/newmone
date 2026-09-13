import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/facilities_api_client.dart';
import 'data/facilities_models.dart';

class FacilityRoomsListScreen extends ConsumerStatefulWidget {
  const FacilityRoomsListScreen({super.key});

  @override
  ConsumerState<FacilityRoomsListScreen> createState() =>
      _FacilityRoomsListScreenState();
}

class _FacilityRoomsListScreenState extends ConsumerState<FacilityRoomsListScreen> {
  final _searchController = TextEditingController();
  bool _loading = true;
  String? _error;
  List<RoomSummary> _items = const [];
  String _search = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref
          .read(facilitiesApiClientProvider)
          .listRooms(q: _search.isEmpty ? null : _search);
      if (!mounted) return;
      setState(() {
        _items = items;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Rooms')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(MpSpacing.screenPadding),
            child: MpTextField(
              controller: _searchController,
              label: 'Search',
              hint: 'Room name or code',
              prefixIcon: Icons.search,
              onSubmitted: (v) {
                setState(() => _search = v.trim());
                _load();
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const MpLoading(message: 'Loading rooms…')
                : _error != null
                    ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
                    : _items.isEmpty
                        ? const MpEmptyState(title: 'No rooms found')
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(
                                MpSpacing.screenPadding,
                              ),
                              itemCount: _items.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: MpSpacing.sm),
                              itemBuilder: (context, index) {
                                final room = _items[index];
                                return MpCard(
                                  onTap: () => context.push(
                                    '/facilities/rooms/${room.id}',
                                  ),
                                  child: ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(room.name),
                                    subtitle: Text(
                                      [
                                        room.code,
                                        room.buildingName,
                                        room.roomType,
                                      ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
