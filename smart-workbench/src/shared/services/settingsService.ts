import { invoke } from "@tauri-apps/api/core";

const SETTINGS_KEY_THEME = "theme";

export type ThemeMode = "light" | "dark" | "system";

export async function getSetting(key: string): Promise<string | null> {
  try {
    return await invoke<string | null>("get_setting", { key });
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await invoke("set_setting", { key, value });
}

export async function getThemeSetting(): Promise<ThemeMode> {
  const value = await getSetting(SETTINGS_KEY_THEME);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export async function setThemeSetting(theme: ThemeMode): Promise<void> {
  await setSetting(SETTINGS_KEY_THEME, theme);
}

export function resolveSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function getResolvedTheme(themeMode: ThemeMode): "light" | "dark" {
  if (themeMode === "system") {
    return resolveSystemTheme();
  }
  return themeMode;
}