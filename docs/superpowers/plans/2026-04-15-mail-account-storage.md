# Mail Account Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move mail account metadata from the legacy JSON file into SQLite and move IMAP credentials into system secure storage with a safe one-time migration path.

**Architecture:** Keep the integrations UI talking to the existing Node service. Add a new SQLite-backed mail account store in the service package, a macOS Keychain-backed secret adapter, and a legacy JSON migration path. Update the desktop SQLite bootstrap so the real app database owns the `mail_accounts` schema.

**Tech Stack:** Node 22 `node:sqlite`, Express, Tauri desktop SQLite bootstrap in Rust, macOS Keychain via `security`, node:test with tsx.

---

### Task 1: Add failing coverage for the new mail account store

**Files:**
- Create: `packages/service/src/services/email/mail-account-store.test.ts`

- [ ] Write a failing node:test file that expects a SQLite-backed store to create the `mail_accounts` table, persist account metadata, list it back, and delete it.
- [ ] Run only the new test file and confirm it fails before implementation.

### Task 2: Implement SQLite-backed mail account metadata storage

**Files:**
- Create: `packages/service/src/services/email/mail-account-store.ts`

- [ ] Add a small store module built on `node:sqlite`.
- [ ] Compute the same desktop database path used by the Tauri app.
- [ ] Ensure the `mail_accounts` table and required columns exist.
- [ ] Support list, get by id, get by email, upsert, delete, and update sync/auth status.
- [ ] Re-run the store test and confirm it passes.

### Task 3: Add secure credential storage and legacy migration

**Files:**
- Create: `packages/service/src/services/email/mail-secret-store.ts`
- Create: `packages/service/src/services/email/mail-account-migration.ts`
- Modify: `packages/service/src/routes/email.ts`

- [ ] Add a macOS Keychain adapter around the `security` CLI.
- [ ] Add a migration utility that imports legacy `config/mail-accounts.json` into SQLite plus Keychain and renames the JSON file to a backup.
- [ ] Update the email routes to stop reading/writing JSON directly and use the new store plus secret adapter.
- [ ] Keep the API response shape compatible with the frontend.

### Task 4: Align desktop schema with the real runtime database

**Files:**
- Modify: `packages/desktop/src/lib.rs`
- Modify: `packages/web/src/storage/db/schema.sql`

- [ ] Ensure the runtime desktop SQLite bootstrap creates the `mail_accounts` table with the new columns.
- [ ] Keep the schema document aligned with the actual runtime shape so docs and storage are not drifting.

### Task 5: Verify and clean up

**Files:**
- Modify: `packages/service/src/routes/email.ts`
- Modify: `packages/service/config/mail-accounts.json` if migration backup handling requires fixture cleanup

- [ ] Run the new service test file.
- [ ] Run `pnpm --filter @daily/service build`.
- [ ] Run `pnpm --filter @daily/web build` if shared types or UI contracts changed.
- [ ] Sanity-check that no route still writes mail account credentials into JSON.
