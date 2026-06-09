# Phase 0 Research: Repository Foundation and Tooling

**Feature**: 001-repo-foundation-tooling | **Date**: 2026-06-09

This phase has **no open `NEEDS CLARIFICATION` items**. The technology stack is
fixed by the ChatFrame Constitution v1.0.0 (Approved Technical Baseline) and the
master `docs/implementation-plan.md` (Phase 1). The spec's clarification session
resolved all product-level ambiguities. The decisions below record the choices,
rationale, and rejected alternatives so the plan is self-contained.

## Decisions

### 1. Monorepo + package manager — pnpm workspaces

- **Decision**: Single repo with `packages/shared`, `backend`, `frontend`
  managed by pnpm workspaces.
- **Rationale**: Satisfies FR-011 (one workspace separating shared definitions,
  local service, UI) and FR-012 (both sides import shared definitions). pnpm's
  content-addressed store and strict node_modules avoid phantom dependencies and
  give a committed lockfile for dependency hygiene (Constitution XXII).
- **Alternatives considered**: npm/yarn workspaces (weaker isolation, no strict
  hoisting); Nx/Turborepo (extra orchestration complexity not justified for this
  scope, Constitution XXIV — prefer simpler).

### 2. Backend framework — Fastify on Node.js + TypeScript (strict)

- **Decision**: Fastify 5 with a Pino logger, env via `dotenv`, Zod validation
  at boundaries.
- **Rationale**: Mandated by the Approved Technical Baseline. Fastify is fast,
  TypeScript-friendly, and has first-party CORS support for the dev cross-origin
  case (FR-008). Pino is the constitution-aligned logger; logs stay local
  (Constitution I, XIX) and must never include secrets.
- **Alternatives considered**: Express (less typed, slower), raw `http` (more
  boilerplate). Rejected to stay on baseline.

### 3. Frontend stack — React 19 + Vite + Tailwind + React Router v7

- **Decision**: React 19 with Vite dev server (port 5173), Tailwind CSS for
  layout/styling, React Router v7 for the welcome → next-step flow.
- **Rationale**: Mandated by baseline. Vite gives fast dev start (supports
  SC-001 <30s). React Router cleanly models the wizard entry (FR-018, FR-019).
- **Alternatives considered**: Next.js (SSR/hosting model conflicts with local
  desktop-first scope, Constitution XVII); CRA (deprecated). Rejected.

### 4. Client state (language) — Zustand + localStorage persistence

- **Decision**: `useLanguageStore` (Zustand) persists `{ language, direction }`
  to browser `localStorage`.
- **Rationale**: FR-005 (persist locally, restore without prompting) and FR-021
  (returning user skips welcome). Zustand `persist` middleware writes to
  localStorage with no backend or database (Constitution V). Default to English
  (LTR) when no/unrecognized stored value (Clarification + Edge Cases).
- **Alternatives considered**: Redux (heavier), React Context only (no built-in
  persistence), cookies (sent on requests; unnecessary and less private).

### 5. Server state / health check — TanStack Query

- **Decision**: TanStack Query drives the `GET /api/health` request; the response
  is validated with the shared Zod `HealthStatus` schema before use.
- **Rationale**: FR-007/FR-008/FR-010 — query readiness, handle the cross-origin
  dev case, and render a clear non-technical "not ready" state on failure/loading
  (Constitution XIX). Query gives retry/loading/error states for free.
- **Alternatives considered**: bare `fetch` in `useEffect` (manual retry/error
  handling, error-prone). Rejected.

### 6. Internationalization & directionality — layout-level `dir`/`lang`

- **Decision**: A small typed dictionary (`en.ts`, `ar.ts`) plus a `direction.ts`
  helper mapping `ar → rtl`, `en → ltr`. The app sets `document.dir`/`lang` (and
  a shell wrapper `dir`) from the language store; Tailwind logical properties
  used where helpful.
- **Rationale**: Constitution XVI requires intentional layout-level direction
  handling, not ad-hoc CSS overrides (FR-003). Switching updates `dir`
  immediately without navigation (FR-020, AC-5).
- **Alternatives considered**: `react-i18next` (more capability than two static
  locales need this phase; can be adopted later without breaking the dictionary
  shape); per-component CSS `direction` overrides (violates Constitution XVI).

### 7. Typography — Inter (English) / IBM Plex Sans Arabic (Arabic)

- **Decision**: Bundle/locally reference Inter and IBM Plex Sans Arabic with
  system fallbacks selected by active language.
- **Rationale**: FR-004 (language-appropriate typography with graceful
  fallback). Local fonts keep the app within the no-external-network rule
  (FR-016) — no remote font CDN.
- **Alternatives considered**: Google Fonts CDN (external network request,
  violates FR-016/Constitution I). Rejected — fonts must be local.

### 8. Configurable ports — `.env` + `.env.example`

- **Decision**: `BACKEND_PORT` (default 3714), `FRONTEND_PORT` (default 5173),
  and `VITE_BACKEND_URL` configured via `.env`; `.env.example` committed.
- **Rationale**: FR-009 (configurable without source changes). Backend reads via
  validated env config; Vite exposes `VITE_`-prefixed vars to the client. If a
  port is in use, startup surfaces an understandable message (Edge Cases).
- **Alternatives considered**: Hard-coded ports (violates FR-009); CLI flags
  (less ergonomic for a single `pnpm dev`).

### 9. Single start command — root `pnpm dev`

- **Decision**: Root `package.json` `dev` script runs backend and frontend
  together (parallel via pnpm `--parallel` / `-r`, or `concurrently`).
- **Rationale**: FR-006 (single documented start action) and SC-004 (both
  reachable + health OK on first attempt).
- **Alternatives considered**: Separate manual starts (fails the single-action
  requirement); Docker compose (introduces infra weight not justified for a
  local desktop app this phase).

### 10. Testing & quality gates — Vitest + ESLint + Prettier + shared tsconfig

- **Decision**: Vitest in every package, ESLint + Prettier with shared config,
  `tsconfig.base.json` extended by each package with `strict: true`. Root scripts
  `typecheck`, `lint`, `test`.
- **Rationale**: FR-013 (zero type errors), FR-014 (style check passes), FR-015
  (tests run, zero failures), SC-005, and Constitution XIV/XX. A green baseline
  is acceptable before substantial feature tests exist (Assumptions).
- **Alternatives considered**: Jest (slower with TS/ESM, extra config vs Vite
  alignment). Rejected to keep one test runner across the stack.

## No Open Questions

All `NEEDS CLARIFICATION` resolved. Ready for Phase 1 design.
