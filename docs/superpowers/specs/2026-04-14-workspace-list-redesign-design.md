# Workspace List Redesign Design

**Goal:** Keep the workspace list page readable, lightweight, and aligned with the current `packages/web` light-surface design language.

## Context

The original workspace list implementation used translucent glass cards and `text-white/*` utilities, which no longer matched the app's light background and made content hard to read. A heavier intermediate redesign introduced summary strips, dense metrics, and a create card, but the current product direction has since been simplified.

## Current Direction

The current workspace list page should follow a minimal workbench-card approach:

- solid light cards instead of glassmorphism
- strong text contrast
- compact card height
- low visual noise
- one clear primary action in the page header

## Layout

- Header:
  - left: title and short subtitle
  - right: `New Workspace` primary button
- Grid:
  - responsive grid of existing workspaces
  - no page-level summary strip
  - no dedicated create card inside the grid

## Card Structure

Each workspace card contains only:

1. Type icon tile
2. Workspace title
3. Short description
4. Two lightweight badges:
   - workspace type
   - workspace status

The card should remain enterable/clickable, but this affordance should come from the card container and hover state, not from extra footer hints.

## Styling Rules

- Use shared tokens from `packages/web/src/App.css`
- Keep the accent color tied to the workspace color
- Avoid extra metric blocks, summary panels, or dense dashboard treatment
- Prefer compact spacing over rich information density

## Success Criteria

- Text is readable in the default light theme
- The page feels simpler than the previous redesign iteration
- The header button is the only primary create action
- The grid reads as a clean workspace list, not a dashboard
