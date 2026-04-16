import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import i18n from "../../i18n";
import { TodayTasks } from "./TodayTasks";
import type { ScheduleItem } from "../../domain/schedule/types";

function createSchedule(partial: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: partial.id ?? "schedule-1",
    source: partial.source ?? "manual",
    title: partial.title ?? "Daily sync",
    icon: partial.icon ?? "clock",
    startAt: partial.startAt ?? "2026-04-16T10:00:00Z",
    timezone: partial.timezone ?? "UTC",
    durationMinutes: partial.durationMinutes ?? 30,
    repeatMode: partial.repeatMode ?? "none",
    repeatGroupId: partial.repeatGroupId,
    location: partial.location,
    attendees: partial.attendees,
    notes: partial.notes,
    workspaceId: partial.workspaceId,
    priority: partial.priority ?? "medium",
    preparationMinutes: partial.preparationMinutes,
    travelMinutes: partial.travelMinutes,
    isFlexible: partial.isFlexible ?? false,
    completedAt: partial.completedAt,
    createdAt: partial.createdAt ?? "2026-04-16T08:00:00Z",
    updatedAt: partial.updatedAt ?? "2026-04-16T08:00:00Z",
  };
}

test("TodayTasks renders completed schedules with completed-state classes", async () => {
  await i18n.changeLanguage("zh");

  const markup = renderToStaticMarkup(
    <TodayTasks
      schedules={[
        createSchedule({
          id: "schedule-done",
          title: "已完成日程",
          completedAt: "2026-04-16T09:30:00Z",
        }),
      ]}
      workspaces={[]}
    />
  );

  assert.match(markup, /task-row--completed/);
  assert.match(markup, /task-text--completed/);
  assert.match(markup, /task-meta--completed/);
  assert.match(markup, /已完成日程/);
});
