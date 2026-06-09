# Implementation Plan: Shared Contracts and Mock Data

**Branch**: `002-shared-contracts-mock-data` | **Date**: 2026-06-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-shared-contracts-mock-data/spec.md`

## Summary

Define all project-owned TypeScript interfaces and Zod schemas in `@chatframe/shared`
covering chat summaries, normalized messages, quality reports, connection states,
import progress, and export settings. Define a `WhatsAppAdapter` interface in the
backend. Implement a `MockAdapter` that returns synthetic fixture data (8 chats,
50–80 messages) instantly. Expose mock API endpoints and connect the frontend wizard
screens to them via TanStack Query hooks, enabling the full application flow to be
developed and demonstrated without any real WhatsApp connection.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20+

**Primary Dependencies**:
- `zod` — runtime validation at all system boundaries (Constitution XIV)
- `@tanstack/react-query` — frontend server-state management
- `fastify` — backend HTTP framework (already configured in Phase 1)
- `react-router` v7 — frontend routing (already configured in Phase 1)
- `zustand` — frontend client-state management (already configured in Phase 1)

**Storage**: Filesystem (JSON/NDJSON) — no database (Constitution V). Mock data
uses in-memory fixture arrays for this phase.

**Testing**: Vitest (already configured in Phase 1)

**Target Platform**: Desktop browser connected to local backend (Constitution XVII)

**Project Type**: Monorepo web application (pnpm workspaces)

**Performance Goals**: Mock adapter returns data instantly (no simulated delays).
Synthetic conversation sized at 50–80 messages for scenario coverage.

**Constraints**: No external network requests (Constitution I). Mock mode toggled
via `MOCK_MODE` environment variable (FR-015).

**Scale/Scope**: 8 mock chats, 50–80 messages per conversation, 6 shared type
families, 1 adapter interface, 1 mock adapter, 2 mock API endpoints, wizard
placeholder screens.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Local-First, Private by Default | ✅ PASS | No external network. Mock data is synthetic. |
| II | Personal Read-Only Usage | ✅ PASS | Adapter interface is read-only (no send/edit/delete methods). |
| III | WhatsApp-Only Scope | ✅ PASS | Adapter named `WhatsAppAdapter`. No multi-platform abstraction. |
| IV | Adapter-Based Integration | ✅ PASS | `WhatsAppAdapter` interface isolates all messaging logic. `MockAdapter` implements it. Backend code depends on interface, not library. |
| V | Filesystem Storage, No Database | ✅ PASS | Mock data is in-memory fixtures. Real storage phases use filesystem. Types support NDJSON streaming. |
| VI | Raw Data Immutability | ✅ PASS | `NormalizedMessage` is derived. `RawWhatsAppMessage` is separate. Types enforce separation. |
| VII | Accuracy Before Appearance | ✅ PASS | Frontend renders normalized data. No parsing logic in frontend. |
| VIII | Quality Reporting Is Mandatory | ✅ PASS | `QualityReport` type includes all required fields. |
| IX | Deterministic Normalization | ✅ PASS | Types support deterministic output. Normalization logic is in later phases. |
| X | HTML Is the Primary Export Source | N/A | Export implementation is in later phases. `ExportSettings` type is defined. |
| XI | WhatsApp-Like, Not WhatsApp-Owned | ✅ PASS | No brand references in types or mock data. |
| XII | Privacy Controls Before Export | ✅ PASS | `ExportSettings` includes `showContactName`, `showPhoneNumber`, `displayAlias`. |
| XIII | Session Safety | ✅ PASS | No session data in shared types. Mock adapter has no real session. |
| XIV | Strong Type Safety | ✅ PASS | All types have Zod schemas. Runtime validation at all boundaries. No `any`. |
| XV | Clear Backend/Frontend Separation | ✅ PASS | Adapter interface lives in backend. Shared types in `@chatframe/shared`. Frontend uses API client, not adapter. |
| XVI | Internationalization and Directionality | ✅ PASS | Mock data includes Arabic, English, and mixed messages. |
| XVII | Desktop-First Local Web App | ✅ PASS | Desktop browser target. |
| XVIII | Performance Through Streaming | ✅ PASS | `fetchMessages` returns `AsyncIterable`. NDJSON-friendly types. |
| XIX | Explicit Error Handling | ✅ PASS | `QualityError` and `QualityWarning` types defined. Zod validation returns structured errors. |
| XX | Testable Core Logic | ✅ PASS | `MockAdapter` enables testing without WhatsApp. Fixtures are synthetic. |
| XXI | Generated Code Must Respect Architecture | ✅ PASS | Plan follows constitution. |
| XXII | Security and Dependency Hygiene | ✅ PASS | Only `zod` is new. Established, well-maintained library. |
| XXIII | No Silent Data Loss | ✅ PASS | `unsupported` type preserves unrecognized messages. `missing` flag on images. |
| XXIV | Constitution Compliance Review | ✅ PASS | This section. |
| XXV | Amendment Procedure | N/A | No amendments needed. |

**Gate result: ALL PASS** — proceed to design.

## Project Structure

### Documentation (this feature)

```text
specs/002-shared-contracts-mock-data/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── chats.md
│   ├── preview.md
│   └── adapter.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
packages/shared/
├── src/
│   ├── constants/index.ts          # (Phase 1 — already exists)
│   ├── types/
│   │   ├── index.ts                # Re-export barrel
│   │   ├── chat.ts                 # ChatSummary
│   │   ├── message.ts              # NormalizedMessage, RawWhatsAppMessage
│   │   ├── quality.ts              # QualityReport, QualityWarning, QualityError
│   │   ├── connection.ts           # ConnectionState
│   │   ├── import.ts               # ImportProgress, ImportStage
│   │   └── export.ts               # ExportSettings
│   ├── schemas/
│   │   ├── index.ts                # Re-export barrel
│   │   ├── health.ts               # (Phase 1 — already exists)
│   │   ├── chat.ts                 # ChatSummarySchema
│   │   ├── message.ts              # NormalizedMessageSchema
│   │   ├── quality.ts              # QualityReportSchema
│   │   ├── connection.ts           # ConnectionStateSchema
│   │   ├── import.ts               # ImportProgressSchema
│   │   └── export.ts               # ExportSettingsSchema
│   └── index.ts                    # Root barrel

backend/
├── src/
│   ├── whatsapp/
│   │   ├── WhatsAppAdapter.ts      # Adapter interface
│   │   ├── MockAdapter.ts          # Mock implementation
│   │   ├── types.ts                # Adapter-internal types (RawWhatsAppMessage, etc.)
│   │   └── adapterFactory.ts       # Factory: mock vs real based on MOCK_MODE env
│   ├── api/routes/
│   │   ├── health.routes.ts        # (Phase 1 — already exists)
│   │   ├── chats.routes.ts         # GET /api/chats/private
│   │   └── preview.routes.ts       # GET /api/projects/:projectId/preview
│   ├── config/env.ts               # (Phase 1 — add MOCK_MODE)
│   ├── app.ts                      # (Phase 1 — register new routes)
│   └── server.ts                   # (Phase 1 — already exists)

frontend/
├── src/
│   ├── api/
│   │   ├── client.ts               # (Phase 1 — already exists)
│   │   ├── health.api.ts           # (Phase 1 — already exists)
│   │   ├── chats.api.ts            # TanStack Query hook for chat list
│   │   └── preview.api.ts          # TanStack Query hook for preview
│   ├── pages/
│   │   ├── WelcomePage.tsx          # (Phase 1 — already exists)
│   │   ├── NextStepPage.tsx         # (Phase 1 — replace with wizard hub)
│   │   ├── ChatPickerPage.tsx       # Wizard step: select a chat
│   │   ├── ImportPage.tsx           # Wizard step: import progress (placeholder)
│   │   ├── QualityPage.tsx          # Wizard step: quality report (placeholder)
│   │   ├── PreviewPage.tsx          # Wizard step: conversation preview
│   │   └── ExportPage.tsx           # Wizard step: export settings (placeholder)
│   ├── app/routes.tsx               # (Phase 1 — add wizard routes)
│   └── components/
│       ├── chats/
│       │   ├── ChatList.tsx         # Renders list of ChatSummary items
│       │   └── ChatListItem.tsx     # Single chat row
│       └── preview/
│           ├── MessageBubble.tsx    # Renders a NormalizedMessage
│           ├── DateSeparator.tsx    # Date grouping header
│           └── ConversationPreview.tsx  # Scrollable message list

tests/
└── fixtures/
    ├── mock-chat-list.ts           # 8 synthetic ChatSummary objects
    ├── mock-messages.ts            # 50–80 NormalizedMessage objects
    └── mock-quality-report.ts      # Synthetic QualityReport
```

**Structure Decision**: Extends the existing Phase 1 monorepo (`packages/shared/`,
`backend/`, `frontend/`). New files are added within existing package directories.
The `tests/fixtures/` directory at root holds shared synthetic test data.

## Complexity Tracking

No constitution violations to justify. All gates pass.
