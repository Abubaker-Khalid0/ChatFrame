# Implementation Plan: Repository Foundation and Tooling

**Branch**: `001-repo-foundation-tooling` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-repo-foundation-tooling/spec.md`

## Summary

Establish a stable full-stack TypeScript **pnpm workspace monorepo** with three
packages (`packages/shared`, `backend`, `frontend`), fully configured tooling
(strict TypeScript, ESLint, Prettier, Vitest), and a working bilingual app
shell. The shell delivers the only end-user-facing capability of this phase:
a welcome screen where a first-time user reads a local-first / read-only trust
message and chooses Arabic (RTL) or English (LTR). The choice is persisted to
local browser storage and restored on later launches (returning users skip the
welcome screen). A language switcher in the app shell is available on every
screen. A single `pnpm dev` command starts both the Fastify backend
(port 3714) and the Vite frontend (port 5173); the frontend verifies backend
readiness via `GET /api/health` and shows a friendly "not ready" state on
failure. After choosing a language and continuing, the user lands on a
placeholder "coming soon" next-step screen.

Technical approach follows the approved constitutional baseline and the master
`docs/implementation-plan.md` (Phase 1): Node.js + TypeScript + Fastify backend,
React 19 + Vite + Tailwind frontend, Zustand for language state, TanStack Query
for backend health, filesystem-only (no database), and no telemetry/analytics.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) on Node.js 20+ LTS

**Primary Dependencies**:
- Backend: Fastify 5, `@fastify/cors`, Pino, Zod, `dotenv`
- Frontend: React 19, Vite 7, Tailwind CSS, React Router v7, TanStack Query, Zustand
- Shared: Zod (schema/type source of truth)

**Storage**: Browser `localStorage` for the language preference (frontend only).
No database, no server-side persistence in this phase (per Constitution V).

**Testing**: Vitest across all packages; React Testing Library for frontend
components.

**Target Platform**: Modern desktop browser + local Node.js backend on the same
machine (desktop-first local web app, Constitution XVII).

**Project Type**: Web application (frontend + backend + shared package) in a
pnpm workspace monorepo.

**Performance Goals**: New user reaches a correctly-directioned app shell in
under 30 seconds (SC-001). Language switch reflects direction change immediately
(no navigation). Health check round-trip is local and effectively instant.

**Constraints**:
- No network requests other than local frontend↔backend (FR-016, Constitution I).
- No telemetry, analytics, remote logging, or crash reporting (FR-017).
- Strict type safety: project-wide type check completes with zero errors (FR-013).
- Default local ports configurable without source changes via `.env` (FR-009).

**Scale/Scope**: Foundation phase. 3 workspace packages; 1 backend route
(`/api/health`); ~2 user-facing screens (welcome + placeholder next step) plus
the app shell and language switcher. Baseline green test suite (no minimum test
count required, per Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against ChatFrame Constitution v1.0.0. Only principles applicable to a
foundation/tooling phase are gating; later-phase principles (normalization,
export, quality reporting, etc.) are noted as N/A for this phase but must not be
contradicted by the foundation.

| Principle | Applies now | Status | Notes |
|-----------|-------------|--------|-------|
| I. Local-First, Private by Default | Yes | PASS | No cloud, no external calls; only local frontend↔backend (FR-016). |
| II. Personal Read-Only Usage | Yes (no-op) | PASS | No WhatsApp interaction introduced. |
| III. WhatsApp-Only Scope | Yes (no-op) | PASS | No non-WhatsApp code/abstractions added. |
| IV. Adapter-Based WhatsApp Integration | Deferred | PASS | No adapter code yet; structure leaves room (`backend/src/whatsapp/` reserved later). |
| V. Filesystem Storage, No Database | Yes | PASS | No database introduced; preference uses browser localStorage. |
| VI. Raw Data Immutability | Deferred | N/A | No imported data in this phase. |
| VII. Accuracy Before Appearance | Deferred | N/A | No message rendering yet. |
| VIII. Quality Reporting | Deferred | N/A | No import/normalization yet. |
| IX. Deterministic Normalization | Deferred | N/A | No normalization yet. |
| X. HTML Primary Export | Deferred | N/A | No export yet. |
| XI. WhatsApp-Like, Not WhatsApp-Owned | Yes | PASS | UI copy avoids implying WhatsApp/Meta affiliation. |
| XII. Privacy Controls Before Export | Deferred | N/A | No export yet. |
| XIII. Session Safety | Deferred | N/A | No session files yet. |
| XIV. Strong Type Safety | Yes | PASS | Strict TS everywhere; Zod at boundaries (health response validated); no `any` in core. |
| XV. Clear Backend/Frontend Separation | Yes | PASS | Frontend talks to backend only via `/api/*`; no library/file access from frontend. |
| XVI. Internationalization and Directionality | Yes | PASS | Arabic RTL / English LTR handled at layout level via `dir`/`lang`, not ad-hoc CSS. |
| XVII. Desktop-First Local Web App | Yes | PASS | Desktop browser + local backend; no Electron/Tauri/CLI/SaaS. |
| XVIII. Performance (Streaming/Batching) | Deferred | N/A | No large data flows yet. |
| XIX. Explicit Error Handling | Yes | PASS | Health-unavailable state shows clear non-technical message (FR-010). |
| XX. Testable Core Logic | Yes | PASS | Vitest configured; direction/i18n helpers and health client are unit-testable without WhatsApp. |
| XXI. Generated Code Respects Architecture | Yes | PASS | No hidden deps, db, cloud, telemetry, or FE↔adapter coupling. |
| XXII. Security and Dependency Hygiene | Yes | PASS | Conservative, well-known deps; lockfile committed; versions pinned via pnpm. |
| XXIII. No Silent Data Loss | Deferred | N/A | No user data processed yet. |
| XXIV. Constitution Compliance Review | Yes | PASS | This section satisfies the pre-implementation check. |
| XXV. Amendment Procedure | Yes (no-op) | PASS | No constitutional change requested. |

**Baseline stack conformance**: Backend Node.js+TS+Fastify, Frontend
React+Vite+Tailwind, Storage filesystem (none server-side this phase),
pnpm workspaces — all match the Approved Technical Baseline. No baseline change.

**Gate result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-repo-foundation-tooling/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── health.md        # GET /api/health contract
├── checklists/
│   └── requirements.md  # Existing requirements checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
chatframe/
├── pnpm-workspace.yaml           # Workspace package globs
├── package.json                  # Root scripts: dev, build, test, lint, typecheck
├── tsconfig.base.json            # Shared strict TypeScript config
├── .env.example                  # BACKEND_PORT=3714, FRONTEND_PORT=5173, VITE_BACKEND_URL
├── .eslintrc / eslint.config.js  # Shared ESLint config
├── .prettierrc                   # Shared Prettier config
├── vitest config (root)          # Workspace test runner config
├── README.md                     # Project description, prerequisites, setup, dev/test/lint commands (FR-022)
│
├── packages/
│   └── shared/                   # @chatframe/shared
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          # Barrel export
│           ├── types/            # Placeholder type stubs for later phases
│           ├── schemas/          # Zod schemas (HealthStatus this phase)
│           └── constants/        # Shared constants (e.g., default ports, lang codes)
│
├── backend/                      # @chatframe/backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts             # Entry point (reads env, starts Fastify)
│       ├── app.ts                # Fastify app factory (CORS + routes)
│       ├── config/env.ts         # Env loading + validation (Zod)
│       └── api/routes/health.routes.ts  # GET /api/health
│
└── frontend/                     # @chatframe/frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts            # Dev server port + proxy/env
    ├── index.html
    └── src/
        ├── main.tsx              # Bootstraps providers + router
        ├── App.tsx
        ├── app/
        │   ├── routes.tsx        # Welcome → placeholder next-step routes
        │   └── providers.tsx     # TanStack Query + i18n/direction provider
        ├── i18n/
        │   ├── en.ts             # English strings
        │   ├── ar.ts             # Arabic strings
        │   └── direction.ts      # language → dir/lang mapping helper
        ├── stores/
        │   └── useLanguageStore.ts  # Zustand + localStorage persistence
        ├── api/
        │   ├── client.ts         # fetch wrapper (base URL from env)
        │   └── health.api.ts     # health query (validated with shared Zod schema)
        ├── components/layout/
        │   ├── AppShell.tsx      # Shell with language switcher + health indicator
        │   └── LanguageSwitcher.tsx
        ├── pages/
        │   ├── WelcomePage.tsx       # Trust message + language choice + Continue
        │   └── NextStepPage.tsx      # Placeholder "coming soon"
        └── styles/
            └── globals.css       # Tailwind entry + font faces (Inter / IBM Plex Sans Arabic)
```

**Structure Decision**: Web-application monorepo (frontend + backend + shared)
managed by pnpm workspaces, matching the master `docs/implementation-plan.md`
Phase 1 layout and Constitution XV (clear backend/frontend separation) and FR-011
(workspace separating shared definitions, local service, and UI). This phase
creates the full directory skeleton but implements only the files required for
the foundation and the welcome/language/health experience; deeper subtrees
(`whatsapp/`, `normalize/`, `export/`, etc.) are reserved for later phases and
not created until needed.

## Complexity Tracking

> No Constitution Check violations. This section intentionally left empty.
