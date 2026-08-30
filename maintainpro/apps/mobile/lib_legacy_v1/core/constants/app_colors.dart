import 'package:flutter/material.dart';

/// Brand color tokens. Single source of truth for the entire app.
class AppColors {
  AppColors._();

  // Brand
  static const Color primary = Color(0xFF0F766E); // Teal 700
  static const Color primaryLight = Color(0xFF14B8A6); // Teal 500
  static const Color primaryDark = Color(0xFF0D9488); // Teal 600
  static const Color secondary = Color(0xFF6366F1); // Indigo 500

  // Surfaces
  static const Color surface = Color(0xFF111827);
  static const Color card = Color(0xFF1F2937);
  static const Color border = Color(0xFF374151);
  static const Color borderLight = Color(0xFF4B5563);

  // Text
  static const Color textPrimary = Color(0xFFF9FAFB);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textMuted = Color(0xFF6B7280);

  // Semantic
  static const Color error = Color(0xFFEF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color success = Color(0xFF10B981);
  static const Color info = Color(0xFF3B82F6);

  // Status
  static const Color statusOpen = Color(0xFF3B82F6);
  static const Color statusInProgress = Color(0xFFF59E0B);
  static const Color statusCompleted = Color(0xFF10B981);
  static const Color statusCancelled = Color(0xFF6B7280);
  static const Color statusOverdue = Color(0xFFDC2626);
  static const Color statusOnHold = Color(0xFF8B5CF6);

  // Priority
  static const Color priorityCritical = Color(0xFFEF4444);
  static const Color priorityHigh = Color(0xFFF97316);
  static const Color priorityMedium = Color(0xFFEAB308);
  static const Color priorityLow = Color(0xFF6B7280);

  // Gradients
  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
  );

  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primary, primaryLight],
  );

  static Color statusColor(String? status) {
    switch ((status ?? '').toUpperCase()) {
      case 'OPEN':
        return statusOpen;
      case 'IN_PROGRESS':
        return statusInProgress;
      case 'COMPLETED':
      case 'APPROVED':
      case 'RECEIVED':
      case 'PAID':
      case 'RESOLVED':
      case 'ACTIVE':
      case 'OPERATIONAL':
        return statusCompleted;
      case 'CANCELLED':
      case 'CLOSED':
      case 'RETIRED':
      case 'DISPOSED':
        return statusCancelled;
      case 'OVERDUE':
      case 'REJECTED':
      case 'MISSED':
      case 'OUT_OF_SERVICE':
      case 'BROKEN':
        return statusOverdue;
      case 'ON_HOLD':
      case 'PENDING':
      case 'PENDING_VERIFICATION':
      case 'PENDING_APPROVAL':
      case 'SUBMITTED':
      case 'STARTED':
      case 'MAINTENANCE':
      case 'UNDER_REPAIR':
        return statusOnHold;
      default:
        return statusCancelled;
    }
  }

  static Color priorityColor(String? priority) {
    switch ((priority ?? '').toUpperCase()) {
      case 'CRITICAL':
        return priorityCritical;
      case 'HIGH':
        return priorityHigh;
      case 'MEDIUM':
        return priorityMedium;
      case 'LOW':
      default:
        return priorityLow;
    }
  }
}
