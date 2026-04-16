import test from "node:test";
import assert from "node:assert/strict";
import { getSystemCalendarViewState } from "./system-calendar-view-state";

test("unsupported platform keeps system calendar card disabled", () => {
  const state = getSystemCalendarViewState({
    available: false,
    authStatus: "disconnected",
    syncStatus: "idle",
    lastSyncedAt: null,
    lastSyncError: null,
  });

  assert.equal(state.badgeTone, "neutral");
  assert.equal(state.statusLabelKey, "integrations.systemCalendar.unavailableStatus");
  assert.equal(state.connectEnabled, false);
  assert.equal(state.syncEnabled, false);
});

test("disconnected macOS state enables connect action", () => {
  const state = getSystemCalendarViewState({
    available: true,
    authStatus: "disconnected",
    syncStatus: "idle",
    lastSyncedAt: null,
    lastSyncError: null,
  });

  assert.equal(state.badgeTone, "warning");
  assert.equal(state.statusLabelKey, "integrations.systemCalendar.disconnectedStatus");
  assert.equal(state.connectEnabled, true);
  assert.equal(state.syncEnabled, false);
  assert.equal(state.actionKey, "integrations.systemCalendar.connectAction");
});

test("syncing and error states expose the correct badges and helper copy", () => {
  const syncing = getSystemCalendarViewState({
    available: true,
    authStatus: "connected",
    syncStatus: "syncing",
    lastSyncedAt: null,
    lastSyncError: null,
  });

  assert.equal(syncing.badgeTone, "warning");
  assert.equal(syncing.statusLabelKey, "integrations.systemCalendar.syncingStatus");
  assert.equal(syncing.syncEnabled, false);

  const errored = getSystemCalendarViewState({
    available: true,
    authStatus: "connected",
    syncStatus: "error",
    lastSyncedAt: null,
    lastSyncError: "Permission denied",
  });

  assert.equal(errored.badgeTone, "error");
  assert.equal(errored.statusLabelKey, "integrations.systemCalendar.errorStatus");
  assert.equal(errored.helperTextKey, "integrations.systemCalendar.errorDescription");
  assert.equal(errored.showErrorText, true);
});
