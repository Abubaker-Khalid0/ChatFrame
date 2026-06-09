# ChatFrame

ChatFrame is a **local-first** web application for visually exporting personal
one-to-one WhatsApp conversations into accurate, readable, WhatsApp-like
archives. It runs entirely on your own machine and is **read-only** toward your
data — it never sends, edits, or deletes anything, and it performs no telemetry,
analytics, or hidden network requests.

> This repository currently contains **Phase 1 — Repository Foundation and
> Tooling**: a full-stack TypeScript monorepo with all tooling configured and a
> working bilingual app shell (Arabic RTL / English LTR) plus a local health
> check. WhatsApp connection, import, preview, and export arrive in later
> phases.

## Features in this phase

- Bilingual welcome experience with a clear local-first / read-only message.
- Arabic (right-to-left) and English (left-to-right) layouts with
  language-appropriate typography and an always-available language switcher.
- Language preference persisted locally and restored on later launches
  (returning users skip the welcome screen).
- Single-command startup of the local service and user interface, with a health
  check and a friendly "not ready" state.
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

## Privacy

ChatFrame is local-first by design. No data leaves your machine, and the
application makes no network requests other than local communication between the
user interface and the local service. It is not affiliated with, endorsed by, or
provided by WhatsApp or Meta.
