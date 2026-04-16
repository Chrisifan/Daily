export type ThemeMode = "light" | "dark" | "system";
export type ExternalScheduleCreationMode = "automatic" | "always_remind";
export type ScheduleReminderLeadMinutes = "none" | "5" | "10" | "30";

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
  scheduleReminderLeadMinutes: ScheduleReminderLeadMinutes;
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
  scheduleReminderLeadMinutes: "none",
};

export function mergeDailySettings(
  raw: Partial<DailySettings> | null | undefined,
): DailySettings {
  return {
    ...DEFAULT_DAILY_SETTINGS,
    ...(raw ?? {}),
  };
}
