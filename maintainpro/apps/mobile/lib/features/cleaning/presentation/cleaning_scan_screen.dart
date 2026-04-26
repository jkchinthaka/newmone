import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/cleaning_provider.dart';

enum _ScanMode { fullVisit, quickScan }

class CleaningScanScreen extends ConsumerStatefulWidget {
  const CleaningScanScreen({super.key});

  @override
  ConsumerState<CleaningScanScreen> createState() => _CleaningScanScreenState();
}

class _CleaningScanScreenState extends ConsumerState<CleaningScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    formats: const [BarcodeFormat.qrCode],
  );

  bool _processing = false;
  String? _statusMsg;
  bool _torchOn = false;
  _ScanMode _mode = _ScanMode.fullVisit;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _extractQr(String raw) {
    final m = RegExp(r'/scan/([^/?#]+)').firstMatch(raw);
    if (m != null) return Uri.decodeComponent(m.group(1)!);
    return raw.trim();
  }

  Future<void> _handleCode(String raw) async {
    if (_processing) return;
    _processing = true;
    HapticFeedback.lightImpact();

    final qr = _extractQr(raw);
    setState(() => _statusMsg = 'Processing…');

    try {
      final remote = ref.read(cleaningRemoteProvider);
      if (_mode == _ScanMode.fullVisit) {
        final visit = await remote.startVisit(qr);
        if (!mounted) return;
        ref.invalidate(cleaningVisitsProvider);
        context.go('/cleaning/visits/${visit.id}');
      } else {
        await remote.scan(qr);
        if (!mounted) return;
        ref.invalidate(cleaningLocationsProvider);
        ref.invalidate(cleaningVisitsProvider);
        setState(() => _statusMsg = 'Marked clean ✓');
        await Future<void>.delayed(const Duration(milliseconds: 1200));
        if (mounted) Navigator.of(context).maybePop();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _statusMsg = 'Error: $e');
      await Future<void>.delayed(const Duration(seconds: 2));
      if (mounted) setState(() => _statusMsg = null);
    } finally {
      _processing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.black.withOpacity(0.4),
        elevation: 0,
        title: const Text('Scan location QR'),
        actions: [
          IconButton(
            tooltip: 'Toggle torch',
            icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            onPressed: () async {
              await _controller.toggleTorch();
              setState(() => _torchOn = !_torchOn);
            },
          ),
          IconButton(
            tooltip: 'Switch camera',
            icon: const Icon(Icons.cameraswitch_rounded),
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: (capture) {
              for (final b in capture.barcodes) {
                final raw = b.rawValue;
                if (raw != null && raw.isNotEmpty) {
                  _handleCode(raw);
                  break;
                }
              }
            },
          ),
          IgnorePointer(
            child: CustomPaint(
              painter: _ScannerOverlayPainter(),
              child: const SizedBox.expand(),
            ),
          ),
          // Mode toggle
          Positioned(
            left: AppSpacing.md,
            right: AppSpacing.md,
            top: kToolbarHeight + AppSpacing.lg,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.card.withOpacity(0.85),
                borderRadius: BorderRadius.circular(AppRadius.full),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _ModeChip(
                      label: 'Full visit',
                      selected: _mode == _ScanMode.fullVisit,
                      onTap: () => setState(() => _mode = _ScanMode.fullVisit),
                    ),
                  ),
                  Expanded(
                    child: _ModeChip(
                      label: 'Quick scan',
                      selected: _mode == _ScanMode.quickScan,
                      onTap: () => setState(() => _mode = _ScanMode.quickScan),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            left: AppSpacing.md,
            right: AppSpacing.md,
            bottom: AppSpacing.xl,
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.card.withOpacity(0.85),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.qr_code_scanner_rounded,
                      color: AppColors.primaryLight),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      _statusMsg ??
                          (_mode == _ScanMode.fullVisit
                              ? 'Scan the location QR to start a visit with checklist.'
                              : 'Scan to instantly log a cleaning visit.'),
                      style: AppTextStyles.body,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadius.full),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.label.copyWith(
            color: selected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _ScannerOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final scrim = Paint()..color = Colors.black.withOpacity(0.55);
    final cutoutSize = size.shortestSide * 0.7;
    final rect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: cutoutSize,
      height: cutoutSize,
    );
    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(20));

    final scrimPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final holePath = Path()..addRRect(rrect);
    final overlay = Path.combine(PathOperation.difference, scrimPath, holePath);
    canvas.drawPath(overlay, scrim);

    final bracket = Paint()
      ..color = AppColors.primaryLight
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const arm = 24.0;
    canvas.drawLine(rect.topLeft, rect.topLeft + const Offset(arm, 0), bracket);
    canvas.drawLine(rect.topLeft, rect.topLeft + const Offset(0, arm), bracket);
    canvas.drawLine(
        rect.topRight, rect.topRight + const Offset(-arm, 0), bracket);
    canvas.drawLine(
        rect.topRight, rect.topRight + const Offset(0, arm), bracket);
    canvas.drawLine(
        rect.bottomLeft, rect.bottomLeft + const Offset(arm, 0), bracket);
    canvas.drawLine(
        rect.bottomLeft, rect.bottomLeft + const Offset(0, -arm), bracket);
    canvas.drawLine(
        rect.bottomRight, rect.bottomRight + const Offset(-arm, 0), bracket);
    canvas.drawLine(
        rect.bottomRight, rect.bottomRight + const Offset(0, -arm), bracket);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
