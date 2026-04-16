import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { ExternalScheduleCandidateStore } from "./external-schedule-candidate-store.js";

function createTempDbPath(name: string): string {
  return path.join(os.tmpdir(), `daily-${name}-${Date.now()}.sqlite`);
}

test("ExternalScheduleCandidateStore preserves status while adding delivery metadata", async () => {
  const dbPath = createTempDbPath("candidate-store");
  const store = new ExternalScheduleCandidateStore({ dbPath });

  await store.upsertCandidate({
    id: "email:acc-1:event-1",
    source: "email",
    sourceAccountId: "acc-1",
    sourceEventId: "event-1",
    sourceMessageId: "message-1",
    title: "Demo",
    startAt: "2026-04-16T02:00:00.000Z",
    endAt: "2026-04-16T02:30:00.000Z",
    timezone: "UTC",
    attendees: [],
    confidence: 0.95,
    rawPayload: {},
    status: "pending",
  });
  await store.markNotified("email:acc-1:event-1", "2026-04-16T02:05:00.000Z");
  await store.updateStatus("email:acc-1:event-1", "accepted");
  await store.upsertCandidate({
    id: "email:acc-1:event-1",
    source: "email",
    sourceAccountId: "acc-1",
    sourceEventId: "event-1",
    sourceMessageId: "message-1",
    title: "Demo updated",
    startAt: "2026-04-16T02:00:00.000Z",
    endAt: "2026-04-16T02:30:00.000Z",
    timezone: "UTC",
    attendees: [],
    confidence: 0.98,
    rawPayload: { version: 2 },
    status: "pending",
  });

  const candidate = await store.getCandidate("email:acc-1:event-1");

  assert.equal(candidate?.status, "accepted");
  assert.equal(candidate?.notifiedAt, "2026-04-16T02:05:00.000Z");
  assert.equal(candidate?.title, "Demo updated");
  await fs.rm(dbPath, { force: true });
});
