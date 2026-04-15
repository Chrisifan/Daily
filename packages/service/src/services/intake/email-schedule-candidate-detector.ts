import { createHash } from "node:crypto";
import type {
  DetectEmailScheduleCandidateInput,
  ExternalScheduleCandidate,
} from "./external-schedule-candidate.js";

const SCHEDULE_HINT_RE =
  /\b(会议|日程|提醒|截止|预约|meeting|calendar|invite|appointment|deadline)\b/i;

function buildStableCandidateId(parts: Array<string | undefined>): string {
  const digest = createHash("sha1")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex");

  return `esc_${digest}`;
}

export function detectEmailScheduleCandidate(
  input: DetectEmailScheduleCandidateInput
): ExternalScheduleCandidate | null {
  const firstIcs = input.icsEvents?.[0];

  if (firstIcs?.start) {
    const endAt = firstIcs.end ?? new Date(firstIcs.start.getTime() + 60 * 60 * 1000);
    const title = firstIcs.summary?.trim() || input.subject?.trim() || "New Schedule";

    return {
      id: buildStableCandidateId([
        "email",
        input.accountId,
        input.messageId,
        firstIcs.uid,
        title,
        firstIcs.start.toISOString(),
        endAt.toISOString(),
      ]),
      source: "email",
      sourceAccountId: input.accountId,
      sourceEventId: firstIcs.uid,
      sourceMessageId: input.messageId,
      title,
      startAt: firstIcs.start.toISOString(),
      endAt: endAt.toISOString(),
      timezone: firstIcs.timezone || "UTC",
      location: firstIcs.location,
      notes: firstIcs.description,
      attendees: firstIcs.attendees ?? [],
      confidence: 0.95,
      rawPayload: {
        kind: "ics",
        subject: input.subject ?? null,
        sentAt: input.sentAt,
      },
      status: "pending",
    };
  }

  const body = [input.subject, input.bodyText, input.bodyHtml]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");

  if (!body || !SCHEDULE_HINT_RE.test(body)) {
    return null;
  }

  return null;
}
