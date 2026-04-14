# Workspace List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the workspace list page into a readable, light-theme project workbench with solid cards and stronger information hierarchy.

**Architecture:** Keep the page within the existing route and data flow, but replace the current glass-card presentation with a page-specific layout and CSS class system in `App.css`. Reuse existing mock workspace data and route structure while moving the page toward the same surface and spacing language used on the home dashboard.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, shared CSS variables in `packages/web/src/App.css`, framer-motion where already present

---

### Task 1: Replace the current page structure

**Files:**
- Modify: `packages/web/src/features/workspace/WorkspaceListPage.tsx`

- [ ] **Step 1: Rebuild the page scaffold**

Create a dedicated page shell with:
- a header row
- a compact summary strip
- a responsive grid of workspace cards
- a styled create-new card

- [ ] **Step 2: Remove glass-card dependence from this page**

Stop using `GlassCard` in the workspace list so this screen can follow the product’s light-surface dashboard language.

- [ ] **Step 3: Add card-level derived data**

Derive simple per-card metrics such as linked resource count and whether a summary exists so the UI can show consistent metadata blocks.

### Task 2: Add page-specific styling

**Files:**
- Modify: `packages/web/src/App.css`

- [ ] **Step 1: Add workspace list page classes**

Add classes for:
- page wrapper
- header
- summary strip
- grid
- workspace card
- create card
- metric cells
- footer hint

- [ ] **Step 2: Use shared tokens**

Ensure all colors, surfaces, borders, spacing, and radii use existing theme variables instead of page-local hardcoded light/dark utility values.

- [ ] **Step 3: Keep cards compact**

Tune vertical spacing and card min-height so the page reads like a workbench instead of an oversized gallery.

### Task 3: Refresh copy where needed

**Files:**
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [ ] **Step 1: Add any missing page strings**

Add concise strings for the summary strip, action hints, and any new labels introduced by the redesigned layout.

### Task 4: Verify

**Files:**
- Modify: none

- [ ] **Step 1: Run the build**

Run: `pnpm --filter @daily/web build`

Expected: Vite production build succeeds without TypeScript errors.

- [ ] **Step 2: Review the resulting page visually in code**

Check that:
- no text still uses low-contrast white-on-light styling
- cards have clear section hierarchy
- the create-new panel matches the size and rhythm of the grid
