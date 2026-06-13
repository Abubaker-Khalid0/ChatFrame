# ChatFrame

ChatFrame is a **local-first** web application for visually exporting personal
one-to-one WhatsApp conversations into accurate, readable, WhatsApp-like
archives. It runs entirely on your own machine and is **read-only** toward your
data — it never sends, edits, or deletes anything, and it performs no telemetry,
analytics, or hidden network requests.

> This repository currently contains **Phase 2 — Shared Contracts and Mock
> Data** (building on Phase 1's monorepo, tooling, and bilingual app shell). All
> project-owned types and Zod schemas now live in `@chatframe/shared`, and a
> mock integration adapter serves synthetic data so the full wizard flow (chat
> picker → import → quality → preview → export) can be developed and demonstrated
> without any real WhatsApp connection. Real WhatsApp connection, import, and
> export arrive in later phases.

## Features in this phase

- Shared TypeScript types and Zod schemas (chats, messages, quality reports,
  connection state, import progress, export settings) as the single source of
  truth for the backend and frontend.
- A read-only `WhatsAppAdapter` interface with a `MockAdapter` that returns
  synthetic fixture data instantly (8 chats, ~50 messages covering every
  message scenario).
- Mock API endpoints (`/api/chats/private`, `/api/projects/:projectId/preview`)
  and a connected wizard UI: chat picker, conversation preview, and placeholder
  import/quality/export steps.
- Runtime validation at boundaries with shared schemas; invalid data is
  rejected with clear, field-level reasons.
- Bilingual (Arabic RTL / English LTR) app shell with a persisted language
  preference and an always-available language switcher.
- Strict type safety, linting, formatting, and a green test baseline across the
  whole workspace.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer (22 LTS recommended)
- [pnpm](https://pnpm.io/) 9 or newer

  If you have Node's Corepack enabled, you can activate pnpm without a global
  install:

  ```bash
  corepack enable pnpm
  ```

- A modern desktop browser

## Setup

```bash
# Install workspace dependencies
pnpm install

# Create your local environment file from the template
cp .env.example .env        # Windows (PowerShell): Copy-Item .env.example .env
```

Default ports (configurable in `.env`, no source changes needed):

| Service             | Default | Variable           |
| ------------------- | ------- | ------------------ |
| Backend (Fastify)   | `3714`  | `BACKEND_PORT`     |
| Frontend (Vite dev) | `5173`  | `FRONTEND_PORT`    |
| Backend URL (UI)    | —       | `VITE_BACKEND_URL` |
| Mock data mode      | `false` | `MOCK_MODE`        |
| Workspace data dir  | `./chatframe-data` | `WORKSPACE_DIR` |
| WhatsApp session dir | `./chatframe-data/sessions` | `SESSION_DIR` |

## Commands

| Command          | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `pnpm dev`       | Start the backend and frontend together (single command).        |
| `pnpm build`     | Build all packages.                                              |
| `pnpm test`      | Run the full test suite across all packages.                     |
| `pnpm lint`      | Check code style (ESLint + Prettier).                            |
| `pnpm typecheck` | Type-check all packages with zero-error strict TypeScript.       |
| `pnpm format`    | Auto-fix formatting with Prettier.                               |

After `pnpm dev`, open the frontend at `http://localhost:5173`. The backend
health endpoint is available at `http://localhost:3714/api/health`.

## Mock mode and the wizard flow

Set `MOCK_MODE=true` to run the application against synthetic data with no real
WhatsApp connection. In mock mode the backend serves a read-only `MockAdapter`:

```bash
# macOS/Linux
MOCK_MODE=true pnpm dev

# Windows (PowerShell)
$env:MOCK_MODE = 'true'; pnpm dev
```

You can also set `MOCK_MODE=true` in your `.env`. With mock mode on, the two
mock endpoints return synthetic fixtures instantly:

- `GET /api/chats/private` — 8 synthetic one-to-one chats.
- `GET /api/projects/:projectId/preview` — a ~50-message conversation covering
  every message scenario (Arabic, English, mixed, emoji, images, replies,
  deleted, edited, unsupported, missing media, and more).

From the welcome screen, the wizard proceeds through **chat picker → import →
quality → preview → export**. The chat picker and conversation preview render
real mock data; the import, quality, and export steps are placeholders until
later phases.

## Project folder storage

Imported conversations are stored on your machine as self-contained project
folders under the workspace directory. The workspace root is configured by
`WORKSPACE_DIR` (default `./chatframe-data`, relative to the backend's working
directory); project folders live in its `projects/` subdirectory. The workspace
is git-ignored, so your data is never committed. Storage logic is backend-only —
the frontend touches project data exclusively through the project API.

Each project folder is named deterministically as
`chatframe_YYYY-MM-DD_<contact-slug>` (Unicode, including Arabic, is preserved;
duplicate names get a `-2`, `-3`, … suffix) and has this layout:

```text
chatframe_2026-06-10_<contact>/    # folder name = project ID
├── project.json                   # manifest (display name, status, counts)
├── source.json                    # immutable adapter/source metadata
├── raw/                           # immutable raw NDJSON (append-only)
├── normalized/                    # derived data + media.json index
├── media/images/                  # downloaded images (img_000001.jpg, …)
├── exports/html/assets/           # generated HTML export + assets
└── logs/                          # import / normalization logs
```

### Project API

All endpoints are local and live under `/api/projects`. Request and response
bodies are validated against the shared Zod schemas; errors use the structured
`{ error, message, details? }` shape.

| Method  | Endpoint               | Description                                                        |
| ------- | ---------------------- | ------------------------------------------------------------------ |
| `POST`  | `/api/projects`        | Create a project folder. `201` with `projectId` + path `warnings`. |
| `GET`   | `/api/projects/:id`    | Retrieve a project's manifest. `200`, `404`, or `422` if malformed.|
| `PATCH` | `/api/projects/:id`    | Rename a project's `displayName` (folder name is unchanged). `200`.|

The `:id` is the URL-encoded project folder name. See
`specs/003-project-folder-storage/contracts/projects.md` for full request and
response shapes.

## Normalization pipeline

The normalization engine is the backend intelligence that transforms the
immutable raw NDJSON (`raw/messages.raw.ndjson`) into clean, renderable data. It
runs as an ordered, deterministic pipeline — read + validate → map + normalize
timestamps → classify unsupported types → sort → deduplicate → resolve replies →
link images → resolve participants → build render model → build quality report —
and writes every output to a temporary staging directory that is **atomically
promoted** to `normalized/` only on full success. A failed run leaves
`normalized/` untouched. All normalization logic is backend-only; the frontend
renders the results and contains no parsing, deduplication, or reply-resolution
logic.

Outputs written to `normalized/`:

| File                  | Contents                                                            |
| --------------------- | ------------------------------------------------------------------- |
| `messages.ndjson`     | Normalized messages, one `NormalizedMessage` per line, sorted by time. |
| `quality-report.json` | Counts, date range, warnings, and errors for the run.               |
| `participants.json`   | Deduplicated sender identities (id, display name, `isMe`).          |
| `render-model.json`   | Preview-ready model: messages grouped by date with separators.      |
| `media.json`          | Media index owned by `MediaStore`; normalization links to it.       |

Per-step structural summaries (step name, record counts, duration) are appended
to `logs/normalization.log`. Logs never contain message content, captions,
sender names, tokens, or QR data. Normalization is deterministic: given the same
raw input and version, `messages.ndjson`, `participants.json`, and
`render-model.json` are byte-identical between runs (only the report's
`generatedAt` varies).

### Normalization API

All endpoints are local and live under `/api/projects/:id`. Request and response
bodies are validated against the shared Zod schemas.

| Method | Endpoint                          | Description                                                          |
| ------ | --------------------------------- | -------------------------------------------------------------------- |
| `POST` | `/normalize`                      | Run (or re-run) normalization. `202` running; `409` if a run is active; `422` if no raw data; `404` if missing. |
| `GET`  | `/normalization/status`           | Current run state (`idle`/`running`/`completed`/`failed`). `200`/`404`. |
| `GET`  | `/quality-report`                 | The generated `QualityReport`. `200`/`404` (before a run).           |
| `GET`  | `/render-model`                   | The preview-ready `RenderModel`. `200`/`404` (before a run).         |

Normalization runs automatically as the final stage of the import pipeline
(arriving in a later phase) and can be manually re-run on an existing project,
regenerating all outputs from the immutable raw data. See
`specs/004-normalization-engine/contracts/normalization.md` for full shapes.

## Project structure

```text
.
├── packages/shared/   # @chatframe/shared — common types, schemas, constants
├── backend/           # @chatframe/backend — Fastify local service
├── frontend/          # @chatframe/frontend — React + Vite user interface
└── specs/             # Feature specifications, plans, and tasks
```

The frontend communicates with the backend only through defined local APIs; it
never accesses WhatsApp libraries or project files directly.

## Tech stack

- **Backend:** Node.js · TypeScript · Fastify · Pino · Zod
- **Frontend:** React · Vite · Tailwind CSS · React Router · TanStack Query · Zustand
- **Shared:** TypeScript · Zod (the source of truth for cross-cutting types)
- **Tooling:** pnpm workspaces · ESLint · Prettier · Vitest

## Known limitations

The MVP intentionally keeps a narrow scope. Be aware of the following before
relying on it:

- **One-to-one chats only.** Group chats are filtered out and cannot be
  imported or exported.
- **Images only.** Audio, video, documents, stickers, and other media types
  are preserved as visible "unsupported message" placeholders, not as files.
- **Unofficial WhatsApp integration.** ChatFrame depends on `whatsapp-web.js`,
  an unofficial library that automates WhatsApp Web. WhatsApp updates can
  break it at any time, and using it is at your own risk.
- **No date-range filtering.** An import always fetches the full conversation
  history.
- **HTML export only.** There is no PDF, PNG, or ZIP export.
- **No project dashboard.** Completed projects cannot be re-opened from the
  UI; each export run starts a fresh import.
- **Desktop browsers only.** The interface is designed for a desktop browser
  talking to the local backend; there is no mobile or tablet layout.

## Privacy

ChatFrame is local-first by design. No data leaves your machine, and the
application makes no network requests other than local communication between the
user interface and the local service. It is not affiliated with, endorsed by, or
provided by WhatsApp or Meta.
