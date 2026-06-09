# Quickstart: Repository Foundation and Tooling

**Feature**: 001-repo-foundation-tooling | **Date**: 2026-06-09

This guide validates that the foundation phase works end-to-end. It proves the
three user stories: the bilingual/bidirectional welcome experience (P1), reliable
single-command local startup with a verified health check (P2), and the
quality-enforced project structure (P3). See [spec.md](./spec.md),
[data-model.md](./data-model.md), and [contracts/health.md](./contracts/health.md)
for details referenced below.

## Prerequisites

- Node.js 20+ LTS
- pnpm 9+ (`npm install -g pnpm`)
- A modern desktop browser

## Setup

```bash
# from repo root
pnpm install
cp .env.example .env   # Windows: copy .env.example .env
```

`.env` defaults: `BACKEND_PORT=3714`, `FRONTEND_PORT=5173`,
`VITE_BACKEND_URL=http://localhost:3714` (configurable per FR-009).

## Run

```bash
pnpm dev   # starts backend (3714) + frontend (5173) together
```

## Validation scenarios

### Story 1 — Language choice + correct direction (P1)

1. Open `http://localhost:5173` in a fresh browser profile (no stored prefs).
   - **Expect**: welcome screen with a clear local-first / read-only message and
     a choice between Arabic and English (FR-001, FR-002; default English LTR).
2. Select **English**, click Continue.
   - **Expect**: LTR layout with English typography; lands on the placeholder
     "next steps coming soon" screen in English (FR-003, FR-004, FR-019).
3. Reload the page.
   - **Expect**: welcome screen is skipped; lands directly on the next-step
     screen in English (FR-005, FR-021, AC-4).
4. Use the **language switcher** in the app shell to choose **Arabic**.
   - **Expect**: layout flips to RTL with Arabic typography immediately, no
     navigation away (FR-020, AC-5; SC-002).
5. Clear browser storage, reload.
   - **Expect**: defaults back to the welcome screen in English LTR (Edge Cases).

### Story 2 — Reliable local startup + health (P2)

1. With `pnpm dev` running, confirm backend and frontend are reachable on
   `http://localhost:3714` and `http://localhost:5173` (FR-006, AC-1).
2. Request the health endpoint:
   ```bash
   curl http://localhost:3714/api/health
   ```
   - **Expect**: `200` with `{"status":"ok",...}` (FR-007; see contract).
   - **Expect (UI)**: the app indicates it is ready (AC-2, SC-004).
3. Stop the backend (leave frontend running), reload the app.
   - **Expect**: a clear, non-technical "app not ready" message in the selected
     language — not a blank screen or raw error (FR-010, AC-3).

### Story 3 — Quality-enforced foundation (P3)

Run each on a fresh checkout; all must pass with zero errors/failures (SC-005):

```bash
pnpm typecheck   # FR-013: zero type errors across all packages
pnpm lint        # FR-014: zero style violations
pnpm test        # FR-015: Vitest runs, zero failures (green baseline)
```

- **Expect**: `packages/shared`, `backend`, and `frontend` are clearly separated
  and frontend/backend both import from `@chatframe/shared` (FR-011, FR-012,
  AC-4 Story 3).

### Privacy / no-network check (cross-cutting)

- With DevTools Network tab open during normal use, confirm the only requests are
  local frontend↔backend (`localhost:3714`); no external/telemetry requests
  (FR-016, FR-017, SC-006). Fonts load locally, not from a CDN.

## Done

All scenarios above pass → foundation phase is validated and ready for
`/speckit-tasks` to break the plan into implementation tasks.
