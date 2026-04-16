import { parseISO, subMinutes } from "date-fns";
import type { ScheduleItem } from "../../domain/schedule/types";
import type { ScheduleReminderLeadMinutes } from "./settings-model";

export interface ScheduleReminderCandidate {
  scheduleId: string;
  title: string;
  startAt: string;
  remindAt: string;
  location?: string;
  leadMinutes: number;
}

export interface ScheduleReminderSelection {
  dueNow: ScheduleReminderCandidate[];
  nextUp: ScheduleReminderCandidate | null;
}

export function parseReminderLeadMinutes(
  lead: ScheduleReminderLeadMinutes,
): number | null {
  if (lead === "none") {
    return null;
  }

  const value = Number(lead);
  return Number.isFinite(value) ? value : null;
}

export function buildReminderCandidates(
  schedules: ScheduleItem[],
  lead: ScheduleReminderLeadMinutes,
  now: Date,
): ScheduleReminderCandidate[] {
  const leadMinutes = parseReminderLeadMinutes(lead);
  if (leadMinutes === null) {
    return [];
  }

  return schedules.reduce<ScheduleReminderCandidate[]>((candidates, schedule) => {
      const startAtDate = parseISO(schedule.startAt);
      if (startAtDate <= now) {
        return candidates;
      }

      const remindAtDate = subMinutes(startAtDate, leadMinutes);

      candidates.push({
        scheduleId: schedule.id,
        title: schedule.title,
        startAt: startAtDate.toISOString(),
        remindAt: remindAtDate.toISOString(),
        location: schedule.location,
        leadMinutes,
      });

      return candidates;
    }, []).sort((a, b) => a.remindAt.localeCompare(b.remindAt));
}

export function findDueAndUpcomingReminderCandidates(
  candidates: ScheduleReminderCandidate[],
  now: Date,
): ScheduleReminderSelection {
  const nowIso = now.toISOString();
  const dueNow: ScheduleReminderCandidate[] = [];
  let nextUp: ScheduleReminderCandidate | null = null;

  for (const candidate of candidates) {
    if (candidate.startAt <= nowIso) {
      continue;
    }

    if (candidate.remindAt <= nowIso) {
      dueNow.push(candidate);
      continue;
    }

    nextUp = candidate;
    break;
  }

  return { dueNow, nextUp };
}
