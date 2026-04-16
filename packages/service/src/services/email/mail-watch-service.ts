import { EventEmitter } from "node:events";
import { ImapConnector, ConnectionState } from "./imap-connector.js";
import type { ImapConnectorConfig, EmailMessage } from "./models/email.js";
import type { MailSecretStoreLike } from "./mail-secret-store.js";
import {
  MailAccountStore,
  type MailAccountRecord,
  type MailAccountAuthStatus,
  type MailAccountSyncStatus,
} from "./mail-account-store.js";
import { MailSyncCursorStore } from "./mail-sync-cursor-store.js";
import { ExternalScheduleCandidateStore } from "../intake/external-schedule-candidate-store.js";
import { detectEmailScheduleCandidate } from "../intake/email-schedule-candidate-detector.js";
import type { ExternalScheduleCandidate } from "../intake/external-schedule-candidate.js";
import type { MailWatchEvents } from "./mail-watch-events.js";

interface MailConnectorLike extends EventEmitter {
  connect(): Promise<void>;
  authenticate(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getState(): ConnectionState;
  searchEmails(criteria: { folder?: string; limit?: number }): Promise<Array<{ uid: number; id: string }>>;
  fetchEmails(uids: number[], folder?: string): Promise<EmailMessage[]>;
}

interface MailWatchServiceOptions {
  accountStore: MailAccountStore;
  cursorStore: MailSyncCursorStore;
  candidateStore: ExternalScheduleCandidateStore;
  secretStore: Pick<MailSecretStoreLike, "getPassword">;
  events: MailWatchEvents;
  connectorFactory?: (config: ImapConnectorConfig) => MailConnectorLike;
  fallbackSyncIntervalMs?: number;
}

interface AccountWatcher {
  accountId: string;
  connector: MailConnectorLike;
  syncPromise: Promise<ExternalScheduleCandidate[]> | null;
  needsResync: boolean;
  pollTimer: ReturnType<typeof setInterval> | null;
}

export interface MailWatchStatusSnapshot {
  accountId: string;
  email: string;
  authStatus: MailAccountAuthStatus;
  syncStatus: MailAccountSyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export class MailWatchService {
  private readonly accountStore: MailAccountStore;
  private readonly cursorStore: MailSyncCursorStore;
  private readonly candidateStore: ExternalScheduleCandidateStore;
  private readonly secretStore: Pick<MailSecretStoreLike, "getPassword">;
  private readonly events: MailWatchEvents;
  private readonly connectorFactory: (config: ImapConnectorConfig) => MailConnectorLike;
  private readonly fallbackSyncIntervalMs: number;
  private readonly watchers = new Map<string, AccountWatcher>();

  constructor(options: MailWatchServiceOptions) {
    this.accountStore = options.accountStore;
    this.cursorStore = options.cursorStore;
    this.candidateStore = options.candidateStore;
    this.secretStore = options.secretStore;
    this.events = options.events;
    this.connectorFactory = options.connectorFactory ?? ((config) => new ImapConnector(config));
    this.fallbackSyncIntervalMs = options.fallbackSyncIntervalMs ?? 15000;
  }

  async start(): Promise<void> {
    const accounts = this.accountStore.listAccounts();
    for (const account of accounts) {
      await this.registerAccount(account.id);
    }
  }

  async stop(): Promise<void> {
    const disconnects = Array.from(this.watchers.values()).map(async (watcher) => {
      this.stopFallbackSyncTimer(watcher);
      await watcher.connector.disconnect().catch(() => undefined);
    });
    await Promise.all(disconnects);
    this.watchers.clear();
  }

  getStatusSnapshot(): MailWatchStatusSnapshot[] {
    return this.accountStore.listAccounts().map((account) => ({
      accountId: account.id,
      email: account.emailAddress,
      authStatus: account.authStatus,
      syncStatus: account.syncStatus,
      lastSyncedAt: account.lastSyncedAt,
      lastSyncError: account.lastSyncError,
    }));
  }

  async registerAccount(accountId: string): Promise<void> {
    if (this.watchers.has(accountId)) {
      return;
    }

    const account = this.accountStore.getAccount(accountId);
    if (!account) {
      return;
    }

    try {
      const password = await this.secretStore.getPassword(account.id);
      const connector = this.connectorFactory(this.buildConfig(account, password));
      const watcher: AccountWatcher = {
        accountId,
        connector,
        syncPromise: null,
        needsResync: false,
        pollTimer: null,
      };

      this.attachConnectorHandlers(watcher);
      this.watchers.set(accountId, watcher);
      await connector.connect();
      await connector.authenticate();
      this.startFallbackSyncTimer(watcher);
      this.updateState(account.id, {
        authStatus: "connected",
        syncStatus: "syncing",
        lastSyncError: null,
      });
      await this.syncAccountNow(account.id);
    } catch (error) {
      this.updateState(account.id, {
        authStatus: "error",
        syncStatus: "error",
        lastSyncError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async removeAccount(accountId: string): Promise<void> {
    const watcher = this.watchers.get(accountId);
    this.watchers.delete(accountId);
    this.cursorStore.deleteCursor(accountId);
    if (watcher) {
      this.stopFallbackSyncTimer(watcher);
    }
    await watcher?.connector.disconnect().catch(() => undefined);
  }

  async syncAccountNow(accountId: string): Promise<ExternalScheduleCandidate[]> {
    const watcher = this.watchers.get(accountId);
    if (!watcher) {
      await this.registerAccount(accountId);
      const registeredWatcher = this.watchers.get(accountId);
      if (!registeredWatcher) {
        return [];
      }
      if (registeredWatcher.syncPromise) {
        return registeredWatcher.syncPromise;
      }
      return [];
    }

    if (watcher.syncPromise) {
      watcher.needsResync = true;
      return watcher.syncPromise;
    }

    watcher.syncPromise = this.runIncrementalSync(watcher)
      .finally(async () => {
        watcher.syncPromise = null;
        if (watcher.needsResync) {
          watcher.needsResync = false;
          await this.syncAccountNow(accountId);
        }
      });

    return watcher.syncPromise;
  }

  private attachConnectorHandlers(watcher: AccountWatcher): void {
    watcher.connector.on("mail", () => {
      void this.syncAccountNow(watcher.accountId);
    });

    watcher.connector.on("reconnected", () => {
      this.updateState(watcher.accountId, {
        authStatus: "connected",
        syncStatus: "syncing",
        lastSyncError: null,
      });
      void this.syncAccountNow(watcher.accountId);
    });

    watcher.connector.on("error", (error: Error) => {
      this.updateState(watcher.accountId, {
        authStatus: "error",
        syncStatus: "error",
        lastSyncError: error.message,
      });
    });
  }

  private startFallbackSyncTimer(watcher: AccountWatcher): void {
    this.stopFallbackSyncTimer(watcher);
    if (this.fallbackSyncIntervalMs <= 0) {
      return;
    }

    watcher.pollTimer = setInterval(() => {
      if (!watcher.connector.isConnected()) {
        return;
      }

      void this.syncAccountNow(watcher.accountId);
    }, this.fallbackSyncIntervalMs);
  }

  private stopFallbackSyncTimer(watcher: AccountWatcher): void {
    if (watcher.pollTimer) {
      clearInterval(watcher.pollTimer);
      watcher.pollTimer = null;
    }
  }

  private async runIncrementalSync(watcher: AccountWatcher): Promise<ExternalScheduleCandidate[]> {
    const account = this.accountStore.getAccount(watcher.accountId);
    if (!account) {
      return [];
    }

    const syncedAt = new Date().toISOString();
    this.updateState(account.id, {
      authStatus: "connected",
      syncStatus: "syncing",
      lastSyncError: null,
      updatedAt: syncedAt,
    });

    try {
      const searchResults = await watcher.connector.searchEmails({ folder: "INBOX", limit: 50 });
      const cursor = this.cursorStore.getCursor(account.id);
      const newUids = searchResults
        .map((result) => result.uid)
        .filter((uid) => uid > (cursor?.lastSeenUid ?? 0))
        .sort((a, b) => a - b);

      const emails = newUids.length > 0 ? await watcher.connector.fetchEmails(newUids, "INBOX") : [];
      const candidates = emails
        .map((email) => this.detectCandidate(account.id, email))
        .filter((candidate): candidate is ExternalScheduleCandidate => candidate !== null);

      for (const candidate of candidates) {
        this.candidateStore.upsertCandidate(candidate);
      }

      const lastSeenUid = searchResults.reduce((max, current) => Math.max(max, current.uid), cursor?.lastSeenUid ?? 0);
      this.cursorStore.upsertCursor({
        accountId: account.id,
        folder: "INBOX",
        uidValidity: cursor?.uidValidity ?? null,
        lastSeenUid,
        lastSeenMessageId: emails.at(-1)?.messageId ?? cursor?.lastSeenMessageId ?? null,
        lastEventAt: syncedAt,
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt,
      });

      this.updateState(account.id, {
        authStatus: "connected",
        syncStatus: "idle",
        lastSyncedAt: syncedAt,
        lastSyncError: null,
        updatedAt: syncedAt,
      });
      this.events.publish({
        type: "account-synced",
        emittedAt: syncedAt,
        accountId: account.id,
        lastSyncedAt: syncedAt,
      });
      if (candidates.length > 0) {
        this.events.publish({
          type: "candidates-detected",
          emittedAt: syncedAt,
          accountId: account.id,
          candidateIds: candidates.map((candidate) => candidate.id),
        });
      }

      return candidates;
    } catch (error) {
      this.updateState(account.id, {
        authStatus: "error",
        syncStatus: "error",
        lastSyncError: error instanceof Error ? error.message : String(error),
        updatedAt: syncedAt,
      });
      return [];
    }
  }

  private detectCandidate(accountId: string, email: EmailMessage): ExternalScheduleCandidate | null {
    return detectEmailScheduleCandidate({
      accountId,
      messageId: email.messageId,
      subject: email.subject,
      bodyText: email.body.text,
      bodyHtml: email.body.html,
      sentAt: email.date.toISOString(),
      icsEvents: email.icsEvents?.map((event) => ({
        uid: event.uid,
        summary: event.summary,
        start: event.start,
        end: event.end,
        timezone: event.timezone,
        location: event.location,
        description: event.description,
        attendees: event.attendees?.map((attendee) => ({
          name: attendee.name,
          address: attendee.address,
        })),
      })),
    });
  }

  private updateState(
    accountId: string,
    updates: Partial<Pick<MailAccountRecord, "authStatus" | "syncStatus" | "lastSyncedAt" | "lastSyncError" | "updatedAt">>
  ): void {
    this.accountStore.updateAccountState(accountId, updates);
    const account = this.accountStore.getAccount(accountId);
    if (!account) {
      return;
    }

    this.events.publish({
      type: "account-state",
      emittedAt: updates.updatedAt ?? new Date().toISOString(),
      accountId: account.id,
      authStatus: account.authStatus,
      syncStatus: account.syncStatus,
      lastSyncedAt: account.lastSyncedAt,
      lastSyncError: account.lastSyncError,
    });
  }

  private buildConfig(account: MailAccountRecord, password: string): ImapConnectorConfig {
    return {
      host: account.imapHost,
      port: account.imapPort,
      user: account.username,
      password,
      secure: account.secure,
      connectionTimeout: 30000,
      heartbeatInterval: 300000,
      maxReconnectAttempts: 3,
      reconnectDelay: 5000,
    };
  }
}
