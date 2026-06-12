/**
 * UI copy language readiness (English default).
 * Full Sinhala/Tamil catalogs are deferred; add per-feature message maps here later.
 */

export const DEFAULT_UI_LANGUAGE = "en" as const;

export const SUPPORTED_UI_LANGUAGES = ["en", "si", "ta"] as const;

export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

export const UI_LANGUAGE_LABELS: Record<UiLanguage, string> = {
  en: "English",
  si: "Sinhala",
  ta: "Tamil"
};

export const LOCALIZATION_READINESS_NOTE =
  "MaintainPro uses English UI copy with Sri Lanka formatting defaults (en-LK, Asia/Colombo, LKR). Future Sinhala/Tamil UI text should load from per-language message catalogs without changing API payloads.";
