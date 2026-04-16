import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { MailSyncCursorStore } from "./mail-sync-cursor-store.js";

function createTempDbPath(name: string): string {
  return path.join(os.tmpdir(), `daily-${name}-${Date.now()}.sqlite`);
}

test("MailSyncCursorStore persists and updates per-account incremental cursors", async () => {
  const dbPath = createTempDbPath("mail-sync-cursors");
  const store = new MailSyncCursorStore({ dbPath });

  assert.equal(await store.getCursor("acc-1"), null);

  await store.upsertCursor({
    accountId: "acc-1",
    folder: "INBOX",
    uidValidity: "11",
    lastSeenUid: 42,
    lastSeenMessageId: "<msg-42@example.com>",
    lastEventAt: "2026-04-16T01:00:00.000Z",
    lastSyncedAt: "2026-04-16T01:01:00.000Z",
    updatedAt: "2026-04-16T01:01:00.000Z",
  });

  assert.equal((await store.getCursor("acc-1"))?.lastSeenUid, 42);

  await store.deleteCursor("acc-1");
  assert.equal(await store.getCursor("acc-1"), null);
  await fs.rm(dbPath, { force: true });
});
