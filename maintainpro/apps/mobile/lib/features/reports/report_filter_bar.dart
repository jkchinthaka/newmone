import 'package:flutter/material.dart';

import '../../../design_system/design_system.dart';

/// Server-backed report filter params (maps to Nest ReportQuery).
class ReportFilterParams {
  const ReportFilterParams({
    this.startDate,
    this.endDate,
    this.status,
    this.search,
    this.page = 1,
    this.pageSize = 20,
  });

  final String? startDate;
  final String? endDate;
  final String? status;
  final String? search;
  final int page;
  final int pageSize;

  ReportFilterParams copyWith({
    String? startDate,
    String? endDate,
    String? status,
    String? search,
    int? page,
    int? pageSize,
  }) {
    return ReportFilterParams(
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      status: status ?? this.status,
      search: search ?? this.search,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
    );
  }

  Map<String, dynamic> toQuery() => {
        if (startDate != null && startDate!.isNotEmpty) 'startDate': startDate,
        if (endDate != null && endDate!.isNotEmpty) 'endDate': endDate,
        if (status != null && status!.isNotEmpty) 'status': status,
        if (search != null && search!.isNotEmpty) 'search': search,
        'page': page,
        'pageSize': pageSize,
      };

  static String? formatDate(DateTime? d) {
    if (d == null) return null;
    return '${d.year.toString().padLeft(4, '0')}-'
        '${d.month.toString().padLeft(2, '0')}-'
        '${d.day.toString().padLeft(2, '0')}';
  }
}

class ReportFilterBar extends StatelessWidget {
  const ReportFilterBar({
    super.key,
    required this.filters,
    required this.onChanged,
    this.showStatus = true,
    this.showSearch = true,
    this.onApply,
  });

  final ReportFilterParams filters;
  final ValueChanged<ReportFilterParams> onChanged;
  final bool showStatus;
  final bool showSearch;
  final VoidCallback? onApply;

  Future<void> _pickDate(
    BuildContext context, {
    required bool isStart,
  }) async {
    final initial = isStart
        ? (filters.startDate != null ? DateTime.tryParse(filters.startDate!) : null)
        : (filters.endDate != null ? DateTime.tryParse(filters.endDate!) : null);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked == null) return;
    final iso = ReportFilterParams.formatDate(picked);
    onChanged(
      filters.copyWith(
        startDate: isStart ? iso : filters.startDate,
        endDate: isStart ? filters.endDate : iso,
        page: 1,
      ),
    );
    onApply?.call();
  }

  @override
  Widget build(BuildContext context) {
    return MpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Filters', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: MpSpacing.sm),
          Wrap(
            spacing: MpSpacing.sm,
            runSpacing: MpSpacing.sm,
            children: [
              OutlinedButton.icon(
                onPressed: () => _pickDate(context, isStart: true),
                icon: const Icon(Icons.date_range, size: 18),
                label: Text(filters.startDate ?? 'Start date'),
              ),
              OutlinedButton.icon(
                onPressed: () => _pickDate(context, isStart: false),
                icon: const Icon(Icons.event, size: 18),
                label: Text(filters.endDate ?? 'End date'),
              ),
              if (showStatus)
                SizedBox(
                  width: 140,
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Status',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                    controller: TextEditingController(text: filters.status),
                    onSubmitted: (v) {
                      onChanged(filters.copyWith(status: v.trim(), page: 1));
                      onApply?.call();
                    },
                  ),
                ),
            ],
          ),
          if (showSearch) ...[
            const SizedBox(height: MpSpacing.sm),
            TextField(
              decoration: const InputDecoration(
                labelText: 'Search',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
                isDense: true,
              ),
              controller: TextEditingController(text: filters.search),
              onSubmitted: (v) {
                onChanged(filters.copyWith(search: v.trim(), page: 1));
                onApply?.call();
              },
            ),
          ],
        ],
      ),
    );
  }
}
