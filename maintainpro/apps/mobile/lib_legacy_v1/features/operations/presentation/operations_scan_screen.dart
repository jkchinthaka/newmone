import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/operational_scan_result.dart';
import 'providers/operations_provider.dart';

class OperationsScanScreen extends ConsumerStatefulWidget {
  const OperationsScanScreen({super.key});

  @override
  ConsumerState<OperationsScanScreen> createState() =>
      _OperationsScanScreenState();
}

class _OperationsScanScreenState extends ConsumerState<OperationsScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    formats: const [BarcodeFormat.qrCode, BarcodeFormat.code128],
  );

  bool _processing = false;
  bool _torchOn = false;
  String? _statusMsg;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleCode(String raw) async {
    if (_processing) {
      return;
    }

    _processing = true;
    HapticFeedback.lightImpact();
    setState(() => _statusMsg = 'Resolving operational scan...');

    try {
      final result = await ref.read(operationsRemoteProvider).scanLookup(raw);
      if (!mounted) {
        return;
      }

      setState(() => _statusMsg = _successMessage(result));
      context.go(result.target.route);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _statusMsg = 'No supported match found. Try another code.');
      await Future<void>.delayed(const Duration(seconds: 2));
      if (mounted) {
        setState(() => _statusMsg = null);
      }
    } finally {
      _processing = false;
    }
  }

  String _successMessage(OperationalScanResult result) {
    final label = switch (result.target.type) {
      OperationalScanTargetType.asset => 'asset',
      OperationalScanTargetType.vehicle => 'vehicle',
      OperationalScanTargetType.driver => 'driver',
      OperationalScanTargetType.workOrder => 'work order',
    };

    return 'Opening ${result.target.title} $label...';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.black.withValues(alpha: 0.4),
        elevation: 0,
        title: const Text('Operational Scan'),
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
              for (final barcode in capture.barcodes) {
                final rawValue = barcode.rawValue;
                if (rawValue != null && rawValue.isNotEmpty) {
                  _handleCode(rawValue);
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
          Positioned(
            left: AppSpacing.md,
            right: AppSpacing.md,
            bottom: AppSpacing.xl,
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.card.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.qr_code_scanner_rounded,
                    color: AppColors.primaryLight,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      _statusMsg ??
                          'Scan a vehicle, driver, work-order, or asset QR code.',
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

class _ScannerOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final scrim = Paint()..color = Colors.black.withValues(alpha: 0.55);
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
    canvas.drawLine(rect.topRight, rect.topRight + const Offset(-arm, 0), bracket);
    canvas.drawLine(rect.topRight, rect.topRight + const Offset(0, arm), bracket);
    canvas.drawLine(rect.bottomLeft, rect.bottomLeft + const Offset(arm, 0), bracket);
    canvas.drawLine(rect.bottomLeft, rect.bottomLeft + const Offset(0, -arm), bracket);
    canvas.drawLine(rect.bottomRight, rect.bottomRight + const Offset(-arm, 0), bracket);
    canvas.drawLine(rect.bottomRight, rect.bottomRight + const Offset(0, -arm), bracket);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}