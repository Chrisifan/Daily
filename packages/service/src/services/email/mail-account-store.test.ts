import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { MailAccountStore } from "./mail-account-store.js";

function createTempDbPath(name: string): string {
  return path.join(os.tmpdir(), `daily-${name}-${Date.now()}.sqlite`);
}

test("MailAccountStore persists and lists mail account metadata in SQLite", async () => {
  const dbPath = createTempDbPath("mail-account-store");
  const store = new MailAccountStore({ dbPath });

  await store.upsertAccount({
    id: "acc-1",
    provider: "imap",
    emailAddress: "alice@example.com",
    imapHost: "imap.example.com",
    imapPort: 993,
    username: "alice@example.com",
    secure: true,
    displayName: "Alice",
    authStatus: "connected",
    syncStatus: "idle",
    lastSyncedAt: "2026-04-15T10:00:00.000Z",
    scopes: [],
    createdAt: "2026-04-15T09:00:00.000Z",
    updatedAt: "2026-04-15T10:00:00.000Z",
  });

  const accounts = await store.listAccounts();

  assert.equal(accounts.length, 1);
  assert.equal(accounts[0]?.emailAddress, "alice@example.com");
  assert.equal(accounts[0]?.displayName, "Alice");
  assert.equal(accounts[0]?.imapHost, "imap.example.com");

  await fs.rm(dbPath, { force: true });
});

test("MailAccountStore deletes mail account metadata from SQLite", async () => {
  const dbPath = createTempDbPath("mail-account-delete");
  const store = new MailAccountStore({ dbPath });

  await store.upsertAccount({
    id: "acc-2",
    provider: "imap",
    emailAddress: "bob@example.com",
    imapHost: "imap.example.com",
    imapPort: 993,
    username: "bob@example.com",
    secure: true,
    displayName: "Bob",
    authStatus: "connected",
    syncStatus: "idle",
    lastSyncedAt: null,
    scopes: [],
    createdAt: "2026-04-15T09:00:00.000Z",
    updatedAt: "2026-04-15T10:00:00.000Z",
  });

  await store.deleteAccount("acc-2");

  const accounts = await store.listAccounts();
  assert.deepEqual(accounts, []);

  await fs.rm(dbPath, { force: true });
});
