import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/i18n/app_strings.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/sync_controller.dart';
import '../../design_system/design_system.dart';
import '../assets/data/assets_api_client.dart';
import '../gate/data/gate_api_client.dart';
import '../gate/data/gate_models.dart';
import '../shell/adaptive_shell.dart';
import 'data/scan_api_client.dart';
import 'data/scan_models.dart';

/// Universal scan: camera + manual entry → Nest authenticated lookup → entity route.
class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});

  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  final _manual = TextEditingController();
  final MobileScannerController _scanner = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );

  bool _resolving = false;
  bool _torchOn = false;
  String? _lastCode;
  DateTime? _lastScanAt;
  String? _cameraError;

  static const _debounceMs = 1800;

  @override
  void dispose() {
    _manual.dispose();
    _scanner.dispose();
    super.dispose();
  }

  bool get _isOffline =>
      ref.read(syncControllerProvider).phase == SyncPhase.offline;

  bool get _isSecurity {
    final role =
        (ref.read(authControllerProvider).user?.role ?? '').toUpperCase();
    return role == 'SECURITY_OFFICER';
  }

  bool get _canScanLookup {
    final perms =
        ref.read(authControllerProvider).user?.permissions ?? const [];
    return perms.contains('operations.scan_lookup');
  }

  String _vehicleRoute(String id) =>
      _isSecurity ? '/gate/vehicle/$id' : '/fleet/vehicles/$id';

  bool _shouldIgnoreDuplicate(String code) {
    final now = DateTime.now();
    if (_lastCode == code &&
        _lastScanAt != null &&
        now.difference(_lastScanAt!).inMilliseconds < _debounceMs) {
      return true;
    }
    _lastCode = code;
    _lastScanAt = now;
    return false;
  }

  Future<void> _onBarcode(BarcodeCapture capture) async {
    if (_resolving) return;
    final raw = capture.barcodes
        .map((b) => b.rawValue?.trim())
        .whereType<String>()
        .firstWhere((v) => v.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return;
    if (_shouldIgnoreDuplicate(raw)) return;
    await _resolveCode(raw);
  }

  Future<void> _onManualSubmit() async {
    final code = _manual.text.trim();
    if (code.isEmpty) return;
    await _resolveCode(code);
  }

  Future<void> _resolveCode(String code) async {
    if (_isOffline) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Scan lookup requires network connectivity.'),
        ),
      );
      return;
    }

    if (looksLikeVehicleId(code)) {
      context.push(_vehicleRoute(code));
      return;
    }

    setState(() => _resolving = true);
    try {
      if (_canScanLookup) {
        final result = await ref.read(scanApiClientProvider).scanLookup(code);
        if (!mounted) return;
        final route = mapScanTargetToMobileRoute(
          target: result.target,
          isSecurityOfficer: _isSecurity,
        );
        if (route != null) {
          context.push(route);
          return;
        }
      }

      await _legacyLookup(code);
    } on NotFoundException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unknown code: $code')),
      );
    } on ForbiddenException {
      await _legacyLookup(code);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not resolve code: $code')),
      );
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  Future<void> _legacyLookup(String code) async {
    final matches =
        await ref.read(gateApiClientProvider).searchVehicles(code);
    if (!mounted) return;
    if (matches.length == 1) {
      context.push(_vehicleRoute(matches.first.id));
      return;
    }
    if (matches.length > 1) {
      context.push(_isSecurity ? '/gate' : '/fleet/vehicles');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Found ${matches.length} vehicles for "$code"')),
      );
      return;
    }

    final lookup = await ref.read(assetsApiClientProvider).validateTag(code);
    if (!mounted) return;
    if (lookup.exists &&
        lookup.assetId != null &&
        lookup.assetId!.isNotEmpty) {
      context.push('/assets/${lookup.assetId}');
      return;
    }

    throw NotFoundException('No vehicle or asset match for: $code');
  }

  Future<void> _toggleTorch() async {
    await _scanner.toggleTorch();
    setState(() => _torchOn = !_torchOn);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.navScan),
        actions: [
          IconButton(
            tooltip: _torchOn ? 'Turn torch off' : 'Turn torch on',
            onPressed: _toggleTorch,
            icon: Icon(_torchOn ? Icons.flash_off : Icons.flash_on),
          ),
          ...shellActions(context),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: ClipRRect(
              borderRadius: MpRadius.lgAll,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  MobileScanner(
                    controller: _scanner,
                    onDetect: _onBarcode,
                    errorBuilder: (context, error, child) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted && _cameraError != error.errorCode.name) {
                          setState(() => _cameraError = error.errorCode.name);
                        }
                      });
                      return ColoredBox(
                        color: scheme.surfaceContainerHighest,
                        child: Center(
                          child: Padding(
                            padding: const EdgeInsets.all(MpSpacing.lg),
                            child: Text(
                              'Camera unavailable (${error.errorCode.name}). '
                              'Use manual entry below.',
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  if (_resolving)
                    Container(
                      color: Colors.black45,
                      child: const Center(
                        child: CircularProgressIndicator(),
                      ),
                    ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      color: Colors.black54,
                      padding: const EdgeInsets.all(MpSpacing.sm),
                      child: Text(
                        _isOffline
                            ? 'Offline — scan lookup unavailable'
                            : AppStrings.scanHint,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: Colors.white),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_cameraError != null) ...[
            const SizedBox(height: MpSpacing.sm),
            Text(
              'Camera: $_cameraError',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: scheme.error,
                  ),
            ),
          ],
          const SizedBox(height: MpSpacing.xl),
          Text(
            AppStrings.scanManualHint,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: MpSpacing.sm),
          MpTextField(
            controller: _manual,
            label: 'Code',
            prefixIcon: Icons.tag,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _onManualSubmit(),
          ),
          const SizedBox(height: MpSpacing.lg),
          MpButton(
            label: 'Look up',
            icon: Icons.search,
            isLoading: _resolving,
            onPressed: _resolving ? null : _onManualSubmit,
          ),
          const SizedBox(height: MpSpacing.md),
          MpButton(
            label: _isSecurity ? 'Open Gate' : 'Open Fleet',
            variant: MpButtonVariant.tonal,
            icon: _isSecurity
                ? Icons.local_shipping_outlined
                : Icons.directions_car_outlined,
            onPressed: () => context.push(_isSecurity ? '/gate' : '/fleet'),
          ),
        ],
      ),
    );
  }
}
