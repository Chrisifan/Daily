# Operable Code And Image Workbench Showcase Design

**Date:** 2026-04-18

## Goal

Redesign the showcase for Daily's smart workbench concept so the code workbench and image workbench feel like real operable tools, not dashboard-style overview pages.

After this change:

- `代码工作台` looks and behaves like an AI-native coding environment
- `图片工作台` looks and behaves like an AI-native image editing environment
- both pages use high-fidelity interactive mock behavior
- the showcase demonstrates editable work surfaces, not only context summaries

## Correction To Previous Direction

The earlier interpretation was too passive.

It treated the workbenches as:

- context dashboards
- recommendation boards
- smart overview panels

That is not the intended product direction.

The intended direction is:

- a **code workbench** where users feel they can read, edit, run, preview, and delegate coding tasks
- an **image workbench** where users feel they can select layers, edit a canvas, use AI tools, and export deliverables

This spec supersedes the earlier dashboard-oriented showcase direction.

## Product Reference Frame

### Code Workbench

The code workbench should feel closer to:

- Cursor
- GitHub Copilot agent mode inside an IDE
- Replit Workspace

The center of gravity is:

- file navigation
- editor
- terminal / run output
- preview
- AI task rail

### Image Workbench

The image workbench should feel like a hybrid:

- core editing skeleton from Photoshop / Photopea
- plus template, batch export, and deliverable framing from Canva / Figma

The center of gravity is:

- canvas
- layers / assets
- inspector
- AI editing actions
- export queue

## Chosen Direction

Use a **tool-first studio** layout for both workbenches.

Shared structure:

- left rail for resources and navigation
- large central work surface
- bottom or lower area for execution/history/output
- right rail for AI and inspector controls

Key principle:

The user must immediately understand **where the work happens**.

The workbench is not a board that talks about work.
The workbench is the place where work appears to be done.

## Information Architecture

### 1. `showcase/index.html`

Keep this as a simple prototype launcher.

It should link to:

- `智能工作台入口`
- `代码工作台`
- `图片工作台`

No heavy storytelling is needed here.

### 2. `showcase/workspaces.html`

Repurpose this page into a light launcher page for the two operable workbenches.

It should:

- frame Daily as an intelligent launcher into specialized work surfaces
- present large entry cards for:
  - code workbench
  - image workbench
- retain only minimal context framing such as:
  - current focus
  - linked sources
  - why Daily routed the user here

This page should not look like the main product experience.
It should look like a launchpad.

### 3. `showcase/code-workbench.html`

This is one of the two core showcase pages.

It should be a high-fidelity static mock of a coding environment.

### 4. `showcase/image-workbench.html`

This is the other core showcase page.

It should be a high-fidelity static mock of an image editing environment.

## Code Workbench Design

### Main Layout

The code workbench should use a four-zone layout:

1. **Left rail**
   - file tree
   - symbol/search
   - git changes
   - PR / issue shortcuts

2. **Center main surface**
   - code editor as the primary focus
   - tab bar for open files
   - optional side preview or split preview

3. **Lower execution zone**
   - terminal
   - test output
   - runtime logs

4. **Right rail**
   - AI agent task flow
   - selected-code explanation
   - suggested patch / apply action
   - context summary
   - pre-commit or review checklist

### Page Modules

The page should include:

- top context strip:
  - workspace/project name
  - branch
  - current task
  - run / preview actions
- realistic editor content
- preview panel for component/UI output
- terminal/log region
- AI side panel with concrete task suggestions

### Interaction Model

The code page should support fake but convincing interactions:

- switching files changes editor content
- switching tabs changes preview or terminal context
- clicking AI actions updates assistant state
- clicking run/test buttons updates output panels

No real code execution is required in this iteration.

## Image Workbench Design

### Main Layout

The image workbench should use a parallel four-zone layout:

1. **Left rail**
   - assets
   - templates
   - layers
   - history

2. **Center main surface**
   - primary canvas
   - optional selected variant panel
   - top bar for zoom, before/after, export

3. **Lower execution/output zone**
   - version comparison
   - export queue
   - batch output status

4. **Right rail**
   - AI edit tools
   - selection properties
   - feedback grouping
   - export specification advice
   - delivery risk summary

### Page Modules

The page should include:

- top context strip:
  - batch name
  - current template/variant
  - due time
  - export action
- large central canvas
- visible layer and asset management
- batch export presence
- AI editing actions such as:
  - remove background
  - erase object
  - expand fill
  - apply style change

### Interaction Model

The image page should support fake but convincing interactions:

- selecting a layer changes property state
- selecting a template changes the visible canvas frame
- clicking AI actions changes status and result messaging
- clicking export actions changes the queue/output strip

No real image processing is required in this iteration.

## Shared Visual Principles

Both workbenches should feel like the same product family, but not like the same page with different labels.

### Shared traits

- premium glass-and-surface aesthetic already used by the showcase
- large rounded panels
- dense but clean interface rhythm
- strong sense of “main surface vs support surfaces”
- clear emphasis on AI assistance without making AI the only focal point

### Code page character

- cooler palette
- tighter structure
- darker editor core
- more technical density

### Image page character

- warmer palette
- brighter canvas zone
- stronger material contrast between canvas and surrounding controls
- visible delivery/export framing

## Fidelity Target

This should be a **high-fidelity interactive showcase**, not a production implementation.

Meaning:

- realistic UI composition
- believable state changes
- strong visual hierarchy
- rich static content
- lightweight fake interactions in vanilla JS

But not:

- real Monaco editor
- real terminal
- real image editing engine
- real layer compositing
- real AI integration

The test is:

If someone clicks around for 20 seconds, they should believe they are exploring an unfinished but real product.

## Scope

### In Scope

- redesign `showcase/workspaces.html` into a launcher-style entry
- rebuild `showcase/code-workbench.html` as an operable coding tool mock
- rebuild `showcase/image-workbench.html` as an operable image tool mock
- update shared CSS and page-local JS to support high-fidelity interactivity
- add or update lightweight tests for shared render helpers if still useful

### Out Of Scope

- any React implementation in `packages/web`
- real code execution
- real filesystem access
- real git integration
- real canvas/image manipulation
- real export pipeline
- real AI requests

## Files To Change

- `showcase/index.html`
- `showcase/workspaces.html`
- `showcase/workspaces.js`
- `showcase/code-workbench.html`
- `showcase/code-workbench.js`
- `showcase/image-workbench.html`
- `showcase/image-workbench.js`
- `showcase/styles.css`
- `showcase/workbench-shared.js`
- `showcase/workbench-render.test.mjs`

## Acceptance Criteria

This design is complete when:

- the launcher page clearly routes users into code vs image workbenches
- the code page visually reads as a real coding environment
- the image page visually reads as a real image editing environment
- both pages have obvious primary work surfaces
- AI is integrated as a useful side capability, not the entire page
- fake interactions reinforce operability rather than dashboard browsing

## Risks And Guardrails

### Risk: Still feels like a dashboard

Guardrail:

- every page must have one unmistakable central work surface
- side panels must support the surface, not replace it

### Risk: Overpromising real implementation

Guardrail:

- keep interaction scope clearly fake but plausible
- avoid controls that imply precise low-level editing unless the UI can visually support the illusion

### Risk: Code and image pages feel too similar

Guardrail:

- preserve the same structural language
- differentiate the center surface, left-rail vocabulary, right-rail tools, and palette

## Resolved Decisions

- code workbench uses a true IDE-style skeleton
- image workbench uses a Photoshop/Photopea-inspired skeleton with Canva/Figma-style template and batch-export framing
- this iteration is a high-fidelity showcase, not a real editor implementation
- `workspaces.html` becomes a launchpad, not a dashboard
