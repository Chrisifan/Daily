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
    lastSyncError: null,
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
    lastSyncError: null,
    scopes: [],
    createdAt: "2026-04-15T09:00:00.000Z",
    updatedAt: "2026-04-15T10:00:00.000Z",
  });

  await store.deleteAccount("acc-2");

  const accounts = await store.listAccounts();
  assert.deepEqual(accounts, []);

  await fs.rm(dbPath, { force: true });
});

test("MailAccountStore persists background sync errors", async () => {
  const dbPath = createTempDbPath("mail-account-state");
  const store = new MailAccountStore({ dbPath });

  await store.upsertAccount({
    id: "acc-error",
    provider: "imap",
    emailAddress: "watch@example.com",
    imapHost: "imap.example.com",
    imapPort: 993,
    username: "watch@example.com",
    secure: true,
    displayName: "Watcher",
    authStatus: "error",
    syncStatus: "error",
    lastSyncedAt: null,
    lastSyncError: "socket timeout",
    scopes: [],
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
  });

  const account = await store.getAccount("acc-error");

  assert.equal(account?.lastSyncError, "socket timeout");
  await fs.rm(dbPath, { force: true });
});
