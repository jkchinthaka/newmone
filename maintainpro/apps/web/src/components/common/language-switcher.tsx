import { useTranslation } from "react-i18next";

import { useUiStore } from "@/store/ui.store";

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      {(["en", "es"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            language === lang ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => {
            setLanguage(lang);
            void i18n.changeLanguage(lang);
          }}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
