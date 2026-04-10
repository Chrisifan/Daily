import { useTranslation } from "react-i18next";
import { Globe, Calendar, Clock } from "lucide-react";
import { GlassCard } from "../../shared/ui/GlassCard";

const STORAGE_KEY = "daily-settings";

export interface DailySettings {
  language: "zh" | "en";
  dateFormat: "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY";
  timeFormat: "HH:mm" | "hh:mm A";
}

export function getStoredSettings(): DailySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const defaultSettings: DailySettings = {
      language: "zh",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "HH:mm",
    };
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return { language: "zh", dateFormat: "YYYY-MM-DD", timeFormat: "HH:mm" };
  }
}

export function storeSettingsPartial(patch: Partial<DailySettings>): void {
  try {
    const current = getStoredSettings();
    const updated = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();

  const settings = getStoredSettings();

  const handleLanguageChange = (lang: string) => {
    const newLang = lang as "zh" | "en";
    storeSettingsPartial({ language: newLang });
    i18n.changeLanguage(newLang);
  };

  const handleDateFormatChange = (format: string) => {
    storeSettingsPartial({ dateFormat: format as DailySettings["dateFormat"] });
  };

  const handleTimeFormatChange = (format: string) => {
    storeSettingsPartial({ timeFormat: format as DailySettings["timeFormat"] });
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 0 24px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <p className="panel-eyebrow">{t("settings.title")}</p>
        <h1 className="panel-title" style={{ fontSize: 26 }}>{t("settings.internationalization")}</h1>
      </div>

      <GlassCard className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Language */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--color-primary-alpha)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-primary)",
                }}
              >
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                  {t("settings.language")}
                </p>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {t("settings.languageDesc")}
                </p>
              </div>
            </div>
            <RadioGroup
              value={settings.language}
              onChange={handleLanguageChange}
              options={[
                { value: "zh", label: t("settings.languages.zh") },
                { value: "en", label: t("settings.languages.en") },
              ]}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--color-border)" }} />

          {/* Date Format */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--color-primary-alpha)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-primary)",
                }}
              >
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                  {t("settings.dateFormat")}
                </p>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {t("settings.dateFormatDesc")}
                </p>
              </div>
            </div>
            <RadioGroup
              value={settings.dateFormat}
              onChange={handleDateFormatChange}
              options={[
                { value: "YYYY-MM-DD", label: t("settings.formats.YYYY-MM-DD") },
                { value: "MM/DD/YYYY", label: t("settings.formats.MM/DD/YYYY") },
                { value: "DD/MM/YYYY", label: t("settings.formats.DD/MM/YYYY") },
              ]}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--color-border)" }} />

          {/* Time Format */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--color-primary-alpha)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-primary)",
                }}
              >
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                  {t("settings.timeFormat")}
                </p>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {t("settings.timeFormatDesc")}
                </p>
              </div>
            </div>
            <RadioGroup
              value={settings.timeFormat}
              onChange={handleTimeFormatChange}
              options={[
                { value: "HH:mm", label: t("settings.formats.HH:mm") },
                { value: "hh:mm A", label: t("settings.formats.hh:mm A") },
              ]}
            />
          </div>

        </div>
      </GlassCard>
    </div>
  );
}

// ==================== RadioGroup ====================

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
}

function RadioGroup({ value, onChange, options }: RadioGroupProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 6,
        padding: "4px",
        borderRadius: 12,
        background: "var(--color-border-light)",
        border: "1px solid var(--color-border)",
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 180ms ease",
              background: selected ? "var(--color-primary)" : "transparent",
              color: selected ? "white" : "var(--color-text-secondary)",
              boxShadow: selected ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
