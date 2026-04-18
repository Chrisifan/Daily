# Code And Image Workbench Showcase Design

**Date:** 2026-04-18

## Goal

Create a showcase-level prototype for Daily's smart workbench concept, starting with two vertical workbench types:

- code workbench
- image workbench

This iteration should make the concept legible in static prototype form before we wire it into the real product.

After this change:

- the showcase index explicitly advertises the two new workbench experiences
- the workspace showcase becomes a smart workbench overview rather than a generic workspace list
- Daily has two dedicated showcase pages:
  - `code-workbench.html`
  - `image-workbench.html`
- all three showcase surfaces share one visual system and one demo-data model

## Current Problem

The repository already has the beginnings of the concept, but it is still too generic to explain what a smart workbench actually is.

Today:

- `showcase/workspaces.html` only presents workspace types, a simple active list, and one generic detail panel
- `showcase/workspaces.js` already mentions `代码` and `图片处理`, but only as template cards
- the web app domain already includes `WorkspaceType = "code" | "image" | "writing" | "general"`, but the showcase does not demonstrate what makes code and image work distinct

This leaves two gaps:

1. the "smart workbench" idea is visible as taxonomy, not as workflow
2. stakeholders cannot see how Daily would behave differently for coding work versus image delivery work

## Chosen Direction

Use a three-surface showcase structure:

1. **Index entry points**
   Update `showcase/index.html` so the overall prototype gallery directly links to code and image workbenches.
2. **Workbench overview**
   Upgrade `showcase/workspaces.html` into a smart workbench overview page that explains the available workbench types, active workbench cards, context sources, and recommended next actions.
3. **Dedicated workbench pages**
   Add:
   - `showcase/code-workbench.html`
   - `showcase/code-workbench.js`
   - `showcase/image-workbench.html`
   - `showcase/image-workbench.js`

This structure keeps navigation simple while showing both the product-level framing and the vertical workflow detail.

## Why This Direction

This is the smallest prototype that still communicates the actual product bet.

Compared with only enhancing `workspaces.html`, dedicated pages let us show:

- code-specific context such as branch, PR, issue, review queue, and deep-work planning
- image-specific context such as assets, feedback rounds, export specs, version comparisons, and delivery checkpoints

Compared with building a fully interactive fake app, this direction keeps the showcase maintainable and fast to iterate while still feeling concrete.

## Information Architecture

### 1. `showcase/index.html`

Keep the gallery model, but add two explicit cards:

- `代码工作台`
- `图片工作台`

The existing `工作区` card should remain, but its description should shift from generic templates to "智能工作台总览".

### 2. `showcase/workspaces.html`

Reframe this page as a workbench overview.

It should answer:

- what workbench types exist
- which workbenches are active now
- what context sources each workbench is connected to
- what Daily recommends the user do next

### 3. `showcase/code-workbench.html`

This page should feel like an operational command surface for development work.

### 4. `showcase/image-workbench.html`

This page should feel like a delivery and asset-coordination surface for image work.

## Shared Product Story

All workbench pages should communicate the same core promise:

- Daily gathers context from schedules, tasks, files, and external sources
- Daily condenses that context into a usable summary
- Daily suggests the next best action in the context of the user's time and workload

The difference between workbench types is not only styling. It is the shape of the context and the actions that matter.

## Page Design

### Workbench Overview Page

`showcase/workspaces.html` should contain these sections:

1. **Hero / framing**
   - title: smart workbench overview
   - short explanation of Daily's role
   - one compact summary strip showing active workbenches, synced sources, and pending actions

2. **Workbench type templates**
   - four type cards remain visible:
     - code
     - image
     - writing
     - general
   - code and image should receive stronger visual emphasis than writing/general
   - each card should list:
     - ideal tasks
     - connected sources
     - output style

3. **Active workbench list**
   - replace plain rows with richer cards
   - each card should include:
     - name
     - type
     - current focus
     - linked sources
     - a progress or readiness metric
     - CTA to open the workbench

4. **Context sources panel**
   - show a compact matrix of available context:
     - mail
     - calendar
     - local files
     - tasks
     - external feedback
   - indicate which workbench uses which source most heavily

5. **Recommended next actions**
   - a short list of Daily-suggested actions across workbenches
   - examples:
     - review a PR before 15:00 sync
     - export the hero banner batch before client feedback

### Code Workbench Page

`showcase/code-workbench.html` should contain these sections:

1. **Hero**
   - project name
   - branch
   - current sprint focus
   - one AI-like summary paragraph

2. **Today's development lane**
   - primary task
   - blocked task
   - pending review
   - next available deep-work block

3. **Code context board**
   - active files
   - related issue/PR cards
   - recent commits or checkpoints
   - module or system areas being touched

4. **Time and coordination**
   - upcoming meetings
   - deadlines
   - recommended sequencing around calendar constraints

5. **Smart assistant rail**
   - recommended next step
   - reason for recommendation
   - small action chips such as:
     - start fix
     - review first
     - plan after meeting

The overall feeling should be "command center" rather than "project dashboard".

### Image Workbench Page

`showcase/image-workbench.html` should contain these sections:

1. **Hero**
   - batch name
   - delivery due time
   - asset count
   - one AI-like summary paragraph

2. **Delivery lane**
   - waiting for retouch
   - waiting for export
   - waiting for approval
   - delivered

3. **Asset context board**
   - source assets
   - export specs
   - version snapshots
   - feedback clusters

4. **Time and coordination**
   - today’s review checkpoints
   - due windows
   - client/internal stakeholders

5. **Smart assistant rail**
   - what to fix first
   - what can be grouped
   - what is most likely to block delivery

The overall feeling should be "delivery surface" rather than "gallery".

## Visual Direction

The showcase should stay within the existing static prototype language:

- glass panels
- soft atmospheric backgrounds
- large rounded surfaces
- Manrope + Noto Sans SC

But the two workbenches should diverge in personality:

### Code Workbench

- cooler blue-gray palette
- denser structure
- more compact data modules
- sharper hierarchy around queues and priorities

### Image Workbench

- warmer neutral palette with coral/apricot emphasis
- more open composition
- larger visual modules for asset/status blocks
- stronger emphasis on delivery stages and versions

## Interaction Model

This iteration stays as a static prototype with light client-side rendering.

Allowed interactions:

- clicking cards to navigate between showcase pages
- hover and selected states on pills, task rows, version rows, and suggestion cards
- purely presentational buttons such as `采纳`, `稍后处理`, `打开工作台`

Not included:

- real persistence
- modal workflows
- drag/drop
- actual state mutation
- actual AI calls

## Demo Data Model

Keep the data in page-local JS files, but use a consistent structure.

Each workbench page should define:

- hero summary data
- lane/status data
- context cards
- schedule/deadline items
- assistant recommendations

The overview page should define:

- workbench template cards
- active workbench cards
- context source matrix rows
- recommended actions

The data should look believable and specific, not placeholder-generic.

Recommended sample stories:

- code workbench:
  - project: design system upgrade
  - context: PR review, issue fix, afternoon sync, affected files
- image workbench:
  - project: campaign export batch
  - context: retouch queue, export presets, client comments, approval deadline

## Implementation Boundaries

This spec only covers `showcase/`.

It does **not** include:

- routing changes in `packages/web`
- new React pages
- real workspace persistence
- real connector integration
- schema or domain model changes

The purpose of this iteration is to validate product framing and page composition first.

## Files To Change

Expected file work:

- update `showcase/index.html`
- update `showcase/workspaces.html`
- update `showcase/workspaces.js`
- update `showcase/styles.css`
- add `showcase/code-workbench.html`
- add `showcase/code-workbench.js`
- add `showcase/image-workbench.html`
- add `showcase/image-workbench.js`

Optional:

- small updates to `showcase/showcase.js` if shared data/helpers become useful

## Acceptance Criteria

This design is complete when:

- the showcase home page visibly links to code and image workbench pages
- the workspaces page clearly reads as a smart workbench overview
- code and image workbench pages each have distinct structure and visual tone
- the three pages feel like one product family
- the content makes Daily's "context + recommendation + time awareness" story obvious without explanation from the presenter

## Risks And Guardrails

### Risk: Generic dashboard feel

If every section becomes a generic metrics card, the smart workbench concept disappears.

Guardrail:

- every module must answer either:
  - what context is loaded
  - what the user should do next
  - what time constraint matters now

### Risk: Code and image pages look too similar

Guardrail:

- keep layout rhythm similar
- change module content, palette emphasis, and visual density enough that the pages are distinguishable at a glance

### Risk: Too much fake interactivity

Guardrail:

- prefer rich static composition over complex mock behaviors
- if an interaction does not clarify the product story, do not add it

## Open Questions Resolved

The following product choices are fixed for this prototype:

- both the overview page and dedicated workbench pages will be built
- writing/general stay visible only as supporting workbench types on the overview page
- code and image are the only fully developed vertical showcase experiences in this iteration
- the implementation target is static HTML/CSS/JS under `showcase/`
