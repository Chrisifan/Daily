# Mail Account Storage Design

**Date:** 2026-04-15

## Goal

Replace the legacy JSON-based mail account storage with the app database for account metadata and with system secure storage for IMAP credentials.

## Current Problem

- Email account metadata is currently stored in `packages/service/config/mail-accounts.json`.
- IMAP credentials are only Base64-obfuscated, which is reversible and not secure.
- The JSON file can be committed accidentally and already sits outside the app's actual SQLite-backed architecture.

## Target Design

### Metadata Storage

Persist mail account metadata in the app's SQLite database in a dedicated `mail_accounts` table.

Stored metadata includes:

- `id`
- `provider`
- `email_address`
- `imap_host`
- `imap_port`
- `username`
- `secure`
- `display_name`
- `auth_status`
- `sync_status`
- `last_synced_at`
- `scopes`
- `created_at`
- `updated_at`

### Secret Storage

Store IMAP passwords in the operating system secure store instead of JSON or SQLite.

For the current macOS-first desktop app, use the macOS Keychain through the `security` CLI from the service layer. The keychain entry will be derived from the mail account id so the secret can be loaded during sync without exposing it to the renderer or persisting it in app data files.

### Service Access Pattern

Keep the current frontend-to-service API shape for integrations.

- Frontend continues calling `packages/service/src/routes/email.ts`
- Service reads and writes account metadata directly from the desktop SQLite database
- Service reads and writes secrets through the macOS Keychain

This keeps the IMAP logic inside the service package and avoids moving mail sync into the frontend or duplicating connector logic.

## Migration

On first access to the mail account store:

1. Ensure the `mail_accounts` table exists and has the required columns.
2. If legacy `config/mail-accounts.json` exists, read all accounts from it.
3. Upsert metadata into SQLite.
4. Decode the legacy Base64 value and store it in the macOS Keychain.
5. Rename the legacy JSON file to a timestamped backup so the migration is recoverable and not re-run forever.

The migration should be idempotent: if the database entry already exists, metadata can be refreshed safely without duplicating rows.

## Error Handling

- If SQLite is unavailable, email account routes should fail clearly and not silently recreate JSON storage.
- If keychain writes fail, account creation must fail rather than saving metadata without a usable secret.
- If keychain reads fail during sync, the route should return a clear authentication/storage error.
- Migration should stop and report if any account cannot be moved safely.

## Testing

Add focused tests for:

- creating and listing mail account metadata in SQLite
- deleting metadata from SQLite
- migrating legacy JSON account records into SQLite metadata

Keychain operations should be isolated behind a thin adapter so route and migration logic can be tested without using the real system keychain in unit tests.
