# Async Action Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared toast-based feedback system and apply it to the app's major async action buttons so loading, success, and failure states are consistent.

**Architecture:** Keep button-level loading state local to each feature, but route success and failure acknowledgements through a shared toast provider mounted near the app shell. Update documentation and major flows together so the new behavior is both implemented and codified.

**Tech Stack:** React 19, TypeScript, i18next, Tauri web frontend, shared UI components, node:test with tsx for lightweight unit coverage.

---

## File Map

### New files

- `packages/web/src/shared/ui/ToastProvider.tsx`
- `packages/web/src/shared/ui/toast-state.test.ts`

### Modified files

- `AGENTS.md`
- `docs/design-doc.md`
- `docs/technical-design.md`
- `packages/web/src/App.tsx`
- `packages/web/src/App.css`
- `packages/web/src/features/integrations/IntegrationsPage.tsx`
- `packages/web/src/features/onboarding/StartupSplash.tsx`
- `packages/web/src/features/schedule/SchedulePage.tsx`
- `packages/web/src/features/schedule/ScheduleModal.tsx`
- `packages/web/src/shared/hooks/useExternalScheduleIntake.ts`
- `packages/web/src/shared/ui/SettingsPopup.tsx`
- `packages/web/src/shared/ui/ExternalScheduleReviewDialog.tsx`
- `packages/web/src/locales/zh.json`
- `packages/web/src/locales/en.json`

## Task 1: Document the new async action feedback constraint

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/design-doc.md`
- Modify: `docs/technical-design.md`

- [ ] Add the new constraint that all async action buttons must provide loading, success, and failure feedback.
- [ ] Explicitly define global toast as the default success/failure surface and button-level loading as the required in-place state.
- [ ] Keep the wording aligned with the existing constraints about modal forms and delete confirmations.

## Task 2: Introduce a shared toast feedback system

**Files:**
- Create: `packages/web/src/shared/ui/ToastProvider.tsx`
- Create: `packages/web/src/shared/ui/toast-state.test.ts`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/App.css`

- [ ] Write a failing lightweight test for toast state behavior:
  - enqueue adds a toast
  - dismiss removes a toast by id
  - generated ids remain stable enough for queue use
- [ ] Run the toast-state test and verify it fails before implementation.
- [ ] Implement a minimal toast provider with:
  - `success`, `error`, and `info` helpers
  - fixed viewport rendering
  - auto-dismiss timer
  - manual dismiss support
- [ ] Mount the provider around the app router and add shared toast styles in `App.css`.
- [ ] Run the toast-state test again and verify it passes.

## Task 3: Apply toast feedback to settings and onboarding

**Files:**
- Modify: `packages/web/src/shared/ui/SettingsPopup.tsx`
- Modify: `packages/web/src/features/onboarding/StartupSplash.tsx`
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [ ] Keep the existing save/loading button states.
- [ ] On success, show a success toast before close/reload.
- [ ] On failure, show an error toast and keep the current surface open.
- [ ] Add concise localized copy for these actions.

## Task 4: Apply toast feedback to schedule flows

**Files:**
- Modify: `packages/web/src/features/schedule/SchedulePage.tsx`
- Modify: `packages/web/src/features/schedule/ScheduleModal.tsx`
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [ ] Keep existing submit/delete loading states in schedule flows.
- [ ] Add success toasts for create, update, and delete.
- [ ] Add failure toasts for create, update, and delete errors.
- [ ] Preserve inline validation or submit error messaging where it already helps.

## Task 5: Apply toast feedback to integrations and external intake review

**Files:**
- Modify: `packages/web/src/features/integrations/IntegrationsPage.tsx`
- Modify: `packages/web/src/shared/hooks/useExternalScheduleIntake.ts`
- Modify: `packages/web/src/shared/ui/ExternalScheduleReviewDialog.tsx`
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [ ] Keep existing button-level loading for test/save/sync/delete/review actions.
- [ ] Add success toasts for:
  - test connection success
  - save account success
  - sync account success
  - delete account success
  - external schedule sync success
  - external schedule dismiss success
- [ ] Add failure toasts for the same actions.
- [ ] Keep useful inline error content in integrations where recovery guidance is helpful.

## Task 6: Verify the rollout

**Files:**
- No new files

- [ ] Run the toast-state test.
- [ ] Run `pnpm --filter @daily/web build`.
- [ ] Sanity-check affected async flows for duplicate-click protection and visible feedback behavior.
