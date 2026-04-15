import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { MailAccountStore } from "./mail-account-store.js";
import { migrateLegacyMailAccounts } from "./mail-account-migration.js";

function tempPath(name: string): string {
  return path.join(os.tmpdir(), `daily-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
}

test("migrateLegacyMailAccounts moves JSON metadata into SQLite and stores decoded secrets", async () => {
  const dbPath = tempPath("mail-accounts.sqlite");
  const configPath = tempPath("mail-accounts.json");
  const store = new MailAccountStore({ dbPath });
  const capturedSecrets = new Map<string, string>();

  await fs.writeFile(
    configPath,
    JSON.stringify({
      version: "1.0",
      accounts: [
        {
          id: "acc-legacy",
          email: "legacy@example.com",
          imapHost: "imap.example.com",
          imapPort: 993,
          username: "legacy@example.com",
          passwordObfuscated: Buffer.from("app-password").toString("base64"),
          secure: true,
          displayName: "Legacy",
          createdAt: "2026-04-15T09:00:00.000Z",
          lastSyncedAt: "2026-04-15T10:00:00.000Z",
        },
      ],
    }),
    "utf8"
  );

  const result = await migrateLegacyMailAccounts({
    configPath,
    store,
    secretStore: {
      async setPassword(accountId: string, password: string) {
        capturedSecrets.set(accountId, password);
      },
    },
  });

  const accounts = store.listAccounts();

  assert.equal(result.migratedCount, 1);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0]?.emailAddress, "legacy@example.com");
  assert.equal(capturedSecrets.get("acc-legacy"), "app-password");
  assert.equal(await fs.access(configPath).then(() => true).catch(() => false), false);
  assert.ok(result.backupPath);
  assert.equal(await fs.access(result.backupPath!).then(() => true).catch(() => false), true);

  await fs.rm(dbPath, { force: true });
  await fs.rm(result.backupPath!, { force: true });
});
