import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sun, Moon, Monitor, Palette } from "lucide-react";
import type { ThemeMode } from "../services/settingsService";

interface SettingsPopupProps {
  open: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onThemeChange: (theme: ThemeMode) => Promise<void>;
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
  { value: "light", label: "浅色", icon: <Sun className="w-4 h-4" /> },
  { value: "dark", label: "深色", icon: <Moon className="w-4 h-4" /> },
  { value: "system", label: "跟随系统", icon: <Monitor className="w-4 h-4" /> },
];

export function SettingsPopup({ open, onClose, themeMode, onThemeChange }: SettingsPopupProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(themeMode);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, onClose]);

  const handleThemeSelect = useCallback(async (theme: ThemeMode) => {
    setSelectedTheme(theme);
    await onThemeChange(theme);
  }, [onThemeChange]);

  const sections: SettingSection[] = [
    {
      title: "外观",
      items: [
        {
          id: "theme",
          label: "主题",
          description: "选择应用的主题模式",
          icon: <Palette className="w-4 h-4" />,
          action: (
            <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--color-border-light)" }}>
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleThemeSelect(opt.value)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: selectedTheme === opt.value ? "var(--color-primary)" : "transparent",
                    color: selectedTheme === opt.value ? "white" : "var(--color-text-secondary)",
                  }}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
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
            onClick={onClose}
          />
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-[520px] rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <h2 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
                设置
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--color-text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-border-light)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {sections.map((section) => (
                <div key={section.title}>
                  <h3
                    className="text-xs font-medium uppercase tracking-wider mb-3"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {section.title}
                  </h3>
                  <div className="space-y-3">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 p-4 rounded-xl"
                        style={{ backgroundColor: "var(--color-border-light)" }}
                      >
                        <div className="flex items-center gap-3">
                          {item.icon && (
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: "var(--color-surface)" }}
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
                        <div className="flex flex-row">
                          {item.action}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}