import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { EventEmitter } from "node:events";
import { MailAccountStore } from "./mail-account-store.js";
import { MailSyncCursorStore } from "./mail-sync-cursor-store.js";
import { MailWatchService } from "./mail-watch-service.js";
import { createMailWatchEvents } from "./mail-watch-events.js";
import type { EmailMessage, EmailSearchCriteria, ImapConnectorConfig } from "./models/email.js";
import type { MailSecretStore } from "./mail-secret-store.js";
import { ConnectionState } from "./imap-connector.js";
import { ExternalScheduleCandidateStore } from "../intake/external-schedule-candidate-store.js";

function createTempDbPath(name: string): string {
  return path.join(os.tmpdir(), `daily-${name}-${Date.now()}.sqlite`);
}

class FakeConnector extends EventEmitter {
  private connected = false;

  constructor(private emails: EmailMessage[]) {
    super();
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async authenticate(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getState(): ConnectionState {
    return this.connected ? ConnectionState.AUTHENTICATED : ConnectionState.DISCONNECTED;
  }

  async searchEmails(_criteria: EmailSearchCriteria): Promise<Array<{ uid: number; id: string }>> {
    return this.emails.map((email) => ({ uid: email.uid, id: String(email.uid) }));
  }

  async fetchEmails(uids: number[]): Promise<EmailMessage[]> {
    return this.emails.filter((email) => uids.includes(email.uid));
  }

  setEmails(emails: EmailMessage[]): void {
    this.emails = emails;
  }
}

function createFixtureEmail(): EmailMessage {
  return {
    uid: 7,
    sequenceNo: 1,
    messageId: "message-1",
    subject: "Invite",
    from: { address: "pm@example.com", name: "PM" },
    to: [],
    date: new Date("2026-04-16T03:00:00.000Z"),
    body: { text: "Please join" },
    attachments: [],
    seen: false,
    draft: false,
    answered: false,
    forwarded: false,
    hasAttachments: true,
    size: 512,
    accountId: "acc-watch",
    folder: "INBOX",
    parsedAt: "2026-04-16T03:00:00.000Z",
    icsEvents: [
      {
        uid: "event-1",
        summary: "Daily sync review",
        start: new Date("2026-04-16T04:00:00.000Z"),
        end: new Date("2026-04-16T04:30:00.000Z"),
        timezone: "UTC",
        attendees: [{ address: "pm@example.com", name: "PM" }],
      },
    ],
  };
}

test("MailWatchEvents broadcasts SSE payloads to subscribers", async () => {
  const events = createMailWatchEvents();
  const received: string[] = [];
  const unsubscribe = events.subscribe((payload) => received.push(payload));

  events.publish({
    type: "account-state",
    emittedAt: "2026-04-16T03:00:00.000Z",
    accountId: "acc-1",
    authStatus: "connected",
    syncStatus: "idle",
  });

  unsubscribe();

  assert.match(received[0] ?? "", /event: account-state/);
  assert.match(received[0] ?? "", /"accountId":"acc-1"/);
});

test("MailWatchService emits detected candidates and updates watcher state after an incremental sync", async () => {
  const dbPath = createTempDbPath("watch-service");
  const accountStore = new MailAccountStore({ dbPath });
  const cursorStore = new MailSyncCursorStore({ dbPath });
  const candidateStore = new ExternalScheduleCandidateStore({ dbPath });
  const events = createMailWatchEvents();
  const connector = new FakeConnector([createFixtureEmail()]);
  const published: string[] = [];
  const unsubscribe = events.subscribe((payload) => published.push(payload));

  await accountStore.upsertAccount({
    id: "acc-watch",
    provider: "imap",
    emailAddress: "watch@example.com",
    imapHost: "imap.example.com",
    imapPort: 993,
    username: "watch@example.com",
    secure: true,
    authStatus: "disconnected",
    syncStatus: "idle",
    lastSyncedAt: null,
    lastSyncError: null,
    scopes: [],
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
  });

  const secretStore = {
    async getPassword(): Promise<string> {
      return "password";
    },
  } as Pick<MailSecretStore, "getPassword">;

  const service = new MailWatchService({
    accountStore,
    cursorStore,
    candidateStore,
    secretStore,
    events,
    connectorFactory: (_config: ImapConnectorConfig) => connector,
  });

  await service.start();

  const snapshot = await service.getStatusSnapshot();
  const [candidate] = await candidateStore.listCandidatesBySourceAccount("acc-watch");
  const cursor = await cursorStore.getCursor("acc-watch");

  assert.equal(snapshot[0]?.syncStatus, "idle");
  assert.equal(snapshot[0]?.authStatus, "connected");
  assert.equal(candidate?.sourceEventId, "event-1");
  assert.equal(cursor?.lastSeenUid, 7);
  assert.ok(published.some((payload) => payload.includes("candidates-detected")));

  await service.stop();
  unsubscribe();
  await fs.rm(dbPath, { force: true });
});

test("MailWatchService catches up with new mail even when the connector does not emit a mail event", async () => {
  const dbPath = createTempDbPath("watch-service-fallback");
  const accountStore = new MailAccountStore({ dbPath });
  const cursorStore = new MailSyncCursorStore({ dbPath });
  const candidateStore = new ExternalScheduleCandidateStore({ dbPath });
  const events = createMailWatchEvents();
  const connector = new FakeConnector([]);

  await accountStore.upsertAccount({
    id: "acc-watch",
    provider: "imap",
    emailAddress: "watch@example.com",
    imapHost: "imap.example.com",
    imapPort: 993,
    username: "watch@example.com",
    secure: true,
    authStatus: "disconnected",
    syncStatus: "idle",
    lastSyncedAt: null,
    lastSyncError: null,
    scopes: [],
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
  });

  const secretStore = {
    async getPassword(): Promise<string> {
      return "password";
    },
  } as Pick<MailSecretStore, "getPassword">;

  const service = new MailWatchService({
    accountStore,
    cursorStore,
    candidateStore,
    secretStore,
    events,
    connectorFactory: (_config: ImapConnectorConfig) => connector,
    fallbackSyncIntervalMs: 20,
  });

  await service.start();

  connector.setEmails([createFixtureEmail()]);

  await new Promise((resolve) => setTimeout(resolve, 120));

  const [candidate] = await candidateStore.listCandidatesBySourceAccount("acc-watch");

  assert.equal(candidate?.sourceEventId, "event-1");

  await service.stop();
  await fs.rm(dbPath, { force: true });
});

test("MailWatchService clears auth errors after the connector reconnects", async () => {
  const dbPath = createTempDbPath("watch-service-reconnect");
  const accountStore = new MailAccountStore({ dbPath });
  const cursorStore = new MailSyncCursorStore({ dbPath });
  const candidateStore = new ExternalScheduleCandidateStore({ dbPath });
  const events = createMailWatchEvents();
  const connector = new FakeConnector([]);

  await accountStore.upsertAccount({
    id: "acc-watch",
    provider: "imap",
    emailAddress: "watch@example.com",
    imapHost: "imap.example.com",
    imapPort: 993,
    username: "watch@example.com",
    secure: true,
    authStatus: "disconnected",
    syncStatus: "idle",
    lastSyncedAt: null,
    lastSyncError: null,
    scopes: [],
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
  });

  const secretStore = {
    async getPassword(): Promise<string> {
      return "password";
    },
  } as Pick<MailSecretStore, "getPassword">;

  const service = new MailWatchService({
    accountStore,
    cursorStore,
    candidateStore,
    secretStore,
    events,
    connectorFactory: (_config: ImapConnectorConfig) => connector,
    fallbackSyncIntervalMs: 0,
  });

  await service.start();

  connector.emit("error", new Error("Not authenticated"));
  let snapshot = service.getStatusSnapshot();
  assert.equal(snapshot[0]?.authStatus, "error");
  assert.equal(snapshot[0]?.syncStatus, "error");
  assert.equal(snapshot[0]?.lastSyncError, "Not authenticated");

  connector.emit("reconnected");
  await new Promise((resolve) => setTimeout(resolve, 0));

  snapshot = service.getStatusSnapshot();
  assert.equal(snapshot[0]?.authStatus, "connected");
  assert.equal(snapshot[0]?.syncStatus, "idle");
  assert.equal(snapshot[0]?.lastSyncError, null);

  await service.stop();
  await fs.rm(dbPath, { force: true });
});
