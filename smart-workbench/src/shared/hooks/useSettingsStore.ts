import { useState, useEffect, useCallback } from "react";
import {
  type ThemeMode,
  getThemeSetting,
  setThemeSetting,
  getResolvedTheme,
} from "../services/settingsService";

export interface UseSettingsStore {
  themeMode: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => Promise<void>;
}

export function useSettingsStore(): UseSettingsStore {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    getThemeSetting().then((theme) => {
      setThemeMode(theme);
      setResolvedTheme(getResolvedTheme(theme));
    });
  }, []);

  useEffect(() => {
    if (themeMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [themeMode]);

  const setTheme = useCallback(async (theme: ThemeMode) => {
    setThemeMode(theme);
    setResolvedTheme(getResolvedTheme(theme));
    await setThemeSetting(theme);
  }, []);

  return {
    themeMode,
    resolvedTheme,
    setTheme,
  };
}