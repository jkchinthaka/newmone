import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class AssetScannerScreen extends StatefulWidget {
  const AssetScannerScreen({super.key});

  @override
  State<AssetScannerScreen> createState() => _AssetScannerScreenState();
}

class _AssetScannerScreenState extends State<AssetScannerScreen> {
  String _lastCode = 'No code scanned yet';

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 260,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: MobileScanner(
                onDetect: (capture) {
                  final code = capture.barcodes.isNotEmpty
                      ? capture.barcodes.first.rawValue
                      : null;
                  if (code != null && mounted) {
                    setState(() => _lastCode = code);
                  }
                },
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Latest Scan',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(_lastCode),
                  const SizedBox(height: 12),
                  FilledButton.tonal(
                    onPressed: () {},
                    child: const Text('Fetch Asset Details'),
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
