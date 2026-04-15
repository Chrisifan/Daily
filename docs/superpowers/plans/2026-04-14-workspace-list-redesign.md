# Workspace List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax here because the redesign has already been implemented and this file now documents the completed plan against the current project structure.

**Goal:** Rebuild the workspace list page into a readable, compact, light-theme workspace list that matches the current `packages/web` structure and visual language.

**Architecture:** Keep the route and data flow inside `packages/web`, remove glass-card dependence from the page, and use page-specific classes in `packages/web/src/App.css` to produce a minimal, solid-surface workspace list.

**Tech Stack:** React 19, TypeScript, Vite, shared CSS variables in `packages/web/src/App.css`, react-router-dom, lucide-react

---

### Task 1: Rebuild the page structure

**Files:**
- Modify: `packages/web/src/features/workspace/WorkspaceListPage.tsx`

- [x] Replace the glass-card layout with a dedicated page shell.
- [x] Keep a single header-level primary action (`New Workspace`).
- [x] Render a responsive grid of minimal workspace cards.
- [x] Remove the previously explored summary strip and in-grid create card.

### Task 2: Align the page with the current design system

**Files:**
- Modify: `packages/web/src/App.css`

- [x] Add workspace list page classes under the shared global stylesheet.
- [x] Use shared radius, spacing, border, and color tokens.
- [x] Replace low-contrast glass styling with solid light surfaces.
- [x] Compress card height and internal spacing to keep the page lightweight.

### Task 3: Refresh copy to match the simplified layout

**Files:**
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [x] Add page strings needed by the redesigned header and cards.
- [x] Keep copy concise and compatible with the simplified card structure.

### Task 4: Verify

**Files:**
- Modify: none

- [x] Run: `pnpm --filter @daily/web build`
- [x] Confirm the page no longer depends on low-contrast white-on-light styling.
- [x] Confirm the current structure matches:
  - header action only
  - minimal card body
  - no summary strip
  - no create card in the grid
