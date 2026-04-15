import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Calendar, Clock, RotateCcw } from "lucide-react";
import { GlassCard } from "../../shared/ui/GlassCard";
import { SegmentedControl } from "../../shared/ui/SegmentedControl";
import {
  DEFAULT_DAILY_SETTINGS,
  getStoredSettings,
  setDailySettings,
  storeSettingsPartial,
} from "../../shared/services/settingsService";
import type { DailySettings } from "../../shared/services/settingsService";
import { queueToastAfterReload, useToast } from "../../shared/ui/ToastProvider";

const DEFAULT_SETTINGS: DailySettings = DEFAULT_DAILY_SETTINGS;

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const settings = useMemo(() => getStoredSettings(), []);

  useMemo(() => {
    i18n.changeLanguage(settings.language);
  }, [settings.language, i18n]);

  const handleSettingChange = useCallback(async (key: keyof DailySettings, value: string) => {
    const newValue = key === "language" 
      ? value as "zh" | "en"
      : key === "dateFormat" 
        ? value as "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY"
        : value as "HH:mm" | "hh:mm A";

    const newSettings = { ...settings, [key]: newValue };
    await storeSettingsPartial(newSettings);

    if (key === "language") {
      i18n.changeLanguage(newValue);
    }

    setShowRestartPrompt(true);
  }, [settings, i18n]);

  const handleResetToDefaults = useCallback(async () => {
    setIsResetting(true);
    try {
      await setDailySettings(DEFAULT_SETTINGS);
      i18n.changeLanguage(DEFAULT_SETTINGS.language);
      queueToastAfterReload({ tone: "success", title: t("feedback.settingsReset") });
      window.location.reload();
    } catch (error) {
      console.error("Failed to reset settings:", error);
      toast.error(t("feedback.settingsResetFailed"));
    } finally {
      setIsResetting(false);
    }
  }, [i18n, t, toast]);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 0 24px" }}>
      {showRestartPrompt && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            background: "var(--color-warning-alpha)",
            border: "1px solid var(--color-warning)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <p style={{ fontSize: 13, color: "var(--color-warning)", flex: 1 }}>
            {t("settings.restartPrompt")}
          </p>
          <button
            onClick={() => setShowRestartPrompt(false)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              background: "var(--color-warning)",
              color: "white",
            }}
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <p className="panel-eyebrow">{t("settings.title")}</p>
        <h1 className="panel-title" style={{ fontSize: 26 }}>{t("settings.internationalization")}</h1>
      </div>

      <GlassCard className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

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
            <SegmentedControl
              value={settings.language}
              onChange={(val) => handleSettingChange("language", val)}
              options={[
                { value: "zh", label: t("settings.languages.zh") },
                { value: "en", label: t("settings.languages.en") },
              ]}
            />
          </div>

          <div style={{ height: 1, background: "var(--color-border)" }} />

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
            <SegmentedControl
              value={settings.dateFormat}
              onChange={(val) => handleSettingChange("dateFormat", val)}
              options={[
                { value: "YYYY-MM-DD", label: t("settings.formats.YYYY-MM-DD") },
                { value: "MM/DD/YYYY", label: t("settings.formats.MM/DD/YYYY") },
                { value: "DD/MM/YYYY", label: t("settings.formats.DD/MM/YYYY") },
              ]}
            />
          </div>

          <div style={{ height: 1, background: "var(--color-border)" }} />

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
            <SegmentedControl
              value={settings.timeFormat}
              onChange={(val) => handleSettingChange("timeFormat", val)}
              options={[
                { value: "HH:mm", label: t("settings.formats.HH:mm") },
                { value: "hh:mm A", label: t("settings.formats.hh:mm A") },
              ]}
            />
          </div>

          <div style={{ height: 1, background: "var(--color-border)" }} />

          <button
            onClick={handleResetToDefaults}
            disabled={isResetting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 32,
              padding: "0 16px",
              borderRadius: 10,
              border: "1px solid var(--color-border)",
              cursor: isResetting ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 500,
              background: "transparent",
              color: "var(--color-text-secondary)",
              opacity: isResetting ? 0.6 : 1,
              transition: "all 180ms ease",
            }}
            onMouseOver={(e) => {
              if (!isResetting) {
                e.currentTarget.style.background = "var(--color-border-light)";
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <RotateCcw className="w-4 h-4" />
            {isResetting ? t("common.processing") : t("settings.resetToDefaults")}
          </button>

        </div>
      </GlassCard>
    </div>
  );
}
