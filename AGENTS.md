# Daily - Smart Workbench

## Project Structure

```
Daily/
├── smart-workbench/          # Main Tauri desktop app (React + TS)
│   ├── src/
│   │   ├── app/             # Routes and layout
│   │   ├── features/        # Page components (home, schedule, workspace, inbox)
│   │   ├── domain/          # Business entities (workspace, schedule, task, inbox)
│   │   ├── storage/         # SQLite schema, repositories, seed data
│   │   └── shared/          # Hooks, utils, constants
│   └── src-tauri/           # Rust backend (Tauri)
├── ai-service/               # Express + LangChain AI service
│   └── src/
└── showcase/                # Demo HTML/JS files
```

## Key Technologies

- **Desktop**: Tauri 2 (macOS private API, transparent borderless window)
- **Frontend**: React 19, TypeScript, Vite 7, Tailwind CSS v4, date-fns, framer-motion
- **State**: Zustand (UI state), TanStack Query (sync state)
- **AI**: LangChain, OpenAI (ai-service)
- **Backend**: Rust with SQLite (rusqlite)
- **Package Manager**: pnpm

## Commands

```bash
# smart-workbench (desktop app)
cd smart-workbench && pnpm dev          # Start dev server (Vite on :1420)
cd smart-workbench && pnpm build        # TypeScript + Vite build
cd smart-workbench && pnpm tauri        # Tauri build/run

# ai-service
cd ai-service && pnpm dev               # tsx watch mode
cd ai-service && pnpm build && pnpm start  # Production
```

## App Configuration

- **Window**: 1200x720, min 900x600, transparent, no decorations, centered
- **MacOS**: Private API enabled
- **Build**: Frontend dist at `smart-workbench/dist`, bundled by Tauri

## Data Model

All times stored in **UTC**. UI layer converts to local timezone via `date-fns`.

Core entities:
- `Workspace` - project context container (code/image/writing/general)
- `ScheduleItem` - calendar events (manual, google_calendar, outlook_calendar, mail_extracted)
- `InboxItem` - email summaries with action recommendations
- `TaskItem` - todos linked to workspaces/schedules

## Schedule Feature (Current Focus)

Location: `smart-workbench/src/features/schedule/`

Key files:
- `CalendarView.tsx` - Timeline view (0-24h, 32px per 30-min slot)
- `SchedulePage.tsx` - Page orchestration
- `ScheduleModal.tsx` - Create/edit form with TimeSelect

Timeline specs:
- 24-hour range, 48 half-hour slots
- Gap > 30 min between schedules renders dashed connector line
- Clicking empty timeline pre-fills start time, auto-calculates end = start + 30 min
- Max visible height: `calc(100vh - 280px)`, scrolls independently

## Architecture Notes

Clean separation:
- **UI Layer**: React components in `features/`
- **Domain Layer**: TypeScript types/interfaces in `domain/`
- **Storage Layer**: SQLite via Rust backend, schema in `storage/db/schema.sql`
- **Connector Layer**: External API integrations (planned)

Mock data available in `storage/seeds/mockData.ts` for development.

## Code Conventions

- Comments: Avoid unnecessary comments - code should be self-documenting
- Chinese comments OK in domain/types files for product context
- ESLint/Prettier defaults (check package.json for scripts)
- TypeScript strict mode
