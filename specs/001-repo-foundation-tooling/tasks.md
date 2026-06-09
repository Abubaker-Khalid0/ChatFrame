# Tasks: Repository Foundation and Tooling

**Input**: Design documents from `/specs/001-repo-foundation-tooling/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/health.md ✅, quickstart.md ✅

**Tests**: Included. A runnable test suite with a green baseline is required by FR-015 / SC-005, and Constitution XX (Testable Core Logic) mandates that core helpers are testable. Test tasks here are minimal and tied to acceptance criteria — not full TDD coverage.

**Organization**: Tasks are grouped by user story (P1 → P2 → P3) so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story the task belongs to (US1, US2, US3)
- Exact file paths are included in each description

## Path Conventions

Web-app monorepo (pnpm workspaces): `packages/shared/`, `backend/`, `frontend/` at repository root, per plan.md Structure Decision.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the monorepo and project-wide tooling.

- [X] T001 Create monorepo skeleton (`packages/shared/`, `backend/`, `frontend/` directories) and `pnpm-workspace.yaml` at repo root
- [X] T002 Create root `package.json` with workspace scripts `dev`, `build`, `test`, `lint`, `typecheck` (scripts delegate to package scripts; `dev` runs backend + frontend in parallel)
- [X] T003 [P] Create `tsconfig.base.json` at repo root with `strict: true` and shared compiler options
- [X] T004 [P] Configure shared ESLint + Prettier at repo root (`eslint.config.js`, `.prettierrc`) covering all packages
- [X] T005 [P] Configure root Vitest workspace runner (`vitest.workspace.ts`) covering all three packages
- [X] T006 [P] Create `.env.example` (`BACKEND_PORT=3714`, `FRONTEND_PORT=5173`, `VITE_BACKEND_URL=http://localhost:3714`) and update `.gitignore` for `.env`, `node_modules`, and build outputs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared package and the backend/frontend skeletons that every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Initialize `@chatframe/shared` package (`packages/shared/package.json`, `packages/shared/tsconfig.json` extending base)
- [X] T008 [P] Add shared constants (language codes `'en'`/`'ar'`, direction map, default ports) in `packages/shared/src/constants/index.ts`
- [X] T009 [P] Add placeholder type stubs and barrel export in `packages/shared/src/index.ts`
- [X] T010 Initialize `@chatframe/backend` package with Fastify, Pino, dotenv, Zod (`backend/package.json`, `backend/tsconfig.json` extending base)
- [X] T011 Implement env config loader with Zod validation in `backend/src/config/env.ts` (reads `BACKEND_PORT`, allowed frontend origin)
- [X] T012 Implement Fastify app factory with Pino logger in `backend/src/app.ts`
- [X] T013 Implement server entry point in `backend/src/server.ts` (listens on `BACKEND_PORT`; surfaces a clear message if the port is already in use)
- [X] T014 Initialize `@chatframe/frontend` package (React 19, Vite, React Router v7, TanStack Query, Zustand) with `frontend/package.json`, `frontend/tsconfig.json`, and `frontend/vite.config.ts` (port from `FRONTEND_PORT`, exposes `VITE_BACKEND_URL`)
- [X] T015 [P] Set up Tailwind CSS and `frontend/src/styles/globals.css` with local Inter and IBM Plex Sans Arabic font faces (no remote CDN, per FR-016)
- [X] T016 Set up app providers (TanStack Query) in `frontend/src/app/providers.tsx` and bootstrap in `frontend/src/main.tsx` + `frontend/src/App.tsx`
- [X] T017 Set up base router with `welcome` and `next-step` routes in `frontend/src/app/routes.tsx`
- [X] T018 Verify workspace resolution: `backend` and `frontend` can import from `@chatframe/shared` (FR-012)

**Checkpoint**: Shared package compiles; backend and frontend skeletons start standalone. User stories can now begin.

---

## Phase 3: User Story 1 - Choose a language and see a correctly directioned interface (Priority: P1) 🎯 MVP

**Goal**: First-time user reads the local-first / read-only trust message, picks Arabic (RTL) or English (LTR), the layout flips correctly, the choice persists, and returning users skip the welcome screen and land on the placeholder next step. A shell language switcher works on every screen.

**Independent Test**: Open the frontend, select each language and confirm direction flips, reload and confirm the choice is restored (welcome skipped), and use the shell switcher to change language without navigating away.

### Tests for User Story 1

- [X] T019 [P] [US1] Unit test for direction helper (`ar→rtl`, `en→ltr`, unknown→`ltr`) in `frontend/src/i18n/direction.test.ts`
- [X] T020 [P] [US1] Unit test for `useLanguageStore` default (en/ltr, `hasChosen:false`) and persistence in `frontend/src/stores/useLanguageStore.test.ts`

### Implementation for User Story 1

- [X] T021 [P] [US1] Create direction helper (language → `dir`/`lang` mapping) in `frontend/src/i18n/direction.ts`
- [X] T022 [P] [US1] Create English string dictionary in `frontend/src/i18n/en.ts`
- [X] T023 [P] [US1] Create Arabic string dictionary in `frontend/src/i18n/ar.ts`
- [X] T024 [US1] Create `useLanguageStore` (Zustand + localStorage persist; default en/ltr; `hasChosen` flag; unrecognized value → en/ltr) in `frontend/src/stores/useLanguageStore.ts`
- [X] T025 [US1] Apply `dir`/`lang` at document and shell level from the store (effect) in `frontend/src/app/providers.tsx`
- [X] T026 [US1] Create `AppShell` layout (hosts the language switcher slot) in `frontend/src/components/layout/AppShell.tsx`
- [X] T027 [US1] Create `LanguageSwitcher` (changes language + direction immediately, no navigation) in `frontend/src/components/layout/LanguageSwitcher.tsx`
- [X] T028 [US1] Create `WelcomePage` (local-first/read-only message + Arabic/English choice + Continue) in `frontend/src/pages/WelcomePage.tsx`
- [X] T029 [US1] Create `NextStepPage` (friendly "next steps coming soon" in the selected language) in `frontend/src/pages/NextStepPage.tsx`
- [X] T030 [US1] Add route guard so returning users (`hasChosen:true`) skip welcome and land on next-step in `frontend/src/app/routes.tsx`

**Checkpoint**: Welcome/language/direction experience fully functional and independently testable on the frontend.

---

## Phase 4: User Story 2 - Launch the complete local application reliably (Priority: P2)

**Goal**: A single `pnpm dev` starts backend (3714) and frontend (5173) together; the frontend queries `GET /api/health`, indicates readiness, and shows a clear non-technical message when the backend is unavailable.

**Independent Test**: Run `pnpm dev`, confirm both addresses are reachable and `curl /api/health` returns `{"status":"ok"}` and the UI reports ready; stop the backend and confirm the UI shows a friendly "not ready" state.

### Tests for User Story 2

- [X] T031 [P] [US2] Unit test for `HealthStatusSchema` (valid + invalid bodies) in `packages/shared/src/schemas/health.test.ts`
- [X] T032 [P] [US2] Backend route test for `GET /api/health` via Fastify `app.inject` in `backend/src/api/routes/health.routes.test.ts`

### Implementation for User Story 2

- [X] T033 [P] [US2] Add `HealthStatusSchema` + inferred type in `packages/shared/src/schemas/health.ts` and export from `packages/shared/src/index.ts` (per contracts/health.md)
- [X] T034 [US2] Implement `GET /api/health` route in `backend/src/api/routes/health.routes.ts` and register it in `backend/src/app.ts`
- [X] T035 [US2] Configure `@fastify/cors` to allow the frontend dev origin in `backend/src/app.ts` (FR-008)
- [X] T036 [P] [US2] Create fetch client (base URL from `VITE_BACKEND_URL`) in `frontend/src/api/client.ts`
- [X] T037 [US2] Implement health query (TanStack Query; validate response with `HealthStatusSchema`) in `frontend/src/api/health.api.ts`
- [X] T038 [US2] Render readiness indicator and localized non-technical "app not ready" state in `frontend/src/components/layout/AppShell.tsx` (FR-010)
- [X] T039 [US2] Wire root `pnpm dev` to start backend + frontend together in root `package.json` and confirm default ports (FR-006)

**Checkpoint**: Single-command startup + verified health link work; US1 still works independently.

---

## Phase 5: User Story 3 - Build on a consistent, quality-enforced foundation (Priority: P3)

**Goal**: Project-wide type check, lint, and test commands all pass with zero errors/failures on a fresh checkout, and the shared/backend/frontend separation is verifiable.

**Independent Test**: On a fresh checkout run `pnpm typecheck`, `pnpm lint`, and `pnpm test` — each completes clean — and confirm both backend and frontend import from `@chatframe/shared`.

**Note**: This story is cross-cutting and depends on the codebase produced by Phases 1–4 existing.

- [X] T040 [P] [US3] Add a baseline sanity test for shared constants in `packages/shared/src/constants/index.test.ts` to guarantee a green test run even before feature tests grow
- [X] T041 [US3] Run `pnpm typecheck` and resolve any strict-mode errors so it completes with zero errors across all packages (FR-013, SC-005)
- [X] T042 [US3] Run `pnpm lint` and fix violations so it passes across all files (FR-014, SC-005)
- [X] T043 [US3] Run `pnpm test` and ensure all package suites pass with zero failures (FR-015, SC-005)
- [X] T044 [US3] Verify structure separation: `packages/shared`, `backend`, `frontend` are clearly separated and both backend and frontend import `@chatframe/shared` (FR-011, FR-012)

**Checkpoint**: All three stories independently functional; quality gates green.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and end-to-end validation across all stories.

- [X] T045 [P] Create root `README.md` with project description, prerequisites, setup instructions, and `dev`/`test`/`lint` commands (FR-022)
- [X] T046 Verify (DevTools Network) that only local frontend↔backend requests occur and no telemetry/external calls happen (FR-016, FR-017, SC-006)
- [X] T047 Run the full `quickstart.md` validation scenarios end-to-end and confirm all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. Frontend-only; independently testable.
- **User Story 2 (Phase 4)**: Depends on Foundational. Adds backend health + dev wiring; independently testable. Does not depend on US1.
- **User Story 3 (Phase 5)**: Cross-cutting; depends on the code from Phases 1–4 existing.
- **Polish (Phase 6)**: Depends on the desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent of US2/US3.
- **US2 (P2)**: Independent of US1 (different files: backend + `frontend/src/api`); the AppShell readiness UI (T038) touches the shell created in US1, so if both are built, sequence US1's T026 before T038.
- **US3 (P3)**: Validates the whole codebase; run after US1/US2 work exists.

### Within Each User Story

- Tests are written first and expected to fail before implementation.
- Shared schema/helpers before consumers; models/stores before components; routes before UI wiring.

### Parallel Opportunities

- Phase 1: T003, T004, T005, T006 can run in parallel.
- Phase 2: T008/T009 in parallel; T015 in parallel with backend tasks (T010–T013).
- US1: T019/T020 (tests) parallel; T021/T022/T023 (helper + dictionaries) parallel.
- US2: T031/T032 (tests) parallel; T033 and T036 parallel.
- Once Foundational completes, US1 and US2 can be built in parallel by different developers.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "Unit test direction helper in frontend/src/i18n/direction.test.ts"
Task: "Unit test useLanguageStore in frontend/src/stores/useLanguageStore.test.ts"

# i18n helper + dictionaries together:
Task: "Create direction helper in frontend/src/i18n/direction.ts"
Task: "Create English dictionary in frontend/src/i18n/en.ts"
Task: "Create Arabic dictionary in frontend/src/i18n/ar.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Test the welcome/language/direction experience independently.
5. Demo the bilingual app shell — the only end-user-facing capability of this phase.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → bilingual shell (MVP) → validate → demo.
3. US2 → single-command startup + health link → validate → demo.
4. US3 → quality gates green → validate.
5. Polish → README + no-network verification + quickstart run.

### Parallel Team Strategy

After Foundational: Developer A takes US1 (frontend language experience), Developer B takes US2 (backend health + dev wiring). US3 is performed once both land.

---

## Notes

- [P] = different files, no incomplete dependencies.
- [Story] label maps each task to its user story for traceability.
- Keep all code strict-typed; validate external/boundary data with Zod (Constitution XIV).
- No database, no telemetry, no external network beyond local frontend↔backend (Constitution I, V).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
