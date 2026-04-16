import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DAILY_SETTINGS,
  mergeDailySettings,
} from "./settings-model";

test("DEFAULT_DAILY_SETTINGS disables schedule advance reminders by default", () => {
  assert.equal(DEFAULT_DAILY_SETTINGS.scheduleReminderLeadMinutes, "none");
});

test("mergeDailySettings keeps the new reminder field when persisted settings are partial", () => {
  const merged = mergeDailySettings({
    language: "en",
    externalScheduleCreationMode: "always_remind",
  });

  assert.equal(merged.language, "en");
  assert.equal(merged.externalScheduleCreationMode, "always_remind");
  assert.equal(merged.scheduleReminderLeadMinutes, "none");
});

test("mergeDailySettings accepts a persisted reminder lead-time override", () => {
  const merged = mergeDailySettings({
    scheduleReminderLeadMinutes: "10",
  });

  assert.equal(merged.scheduleReminderLeadMinutes, "10");
});
