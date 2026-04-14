# Workspace List Redesign Design

**Goal:** Redesign the workspace list page so text is readable on the light theme and the page feels like a focused project workbench instead of a translucent glass gallery.

## Context

The current workspace list page uses semi-transparent glass cards and `text-white/*` utilities on top of a light application background. That combination causes low contrast and makes the page feel visually disconnected from the rest of the product, especially the updated home dashboard.

## Design Direction

Use a light, solid-surface "project panel" style:

- Keep the app-wide light background and shared tokens from `App.css`
- Replace glassmorphism with solid cards, clear borders, and soft layered shadows
- Use strong dark text for all primary content and neutral secondary text for supporting details
- Treat each workspace as a compact project panel with explicit sections for identity, status, summary, and metrics

## Layout

- Header area:
  - Left: page title and short supporting subtitle
  - Right: primary action button for creating a workspace
- Summary strip:
  - Show lightweight page-level counts to make the page feel operational, not empty
- Workspace grid:
  - Use a regular responsive grid
  - Each workspace card keeps the same size rhythm and consistent spacing
- Create card:
  - Keep as a first-class action card in the same grid, but style it as a deliberate dashed panel rather than an empty placeholder

## Card Structure

Each workspace card should contain:

1. Identity row
   - Type icon in a tinted surface
   - Status pill
   - Optional overflow button
2. Workspace name and description
3. Smart summary block or fallback description block
4. Metrics row
   - Focus count
   - Goal count
   - Link count
5. Footer action hint
   - Small text cue that the card is enterable/openable

## Styling Rules

- Use shared theme variables from `packages/web/src/App.css`
- Avoid `text-white/*` on this page in light mode
- Use the workspace color only as an accent for icon tiles, soft badges, and subtle emphasis
- Keep cards compact and dense enough to feel like a workbench, not a marketing page

## Success Criteria

- All main text is readable on the default light theme
- The page matches the visual language of the home page better than the current glass version
- Cards feel more like project management surfaces with clearer information hierarchy
