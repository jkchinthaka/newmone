import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/assets_provider.dart';

class AssetScannerScreen extends ConsumerStatefulWidget {
  const AssetScannerScreen({super.key});

  @override
  ConsumerState<AssetScannerScreen> createState() => _AssetScannerScreenState();
}

class _AssetScannerScreenState extends ConsumerState<AssetScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    formats: const [BarcodeFormat.qrCode, BarcodeFormat.code128],
  );

  bool _processing = false;
  String? _statusMsg;
  bool _torchOn = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleCode(String raw) async {
    if (_processing) return;
    _processing = true;
    HapticFeedback.lightImpact();
    setState(() => _statusMsg = 'Looking up "$raw"…');

    try {
      // Try to extract id from a URL like "https://app/assets/<id>" or
      // "https://app/scan/<assetTag>". Else treat raw as an asset tag.
      String? assetId;
      String? tag;

      final urlMatch = RegExp(r'/assets/([A-Za-z0-9-]+)').firstMatch(raw);
      if (urlMatch != null) {
        assetId = urlMatch.group(1);
      } else {
        final scanMatch = RegExp(r'/scan/([^/?#]+)').firstMatch(raw);
        if (scanMatch != null) {
          tag = Uri.decodeComponent(scanMatch.group(1)!);
        } else {
          tag = raw.trim();
        }
      }

      if (assetId != null) {
        if (!mounted) return;
        context.go('/assets/$assetId');
        return;
      }

      final lookup =
          await ref.read(assetsRemoteProvider).validateTag(tag ?? raw);
      if (!mounted) return;

      if (lookup.exists && lookup.assetId != null) {
        context.go('/assets/${lookup.assetId}');
      } else {
        setState(() =>
            _statusMsg = 'No asset found for "${tag ?? raw}". Try again.');
        await Future<void>.delayed(const Duration(seconds: 2));
        if (mounted) setState(() => _statusMsg = null);
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
        backgroundColor: Colors.black.withValues(alpha: 0.4),
        elevation: 0,
        title: const Text('Scan Asset QR'),
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
          // Viewfinder overlay
          IgnorePointer(
            child: CustomPaint(
              painter: _ScannerOverlayPainter(),
              child: const SizedBox.expand(),
            ),
          ),
          // Bottom hint card
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
                  const Icon(Icons.qr_code_scanner_rounded,
                      color: AppColors.primaryLight),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      _statusMsg ??
                          'Align the QR code inside the frame to scan an asset.',
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

    // Corner brackets
    final bracket = Paint()
      ..color = AppColors.primaryLight
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const arm = 24.0;
    // top-left
    canvas.drawLine(rect.topLeft, rect.topLeft + const Offset(arm, 0), bracket);
    canvas.drawLine(rect.topLeft, rect.topLeft + const Offset(0, arm), bracket);
    // top-right
    canvas.drawLine(
        rect.topRight, rect.topRight + const Offset(-arm, 0), bracket);
    canvas.drawLine(
        rect.topRight, rect.topRight + const Offset(0, arm), bracket);
    // bottom-left
    canvas.drawLine(
        rect.bottomLeft, rect.bottomLeft + const Offset(arm, 0), bracket);
    canvas.drawLine(
        rect.bottomLeft, rect.bottomLeft + const Offset(0, -arm), bracket);
    // bottom-right
    canvas.drawLine(
        rect.bottomRight, rect.bottomRight + const Offset(-arm, 0), bracket);
    canvas.drawLine(
        rect.bottomRight, rect.bottomRight + const Offset(0, -arm), bracket);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
