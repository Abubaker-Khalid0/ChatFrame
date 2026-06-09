# Research: Shared Contracts and Mock Data

**Feature**: `002-shared-contracts-mock-data`
**Date**: 2026-06-09

## Research Topics

### 1. Zod Schema Design Patterns for Shared Contracts

**Decision**: Use Zod schemas as the single source of truth for both TypeScript
types (via `z.infer<>`) and runtime validation. Each schema file mirrors a type
file in `packages/shared/src/schemas/`.

**Rationale**:
- Zod is already a project dependency (used for `HealthStatusSchema` in Phase 1).
- `z.infer<>` eliminates type/schema drift — the TypeScript type is always
  derived from the schema, not duplicated alongside it.
- Zod provides structured error output (`ZodError`) with per-field path info,
  satisfying FR-012's "human-readable reason that identifies which field failed."
- Zod schemas compose well (`.extend()`, `.pick()`, `.merge()`) for future
  evolution.

**Alternatives considered**:
- **io-ts**: More verbose, smaller ecosystem, less ergonomic error messages.
- **Separate interfaces + manual validation**: High drift risk, violates
  Constitution XIV requirement for runtime validation at boundaries.
- **JSON Schema + ajv**: Good for cross-language, but overkill for an all-TypeScript
  monorepo. Zod is more idiomatic.

### 2. Adapter Interface Design for WhatsApp Isolation

**Decision**: Define a `WhatsAppAdapter` TypeScript interface in
`backend/src/whatsapp/WhatsAppAdapter.ts`. The interface exposes normalized
capabilities (list chats, fetch messages, download images, connection lifecycle)
without any `whatsapp-web.js` types leaking through.

**Rationale**:
- Constitution IV mandates adapter-based isolation. The rest of the app depends
  on this interface, not the library.
- Using `AsyncIterable<RawWhatsAppMessage>` for message fetching supports
  streaming (Constitution XVIII) and lets the mock adapter yield messages
  synchronously from fixtures.
- Separating `RawWhatsAppMessage` (adapter-internal type) from `NormalizedMessage`
  (shared type) enforces Constitution VI's raw/normalized separation.

**Alternatives considered**:
- **Abstract class instead of interface**: Adds unnecessary coupling. Pure
  interface is simpler and sufficient.
- **Generic `ChatAdapter` interface**: Violates Constitution III (WhatsApp-only
  scope). Named `WhatsAppAdapter` deliberately.
- **Event-based adapter (EventEmitter)**: Less testable, harder to type.
  Callback-based `onQr` and `onStateChange` are sufficient for the event-like
  needs.

### 3. Mock Adapter Strategy

**Decision**: `MockAdapter` implements `WhatsAppAdapter` using static fixture
arrays imported from `tests/fixtures/`. It returns data instantly (no simulated
delays). Selected via `adapterFactory.ts` based on `MOCK_MODE` environment variable.

**Rationale**:
- Instant response simplifies development and testing. Delays can be added
  later if needed for UX testing (per clarification Q5).
- Environment variable toggle (per clarification Q1) means no source code
  changes to switch between mock and real.
- Fixtures live in `tests/fixtures/` at the repo root, shared between backend
  tests and the mock adapter.

**Alternatives considered**:
- **Inline fixture data in MockAdapter**: Harder to reuse in unit tests.
  Shared fixtures are better.
- **Auto-detect mode (mock if no session exists)**: Too magical. Explicit env
  var is clearer and safer.
- **Separate mock server process**: Overkill for a local-first app. In-process
  mock adapter is simpler.

### 4. Fixture Data Design

**Decision**: Create 8 culturally authentic mock chats and a single conversation
with 50–80 messages covering all 19 scenarios from FR-010. Use realistic Arabic
and English names, plausible timestamps spanning 3+ days, and varied message
content.

**Rationale**:
- 8 chats is enough to fill the screen and test search without over-engineering
  (per clarification Q2).
- 50–80 messages gives room for all 19 required scenarios plus natural flow
  padding (per clarification Q3).
- Culturally authentic content makes demos and QA believable (per clarification
  Q4).
- Spanning 3+ days ensures multiple date separators appear naturally.

**Alternatives considered**:
- **Random/generated fixture data**: Less predictable for visual testing. Static
  fixtures give deterministic, reviewable results.
- **Minimal 20-message fixture**: Too tight to cover all 19 scenarios plus
  consecutive-sender and date-separator scenarios naturally.

### 5. Mock API Endpoint Design

**Decision**: Two mock endpoints powered by the MockAdapter:
- `GET /api/chats/private` — returns the 8-chat fixture list.
- `GET /api/projects/:projectId/preview` — returns the mock conversation as a
  render-ready message array.

**Rationale**:
- These are the minimum endpoints needed for the frontend wizard to display
  the chat picker and conversation preview.
- Using the same API shape that real endpoints will use ensures the frontend
  API client code is production-ready from the start.
- The `:projectId` parameter is a placeholder in this phase (mock adapter
  ignores it) but establishes the URL contract for later phases.

**Alternatives considered**:
- **GraphQL**: Not in the approved baseline stack. REST is simpler for this
  project.
- **More endpoints (import, export, quality)**: These screens are placeholders
  in this phase. Adding API endpoints for them can wait until Phase 3+.

### 6. Frontend Wizard Routing

**Decision**: Extend existing React Router v7 configuration with wizard step
routes: `/chat-picker`, `/import`, `/quality`, `/preview`, `/export`. Each
route renders a dedicated page component. Chat picker and preview pages use
TanStack Query hooks to fetch mock data. Other pages are placeholders.

**Rationale**:
- Establishing all wizard routes now ensures navigation flow is testable even
  before real data exists.
- TanStack Query provides caching, loading states, and error handling out of
  the box, matching the constitution's error handling requirements (XIX).
- Placeholder pages avoid premature UI work while providing navigation targets.

**Alternatives considered**:
- **Single-page wizard with step state**: Less intuitive for bookmarking and
  browser back. Route-per-step is standard.
- **Building only the pages that have data**: Leaves gaps in the wizard flow
  that make demos incomplete.
