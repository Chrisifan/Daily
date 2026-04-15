import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sun, Moon, Monitor, Palette, Globe, Calendar, Clock, MapPin, Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DailySettings, ThemeMode } from "../services/settingsService";
import {
  DEFAULT_DAILY_SETTINGS,
  DEFAULT_THEME_MODE,
  getStoredSettings,
  setDailySettings,
  setThemeSetting,
} from "../services/settingsService";
import { CitySelector, TimeSelectField } from "./SettingsFields";
import { SegmentedControl } from "./SegmentedControl";
import { queueToastAfterReload, useToast } from "./ToastProvider";
import { isRoutineRangeValid } from "../utils/routineTime";

interface SettingsPopupProps {
  open: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

interface SettingItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "", icon: <Sun className="w-4 h-4" /> },
  { value: "dark", label: "", icon: <Moon className="w-4 h-4" /> },
  { value: "system", label: "", icon: <Monitor className="w-4 h-4" /> },
];

export function SettingsPopup({ open, onClose, themeMode, onThemeChange }: SettingsPopupProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [draftTheme, setDraftTheme] = useState<ThemeMode>(themeMode);
  const [draftSettings, setDraftSettings] = useState<DailySettings>(() => getStoredSettings());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftTheme(themeMode);
    setDraftSettings(getStoredSettings());
    setIsSaving(false);
  }, [open, themeMode]);

  const updateDraftSettings = useCallback((patch: Partial<DailySettings>) => {
    setDraftSettings((current) => ({ ...current, ...patch }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        setDailySettings(draftSettings),
        setThemeSetting(draftTheme),
      ]);
      onThemeChange(draftTheme);
      i18n.changeLanguage(draftSettings.language);
      queueToastAfterReload({ tone: "success", title: t("feedback.settingsSaved") });
      onClose();
      window.location.reload();
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(t("feedback.settingsSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [draftSettings, draftTheme, i18n, onClose, onThemeChange, t, toast]);

  const handleResetToDefaults = useCallback(() => {
    setDraftTheme(DEFAULT_THEME_MODE);
    setDraftSettings(DEFAULT_DAILY_SETTINGS);
  }, []);

  const routineValid = isRoutineRangeValid(draftSettings.routineStartTime, draftSettings.routineEndTime);
  const hasChanges =
    draftTheme !== themeMode ||
    JSON.stringify(draftSettings) !== JSON.stringify(getStoredSettings());

  const sections: SettingSection[] = [
    {
      title: "appearance",
      items: [
        {
          id: "theme",
          label: t("settings.theme"),
          description: t("settings.themeDesc"),
          icon: <Palette className="w-4 h-4" />,
          action: (
            <SegmentedControl
              value={draftTheme}
              onChange={(nextValue) => setDraftTheme(nextValue as ThemeMode)}
              options={THEME_OPTIONS.map((opt) => ({
                value: opt.value,
                label: t(`settings.themeOptions.${opt.value}`),
                icon: opt.icon,
              }))}
            />
          ),
        },
      ],
    },
    {
      title: "internationalization",
      items: [
        {
          id: "language",
          label: t("settings.language"),
          description: t("settings.languageDesc"),
          icon: <Globe className="w-4 h-4" />,
          action: (
            <SegmentedControl
              value={draftSettings.language}
              onChange={(val) => {
                updateDraftSettings({ language: val as "zh" | "en" });
              }}
              options={[
                { value: "zh", label: t("settings.languages.zh") },
                { value: "en", label: t("settings.languages.en") },
              ]}
            />
          ),
        },
        {
          id: "dateFormat",
          label: t("settings.dateFormat"),
          description: t("settings.dateFormatDesc"),
          icon: <Calendar className="w-4 h-4" />,
          action: (
            <SegmentedControl
              value={draftSettings.dateFormat}
              onChange={(val) => {
                updateDraftSettings({ dateFormat: val as "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY" });
              }}
              options={[
                { value: "YYYY-MM-DD", label: t("settings.formats.YYYY-MM-DD") },
                { value: "MM/DD/YYYY", label: t("settings.formats.MM/DD/YYYY") },
                { value: "DD/MM/YYYY", label: t("settings.formats.DD/MM/YYYY") },
              ]}
            />
          ),
        },
        {
          id: "timeFormat",
          label: t("settings.timeFormat"),
          description: t("settings.timeFormatDesc"),
          icon: <Clock className="w-4 h-4" />,
          action: (
            <SegmentedControl
              value={draftSettings.timeFormat}
              onChange={(val) => {
                updateDraftSettings({ timeFormat: val as "HH:mm" | "hh:mm A" });
              }}
              options={[
                { value: "HH:mm", label: t("settings.formats.HH:mm") },
                { value: "hh:mm A", label: t("settings.formats.hh:mm A") },
              ]}
            />
          ),
        },
      ],
    },
    {
      title: "location",
      items: [
        {
          id: "city",
          label: t("settings.city"),
          description: t("settings.cityDesc"),
          icon: <MapPin className="w-4 h-4" />,
          action: <CitySelector value={draftSettings} onChange={updateDraftSettings} />,
        },
      ],
    },
    {
      title: "routine",
      items: [
        {
          id: "routine",
          label: t("settings.routineWindow"),
          description: t("settings.routineWindowDesc"),
          icon: <Clock className="w-4 h-4" />,
          action: (
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-muted)" }}>
                  {t("settings.routineStart")}
                </p>
                <TimeSelectField
                  value={draftSettings.routineStartTime}
                  onChange={(value) => updateDraftSettings({ routineStartTime: value })}
                  displayFormat={draftSettings.timeFormat}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-muted)" }}>
                  {t("settings.routineEnd")}
                </p>
                <TimeSelectField
                  value={draftSettings.routineEndTime}
                  onChange={(value) => updateDraftSettings({ routineEndTime: value })}
                  displayFormat={draftSettings.timeFormat}
                  treatMidnightAsEndOfDay
                />
              </div>
              {!routineValid && (
                <p className="text-xs col-span-2" style={{ color: "var(--color-error)" }}>
                  {t("settings.routineValidation")}
                </p>
              )}
            </div>
          ),
        },
      ],
    },
    {
      title: "messagesAndNotifications",
      items: [
        {
          id: "externalScheduleCreationMode",
          label: t("settings.externalScheduleCreationMode"),
          description: t("settings.externalScheduleCreationModeDesc"),
          icon: <Bell className="w-4 h-4" />,
          action: (
            <SegmentedControl
              value={draftSettings.externalScheduleCreationMode}
              onChange={(val) => {
                updateDraftSettings({
                  externalScheduleCreationMode: val as "automatic" | "always_remind",
                });
              }}
              options={[
                { value: "automatic", label: t("settings.externalScheduleModes.automatic") },
                { value: "always_remind", label: t("settings.externalScheduleModes.alwaysRemind") },
              ]}
            />
          ),
        },
      ],
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-[480px] rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-xl)",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                {t("settings.title")}
              </h2>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--color-text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-border-light)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-6" style={{ paddingBottom: 16 }}>
              {sections.map((section) => (
                <section key={section.title} className="space-y-3">
                  <h3
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] px-1"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t(`settings.${section.title}`)}
                  </h3>
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      backgroundColor: "var(--color-border-light)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {section.items.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 p-4"
                        style={{
                          borderTop: index === 0 ? "none" : "1px solid var(--color-border)",
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.icon && (
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{
                                backgroundColor: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                              }}
                            >
                              {item.icon}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-row pt-1">
                          {item.action}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <button
                onClick={handleResetToDefaults}
                disabled={isSaving}
                className="h-8 rounded-lg px-3 text-sm font-medium transition-colors"
                style={{
                  color: "var(--color-text-secondary)",
                  backgroundColor: "var(--color-border-light)",
                  opacity: isSaving ? 0.6 : 1,
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                {t("settings.resetToDefaults")}
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {t("settings.saveHint")}
                </span>
                <button
                  onClick={() => { void handleSave(); }}
                  disabled={!hasChanges || isSaving || !routineValid}
                  className="h-8 rounded-lg px-4 text-sm font-medium transition-colors"
                  style={{
                    color: "white",
                    backgroundColor: !hasChanges || isSaving || !routineValid ? "var(--color-text-muted)" : "var(--color-primary)",
                    cursor: !hasChanges || isSaving || !routineValid ? "not-allowed" : "pointer",
                  }}
                >
                  {isSaving ? t("settings.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
