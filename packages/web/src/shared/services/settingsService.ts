import { invoke } from "@tauri-apps/api/core";

const SETTINGS_KEY_THEME = "theme";
const SETTINGS_KEY_DAILY = "daily-settings";
const SETTINGS_KEY_ONBOARDING = "daily-onboarding-completed";
const STORAGE_KEY = "daily-settings";
const ONBOARDING_STORAGE_KEY = "daily-onboarding-completed";

export type ThemeMode = "light" | "dark" | "system";
export type ExternalScheduleCreationMode = "automatic" | "always_remind";

export interface DailySettings {
  language: "zh" | "en";
  dateFormat: "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY";
  timeFormat: "HH:mm" | "hh:mm A";
  locationCity: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  routineStartTime: string;
  routineEndTime: string;
  externalScheduleCreationMode: ExternalScheduleCreationMode;
}

export const DEFAULT_THEME_MODE: ThemeMode = "system";

export const DEFAULT_DAILY_SETTINGS: DailySettings = {
  language: "zh",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "HH:mm",
  locationCity: null,
  locationLatitude: null,
  locationLongitude: null,
  routineStartTime: "08:00",
  routineEndTime: "22:00",
  externalScheduleCreationMode: "automatic",
};

let cachedSettings: DailySettings = DEFAULT_DAILY_SETTINGS;
let settingsInitialized = false;
let cachedOnboardingCompleted = false;
let onboardingInitialized = false;

export async function initSettings(): Promise<void> {
  try {
    const [settingsRaw, onboardingRaw] = await Promise.all([
      getSetting(SETTINGS_KEY_DAILY),
      getSetting(SETTINGS_KEY_ONBOARDING),
    ]);

    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      cachedSettings = { ...DEFAULT_DAILY_SETTINGS, ...parsed };
    }

    if (onboardingRaw) {
      cachedOnboardingCompleted = onboardingRaw === "true";
    }

    settingsInitialized = true;
    onboardingInitialized = true;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
      localStorage.setItem(ONBOARDING_STORAGE_KEY, cachedOnboardingCompleted ? "true" : "false");
    } catch {
      // localStorage not available
    }
  } catch (e) {
    console.error("Failed to init settings:", e);
    settingsInitialized = true;
    onboardingInitialized = true;
  }
}

export function getStoredSettings(): DailySettings {
  if (!settingsInitialized) {
    return cachedSettings;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_DAILY_SETTINGS, ...JSON.parse(raw) } : cachedSettings;
  } catch {
    return cachedSettings;
  }
}

export function hasCompletedOnboarding(): boolean {
  if (!onboardingInitialized) {
    return cachedOnboardingCompleted;
  }
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (raw === null) {
      return cachedOnboardingCompleted;
    }
    return raw === "true";
  } catch {
    return cachedOnboardingCompleted;
  }
}

export async function setCompletedOnboarding(value: boolean): Promise<void> {
  cachedOnboardingCompleted = value;
  onboardingInitialized = true;
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, value ? "true" : "false");
  } catch {
    // localStorage not available
  }
  try {
    await setSetting(SETTINGS_KEY_ONBOARDING, value ? "true" : "false");
  } catch (e) {
    console.error("Failed to save onboarding state:", e);
  }
}

export async function storeSettingsPartial(patch: Partial<DailySettings>): Promise<void> {
  const current = getStoredSettings();
  const updated = { ...current, ...patch };
  cachedSettings = updated;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage not available
  }
  try {
    await setSetting(SETTINGS_KEY_DAILY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save settings to DB:", e);
  }
}

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

export async function getDailySettings(): Promise<DailySettings> {
  try {
    const raw = await getSetting(SETTINGS_KEY_DAILY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_DAILY_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_DAILY_SETTINGS;
}

export async function setDailySettings(settings: DailySettings): Promise<void> {
  cachedSettings = settings;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage not available
  }
  await setSetting(SETTINGS_KEY_DAILY, JSON.stringify(settings));
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
