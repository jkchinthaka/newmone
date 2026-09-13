import 'fg_models.dart';

enum FgFormOpenMode {
  vehicleOccurrence,
  dateOnly,
  roomAndDate,
}

/// Authoritative FG controlled-form metadata for mobile recorder routing.
class FgFormConfig {
  const FgFormConfig({
    required this.formCode,
    required this.slug,
    required this.title,
    required this.subtitle,
    required this.openMode,
  });

  final String formCode;
  final String slug;
  final String title;
  final String subtitle;
  final FgFormOpenMode openMode;

  String get routePrefix => '/fg/$slug';

  static const cl18 = FgFormConfig(
    formCode: 'NMS/PPU/CL/18',
    slug: 'cl18',
    title: 'CL18',
    subtitle: 'Product Dispatch Record',
    openMode: FgFormOpenMode.vehicleOccurrence,
  );

  static const cl24 = FgFormConfig(
    formCode: 'NMS/PPU/CL/24',
    slug: 'cl24',
    title: 'CL24',
    subtitle: 'Daily Cleaning Verification',
    openMode: FgFormOpenMode.dateOnly,
  );

  static const cl30 = FgFormConfig(
    formCode: kCl30FormCode,
    slug: 'cl30',
    title: 'CL30',
    subtitle: 'Inspection Record for Freezer Truck',
    openMode: FgFormOpenMode.vehicleOccurrence,
  );

  static const cl39 = FgFormConfig(
    formCode: 'NMS/PPU/CL/39',
    slug: 'cl39',
    title: 'CL39',
    subtitle: 'Product Temperature Record – Inside Cold Room',
    openMode: FgFormOpenMode.roomAndDate,
  );

  static const all = [cl18, cl24, cl30, cl39];

  static FgFormConfig? bySlug(String slug) {
    for (final c in all) {
      if (c.slug == slug) return c;
    }
    return null;
  }
}

/// Cold room keys from Django controlled form source.
const kFgColdRoomKeys = ['CR1', 'CR2'];
