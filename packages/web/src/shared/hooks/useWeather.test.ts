import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWeatherQueryKey,
  type WeatherQueryKey,
} from "./useWeather";
import type { DailySettings } from "../services/settingsService";

function createSettings(partial: Partial<DailySettings>): DailySettings {
  return {
    language: partial.language ?? "zh",
    dateFormat: partial.dateFormat ?? "YYYY-MM-DD",
    timeFormat: partial.timeFormat ?? "HH:mm",
    locationCity: partial.locationCity ?? null,
    locationLatitude: partial.locationLatitude ?? null,
    locationLongitude: partial.locationLongitude ?? null,
    routineStartTime: partial.routineStartTime ?? "08:00",
    routineEndTime: partial.routineEndTime ?? "22:00",
    externalScheduleCreationMode: partial.externalScheduleCreationMode ?? "automatic",
    scheduleReminderLeadMinutes: partial.scheduleReminderLeadMinutes ?? "none",
  };
}

test("buildWeatherQueryKey changes when stored weather location changes", () => {
  const shanghaiKey = buildWeatherQueryKey(
    "zh",
    createSettings({
      locationCity: "上海",
      locationLatitude: 31.2304,
      locationLongitude: 121.4737,
    }),
  );
  const hangzhouKey = buildWeatherQueryKey(
    "zh",
    createSettings({
      locationCity: "杭州",
      locationLatitude: 30.2741,
      locationLongitude: 120.1551,
    }),
  );

  assert.notDeepEqual(shanghaiKey, hangzhouKey);
});

test("buildWeatherQueryKey keeps weather cache stable for the same location", () => {
  const settings = createSettings({
    locationCity: "杭州",
    locationLatitude: 30.2741,
    locationLongitude: 120.1551,
  });

  const firstKey: WeatherQueryKey = buildWeatherQueryKey("zh", settings);
  const secondKey: WeatherQueryKey = buildWeatherQueryKey("zh", settings);

  assert.deepEqual(firstKey, secondKey);
});
