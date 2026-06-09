# ChatFrame — MVP Implementation Plan

> **Version**: 1.1.0 · **Date**: 2026-06-09 · **Status**: Draft
> **Constitution**: v1.0.0 · **Scope**: One-to-one WhatsApp chats only

---

## Table of Contents

**Part I — Overview**

1. [Project Overview](#1-project-overview)
2. [MVP Scope](#2-mvp-scope)
3. [Technical Stack](#3-technical-stack)
4. [User Flow](#4-user-flow)

**Part II — Phases**

5. [Phase 1: Repository Foundation and Tooling](#5-phase-1-repository-foundation-and-tooling)
6. [Phase 2: Shared Contracts and Mock Data](#6-phase-2-shared-contracts-and-mock-data)
7. [Phase 3: Project Folder Storage](#7-phase-3-project-folder-storage)
8. [Phase 4: Normalization Engine](#8-phase-4-normalization-engine)
9. [Phase 5: WhatsApp Session Integration](#9-phase-5-whatsapp-session-integration)
10. [Phase 6: Real Chat Listing](#10-phase-6-real-chat-listing)
11. [Phase 7: Real Message and Image Import](#11-phase-7-real-message-and-image-import)
12. [Phase 8: WhatsApp-Like Preview](#12-phase-8-whatsapp-like-preview)
13. [Phase 9: HTML Export](#13-phase-9-html-export)
14. [Phase 10: Hardening, QA, and MVP Polish](#14-phase-10-hardening-qa-and-mvp-polish)

**Part III — Governance**

15. [Constitution Compliance Matrix](#15-constitution-compliance-matrix)
16. [Risks and Mitigations](#16-risks-and-mitigations)
17. [Non-Negotiable Implementation Rules](#17-non-negotiable-implementation-rules)
18. [Acceptance Criteria](#18-acceptance-criteria)
19. [MVP Completion Checklist](#19-mvp-completion-checklist)

---

# Part I — Overview

---

## 1. Project Overview

**Project Name:** ChatFrame
**Product Type:** Local-first desktop web application
**Primary Goal:** Export a personal one-to-one WhatsApp conversation into a
visually accurate, WhatsApp-like HTML archive.

ChatFrame allows the user to connect WhatsApp locally via QR, select one
private chat, import messages and images, preview the conversation in a
WhatsApp-like layout, apply privacy options, and export the result as an
offline HTML folder with local assets.

**Disclaimer shown at connection:**
> ChatFrame uses an unofficial local WhatsApp Web integration. Use it at
> your own risk. The app is read-only and does not send messages.

---

## 2. MVP Scope

### 2.1 Included

| Category | Details |
|---|---|
| **Platform** | Local web app only, desktop-first |
| **Chat platform** | WhatsApp only |
| **Chat type** | One-to-one chats only |
| **Languages** | Arabic (RTL) and English (LTR) |
| **WhatsApp library** | `whatsapp-web.js` behind adapter interface |
| **Session** | Local persistence, restore, logout/unlink |
| **Chat picker** | One-to-one chats only, search by name/phone |
| **Import: text** | Required — text messages, reply metadata, deleted/edited states |
| **Import: images** | Optional — image messages with captions |
| **Storage** | Filesystem only — raw + normalized separation |
| **Quality report** | Generated after every import/normalization |
| **Preview** | WhatsApp-like, light/dark, virtual scrolling |
| **Privacy** | Show/hide name, show/hide phone, optional alias, fake avatar |
| **Export** | HTML folder with local assets, optional watermark |
| **Infrastructure** | No database, no cloud, no login, no telemetry |

### 2.2 Explicitly Excluded

The following MUST NOT be implemented unless a future feature specification
introduces them:

- PDF / PNG / ZIP export
- Group chats
- Audio, video, document, sticker, poll, location, or contact card messages
- Baileys or OpenWA adapters
- Opening or managing previous projects
- Date range filtering
- Full project encryption or image blurring
- Single-file base64 HTML export
- Dashboard for previous projects
- CLI, Electron/Tauri wrapper, hosted SaaS, user accounts

---

## 3. Technical Stack

### 3.1 Backend

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript (strict mode) |
| Framework | Fastify |
| WhatsApp adapter | `whatsapp-web.js` |
| Validation | Zod (runtime, at all system boundaries) |
| Logging | Pino |
| Storage | Filesystem — JSON + NDJSON |
| Testing | Vitest |

### 3.2 Frontend

| Component | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + custom CSS (chat renderer) |
| Routing | React Router v7 |
| Server state | TanStack Query |
| Client state | Zustand |
| RTL/LTR | Intentional layout-level handling |
| Testing | Vitest + React Testing Library |

### 3.3 Shared

| Component | Technology |
|---|---|
| Package manager | pnpm workspaces |
| Shared types | `packages/shared/` workspace package |
| Fonts: English | Inter (with system fallbacks) |
| Fonts: Arabic | IBM Plex Sans Arabic (with system fallbacks) |

### 3.4 Export

| Component | Details |
|---|---|
| Format | HTML folder with local `assets/` directory |
| Media | Copied image files — no base64 embedding |
| Fonts | Bundled locally or safe system fallbacks |
| Offline | Fully functional without backend running |

### 3.5 Ports (Defaults)

| Service | Port | Configurable via |
|---|---|---|
| Backend (Fastify) | 3714 | `.env` |
| Frontend (Vite dev) | 5173 | `.env` |

---

## 4. User Flow

The MVP user flow is a linear wizard. One active project at a time.

```text
Open ChatFrame in browser
  ↓
Welcome screen → Choose language (Arabic / English)
  ↓
Connect WhatsApp → Scan QR code
  ↓
Connection successful → Disclaimer acknowledged
  ↓
Chat picker → Select one-to-one chat
  ↓
Import options → Choose text-only or text + images
  ↓
Import progress → Real-time status via SSE
  ↓
Quality report → Review import accuracy
  ↓
Preview → WhatsApp-like conversation view
  ↓
Export settings → Privacy options + watermark toggle
  ↓
Export HTML folder → Open in browser
```

---

# Part II — Phases

Each phase is self-contained. It includes the architecture, data models,
API endpoints, screen specs, file structures, and tests relevant to that
phase. Earlier phases MUST be complete before starting later phases.

```text
Phase 1 ─── Foundation & Tooling
Phase 2 ─── Shared Contracts & Mock Data
Phase 3 ─── Project Folder Storage
Phase 4 ─── Normalization Engine
Phase 5 ─── WhatsApp Session Integration
Phase 6 ─── Real Chat Listing
Phase 7 ─── Real Message & Image Import
Phase 8 ─── WhatsApp-Like Preview
Phase 9 ─── HTML Export
Phase 10 ── Hardening, QA, & MVP Polish
```

---

## 5. Phase 1: Repository Foundation and Tooling

**Goal:** Create a stable full-stack TypeScript monorepo with all tooling
configured and a working app shell with i18n support.

### 5.1 Repository Structure

ChatFrame uses a **pnpm workspace monorepo** with three packages:

```text
chatframe/
├── pnpm-workspace.yaml
├── package.json                  # root scripts: dev, build, test, lint
├── tsconfig.base.json            # shared TypeScript configuration
├── .env.example
├── .gitignore
│
├── packages/
│   └── shared/                   # @chatframe/shared
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── types/
│           │   ├── chat.ts       # ChatSummary
│           │   ├── message.ts    # NormalizedMessage, RawWhatsAppMessage
│           │   ├── quality.ts    # QualityReport
│           │   ├── render.ts     # RenderModel, RenderMessage
│           │   ├── project.ts    # ProjectManifest
│           │   ├── session.ts    # ConnectionState
│           │   ├── import.ts     # ImportProgress, ImportOptions
│           │   └── export.ts     # ExportSettings, ExportResult
│           ├── schemas/          # Zod schemas matching each type
│           └── constants/        # Shared constants, enums
│
├── backend/                      # @chatframe/backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts                # Fastify app factory
│       ├── server.ts             # Entry point
│       ├── config/
│       │   ├── paths.ts          # Workspace and project paths
│       │   └── env.ts            # Environment config
│       ├── api/
│       │   ├── routes/
│       │   │   ├── session.routes.ts
│       │   │   ├── chats.routes.ts
│       │   │   ├── projects.routes.ts
│       │   │   ├── import.routes.ts
│       │   │   ├── preview.routes.ts
│       │   │   ├── export.routes.ts
│       │   │   └── media.routes.ts
│       │   └── schemas/          # Route-specific Zod schemas
│       ├── whatsapp/
│       │   ├── WhatsAppAdapter.ts          # Interface
│       │   ├── WhatsappWebJsAdapter.ts     # Implementation
│       │   ├── MockAdapter.ts              # Development/testing
│       │   ├── types.ts                    # Adapter-internal types
│       │   └── sessionStore.ts
│       ├── projects/
│       │   ├── ProjectStore.ts
│       │   ├── ProjectPaths.ts
│       │   └── ProjectManifest.ts
│       ├── storage/
│       │   ├── NdjsonWriter.ts
│       │   ├── NdjsonReader.ts
│       │   ├── JsonFile.ts
│       │   └── MediaStore.ts
│       ├── import/
│       │   ├── ImportOrchestrator.ts
│       │   ├── MessageFetcher.ts
│       │   ├── ImageDownloader.ts
│       │   └── ImportProgress.ts
│       ├── normalize/
│       │   ├── normalizeMessage.ts
│       │   ├── dedupeMessages.ts
│       │   ├── resolveReplies.ts
│       │   ├── resolveParticipants.ts
│       │   ├── normalizeTimestamp.ts
│       │   └── buildQualityReport.ts
│       ├── render/
│       │   ├── buildRenderModel.ts
│       │   └── renderTypes.ts
│       ├── export/
│       │   ├── HtmlExporter.ts
│       │   └── templates/
│       │       └── chatframe-html/
│       │           ├── template.html
│       │           └── style.css
│       ├── security/
│       │   ├── sanitizeForLog.ts
│       │   └── sessionProtection.ts
│       └── utils/
│           ├── hash.ts
│           ├── fileNames.ts
│           ├── logger.ts
│           └── errors.ts
│
├── frontend/                     # @chatframe/frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── app/
│       │   ├── routes.tsx
│       │   └── providers.tsx
│       ├── i18n/
│       │   ├── ar.ts
│       │   ├── en.ts
│       │   └── direction.ts
│       ├── stores/               # Zustand stores
│       │   ├── useLanguageStore.ts
│       │   ├── useProjectStore.ts
│       │   └── useExportStore.ts
│       ├── api/                  # TanStack Query + fetch
│       │   ├── client.ts
│       │   ├── session.api.ts
│       │   ├── chats.api.ts
│       │   ├── import.api.ts
│       │   ├── preview.api.ts
│       │   ├── export.api.ts
│       │   └── events.ts         # SSE client
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx
│       │   │   ├── StepHeader.tsx
│       │   │   └── LanguageSwitcher.tsx
│       │   ├── session/
│       │   │   ├── QrPanel.tsx
│       │   │   ├── ConnectionStatus.tsx
│       │   │   └── DisclaimerBanner.tsx
│       │   ├── chats/
│       │   │   ├── ChatSearch.tsx
│       │   │   ├── ChatList.tsx
│       │   │   └── ChatListItem.tsx
│       │   ├── import/
│       │   │   ├── ImportOptions.tsx
│       │   │   └── ImportProgress.tsx
│       │   ├── quality/
│       │   │   ├── QualitySummary.tsx
│       │   │   └── QualityIssueList.tsx
│       │   ├── preview/
│       │   │   ├── ConversationPreview.tsx
│       │   │   ├── MessageBubble.tsx
│       │   │   ├── ReplyPreview.tsx
│       │   │   ├── DateSeparator.tsx
│       │   │   ├── ImageMessage.tsx
│       │   │   └── UnsupportedMessage.tsx
│       │   └── export/
│       │       ├── ExportSettings.tsx
│       │       └── ExportComplete.tsx
│       ├── styles/
│       │   ├── globals.css
│       │   └── chat-renderer.css
│       └── types/
│           └── ui.ts             # Frontend-only UI types
│
├── docs/
│   └── implementation-plan.md    # This file
│
└── tests/
    └── fixtures/                 # Shared synthetic test data
        ├── mock-chat-list.json
        ├── mock-raw-messages.ndjson
        ├── mock-normalized-messages.ndjson
        └── mock-render-model.json
```

### 5.2 Backend Foundation

**Tasks:**
- Initialize `backend/` package with Fastify + TypeScript (strict mode).
- Add Pino logger.
- Configure environment loading from `.env` (port 3714 default).
- Create `GET /api/health` endpoint.
- Add CORS configuration for frontend dev server origin.

### 5.3 Frontend Foundation

**Tasks:**
- Initialize `frontend/` package with React 19 + Vite + TypeScript (strict mode).
- Add Tailwind CSS.
- Add Inter and IBM Plex Sans Arabic fonts.
- Set up React Router v7 with placeholder wizard routes.
- Set up Zustand stores: `useLanguageStore` (language + direction).
- Set up TanStack Query provider.
- Create `AppShell` layout component.
- Create `LanguageSwitcher` component.

**Screen: Welcome / Language**

| Requirement | Details |
|---|---|
| Languages | Arabic (RTL) and English (LTR) |
| Persistence | Selected language stored locally (Zustand → localStorage) |
| Copy | Clearly state that ChatFrame runs locally and is read-only |
| Typography | Inter (English) / IBM Plex Sans Arabic (Arabic) |

**Actions:** Choose language → Continue

### 5.4 Shared Package Foundation

**Tasks:**
- Initialize `packages/shared/` with TypeScript.
- Create placeholder `index.ts` exporting type stubs.
- Wire pnpm workspace references so backend and frontend can import
  from `@chatframe/shared`.

### 5.5 Tooling

**Tasks:**
- Configure `pnpm-workspace.yaml`.
- Configure `tsconfig.base.json` shared by all packages.
- Add ESLint and Prettier with shared config.
- Configure Vitest for all packages.
- Add root `package.json` scripts: `dev`, `build`, `test`, `lint`.
- Configure `.env.example` with default ports.

### 5.6 Definition of Done

- [ ] `pnpm dev` starts both backend (port 3714) and frontend (port 5173).
- [ ] Frontend calls backend health endpoint successfully.
- [ ] Strict TypeScript — zero errors across all packages.
- [ ] Arabic RTL and English LTR switch works.
- [ ] Basic app shell visible in browser with language selection.
- [ ] Vitest runs with zero failures.
- [ ] ESLint + Prettier pass on all files.

---

## 6. Phase 2: Shared Contracts and Mock Data

**Goal:** Define all project-owned types, create mock data and a mock
adapter, then power the entire UI flow with fake data — before any
WhatsApp connection.

### 6.1 Shared Types (`packages/shared/src/types/`)

#### ChatSummary

```typescript
export interface ChatSummary {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  isGroup: boolean;
  lastMessagePreview?: string;
  lastMessageAt?: string;       // ISO 8601
}
```

#### NormalizedMessage

```typescript
export interface NormalizedMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderDisplayName?: string;
  isFromMe: boolean;

  type: 'text' | 'image' | 'deleted' | 'unsupported';

  body?: string;
  timestampOriginal?: string;   // preserved from source
  timestampIso: string;         // normalized ISO 8601
  dateKey: string;              // YYYY-MM-DD for date separators

  status?: 'sent' | 'delivered' | 'read' | 'unknown';

  isEdited?: boolean;
  isDeleted?: boolean;

  replyTo?: {
    messageId?: string;
    resolved: boolean;
    previewText?: string;
    previewType?: string;
  };

  image?: {
    mediaId: string;
    localPath: string;          // path within project media/
    exportPath: string;         // relative path in export assets/
    mimeType?: string;
    width?: number;
    height?: number;
    sizeBytes?: number;
    caption?: string;
    missing?: boolean;
  };

  unsupported?: {
    originalType: string;
    reason: string;
  };
}
```

#### QualityReport

```typescript
export interface QualityReport {
  projectId: string;
  generatedAt: string;          // ISO 8601

  totalRawMessages: number;
  totalNormalizedMessages: number;
  duplicatesRemoved: number;

  unresolvedReplies: number;
  missingImages: number;

  unsupportedMessageTypes: Record<string, number>;

  dateRange: {
    from: string | null;        // ISO 8601
    to: string | null;
  };

  warnings: QualityWarning[];
  errors: QualityError[];
}

export interface QualityWarning {
  code: string;
  message: string;
  messageId?: string;
  count?: number;
}

export interface QualityError {
  code: string;
  message: string;
  fatal: boolean;
}
```

#### ConnectionState

```typescript
export type ConnectionState =
  | 'disconnected'
  | 'initializing'
  | 'waiting_for_qr'
  | 'qr_ready'
  | 'connecting'
  | 'connected'
  | 'session_expired'
  | 'connection_failed';
```

#### ImportProgress

```typescript
export interface ImportProgress {
  importId: string;
  projectId: string;
  stage: ImportStage;
  messagesImported: number;
  messagesTotal?: number;
  imagesDownloaded: number;
  imagesTotal?: number;
  warnings: string[];
  startedAt: string;
  completedAt?: string;
}

export type ImportStage =
  | 'preparing_project'
  | 'fetching_metadata'
  | 'fetching_messages'
  | 'saving_raw_messages'
  | 'downloading_images'
  | 'normalizing'
  | 'resolving_replies'
  | 'generating_quality_report'
  | 'preparing_preview'
  | 'completed'
  | 'failed'
  | 'cancelled';
```

#### ExportSettings

```typescript
export interface ExportSettings {
  showContactName: boolean;
  showPhoneNumber: boolean;
  displayAlias?: string;
  showWatermark: boolean;
  theme: 'light' | 'dark';
}
```

### 6.2 Zod Schemas (`packages/shared/src/schemas/`)

Add Zod schemas matching every type above. These are used for runtime
validation at API boundaries, adapter outputs, and storage reads
(Constitution XIV).

### 6.3 WhatsApp Adapter Interface

Define the adapter interface in `backend/src/whatsapp/WhatsAppAdapter.ts`.
All WhatsApp-specific code MUST sit behind this interface (Constitution IV).

```typescript
export interface WhatsAppAdapter {
  initialize(): Promise<void>;
  getConnectionState(): ConnectionState;
  onQr(callback: (qr: string) => void): void;
  onStateChange(callback: (state: ConnectionState) => void): void;
  listPrivateChats(): Promise<ChatSummary[]>;
  fetchMessages(
    chatId: string,
    options: FetchMessagesOptions,
  ): AsyncIterable<RawWhatsAppMessage>;
  downloadImage(
    message: RawWhatsAppMessage,
  ): Promise<DownloadedMedia | null>;
  logout(): Promise<void>;
  destroy(): Promise<void>;
}
```

### 6.4 Mock Adapter

Create `MockAdapter` implementing `WhatsAppAdapter`. It returns synthetic
fixture data without connecting to WhatsApp (Constitution XX).

### 6.5 Mock Conversation Fixture

A synthetic mock conversation MUST be created. It powers development and
testing of the preview, export, and normalization pipeline.

The mock conversation MUST include:

| Scenario | Purpose |
|---|---|
| Arabic text message | RTL rendering |
| English text message | LTR rendering |
| Mixed Arabic/English message | BiDi handling |
| Emoji-only message | Emoji rendering |
| Outgoing message | Right-aligned bubble |
| Incoming message | Left-aligned bubble |
| Image message | Image inside bubble |
| Image with caption | Caption below image |
| Reply to text | Quoted block rendering |
| Reply to image | Image reference in quote |
| Unresolved reply | Missing reference handling |
| Deleted message | Deleted indicator |
| Edited message | Edited label |
| Unsupported message type | Unsupported card |
| Multiple date separators | Date grouping |
| Long message (500+ chars) | Text wrapping |
| Missing image placeholder | Placeholder rendering |
| Consecutive same-sender messages | Grouped bubble styling |
| Timestamp with seconds | HH:MM:SS format |

### 6.6 Mock API Endpoints

Build mock backend endpoints powered by fixtures:
- `GET /api/chats/private` → returns mock chat list.
- `GET /api/projects/:projectId/preview` → returns mock render model.

### 6.7 Frontend: API Client and Wizard Flow

**Tasks:**
- Build API client layer using TanStack Query hooks.
- Build basic wizard routing (placeholder screens for each step).
- Render mock chat list in chat picker screen placeholder.
- Render mock conversation in preview screen placeholder.

### 6.8 Definition of Done

- [ ] All shared types defined in `@chatframe/shared` with Zod schemas.
- [ ] `WhatsAppAdapter` interface defined.
- [ ] `MockAdapter` implemented with synthetic fixture data.
- [ ] Mock data powers full UI flow — no WhatsApp connection needed.
- [ ] Frontend and backend agree on shared contracts.
- [ ] Mock data covers all scenarios from the fixture table above.

---

## 7. Phase 3: Project Folder Storage

**Goal:** Implement local filesystem storage with clear separation between
raw, normalized, and export data.

### 7.1 Project Folder Structure

Each import creates a self-contained project folder (Constitution V, VI):

```text
workspace/
  projects/
    chatframe_2026-06-09_ahmed/     # auto-generated, user can rename
      project.json                  # manifest: id, name, created, chat info
      source.json                   # source metadata: adapter, chat ID

      raw/                          # IMMUTABLE — never modified after write
        messages.raw.ndjson         # raw adapter messages (streaming format)
        media.raw.ndjson            # raw media metadata

      normalized/                   # DERIVED — regeneratable from raw/
        messages.ndjson             # normalized messages
        participants.json           # participant info
        media.json                  # media linking index
        quality-report.json         # quality report

      media/
        images/                     # downloaded image files
          img_000001.jpg
          img_000002.jpg

      exports/
        html/
          conversation.html
          assets/
            style.css
            fonts/                  # bundled fonts for offline use
            media/
              img_000001.jpg
              img_000002.jpg

      logs/
        import.log
        normalization.log
```

### 7.2 Project Naming

Auto-generated: `chatframe_YYYY-MM-DD_<contact-name-slug>`

The user can optionally rename the project via the API after creation.

### 7.3 Storage Rules

| Rule | Constitution Ref |
|---|---|
| Raw files are **immutable** — never overwritten | VI |
| Normalized files are **derived** — regeneratable from raw | VI |
| Export files are **derived** — regeneratable from normalized | VI |
| Session files NEVER stored inside project folders | XIII |
| Logs MUST NOT contain QR codes, tokens, or secrets | XIII, XIX |
| Message content MUST NOT be logged unless for local debugging | I |
| Large collections use NDJSON, not monolithic JSON | V, XVIII |

### 7.4 Backend Modules

| Module | File | Responsibility |
|---|---|---|
| `ProjectStore` | `projects/ProjectStore.ts` | Create, read, rename projects |
| `ProjectPaths` | `projects/ProjectPaths.ts` | Deterministic path generation |
| `ProjectManifest` | `projects/ProjectManifest.ts` | `project.json` read/write |
| `NdjsonWriter` | `storage/NdjsonWriter.ts` | Streaming NDJSON append |
| `NdjsonReader` | `storage/NdjsonReader.ts` | Streaming NDJSON read |
| `JsonFile` | `storage/JsonFile.ts` | JSON read/write with Zod validation |
| `MediaStore` | `storage/MediaStore.ts` | Image save/retrieve |

### 7.5 API Endpoints Introduced

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects` | Create a new project |
| `GET` | `/api/projects/:projectId` | Get project manifest |
| `PATCH` | `/api/projects/:projectId` | Rename project |

### 7.6 Frontend Updates

- Add project creation flow placeholder.
- Display current project status.
- Connect to project API via TanStack Query.

### 7.7 Tests

- Project path generation (deterministic naming).
- NDJSON write + read round-trip.
- NDJSON streaming with large files.
- `JsonFile` read/write with Zod validation.
- Raw/normalized directory separation enforcement.

### 7.8 Definition of Done

- [ ] Backend creates well-structured project folders.
- [ ] NDJSON streaming works for large files.
- [ ] Raw and normalized directories are strictly separate.
- [ ] Project CRUD API endpoints work.
- [ ] Tests cover all storage operations.

---

## 8. Phase 4: Normalization Engine

**Goal:** Build the core backend intelligence — the normalization pipeline
that transforms raw messages into normalized, renderable data. Fully
testable without WhatsApp.

### 8.1 Normalization Pipeline

The pipeline runs after raw import and MUST be deterministic
(Constitution IX). Given the same raw input and normalization version, the
output MUST be identical.

```text
Read raw messages (NDJSON stream)
  ↓
Validate raw message shape (Zod)
  ↓
Map to NormalizedMessage
  ↓
Normalize timestamps (preserve original + derive ISO)
  ↓
Sort messages by normalized timestamp
  ↓
Deduplicate (prefer most complete record)
  ↓
Resolve replies (best-effort, report unresolved)
  ↓
Link images (match media IDs to local files)
  ↓
Mark unsupported messages (preserve, never drop)
  ↓
Generate quality report
  ↓
Build render model
```

**Rules:**
- MUST NOT silently drop any message (Constitution XXIII).
- Unsupported messages remain visible with type + reason.
- Missing images remain visible with placeholder.
- Reply resolution is best-effort; unresolved count goes to quality report.
- Deduplication prefers the most complete message record.
- All logic MUST be testable without WhatsApp (Constitution XX).

### 8.2 Backend Modules

| Module | File | Responsibility |
|---|---|---|
| `normalizeMessage` | `normalize/normalizeMessage.ts` | Raw → normalized mapping |
| `normalizeTimestamp` | `normalize/normalizeTimestamp.ts` | Preserve original + derive ISO |
| `dedupeMessages` | `normalize/dedupeMessages.ts` | Prefer most complete record |
| `resolveReplies` | `normalize/resolveReplies.ts` | Best-effort reply linking |
| `resolveParticipants` | `normalize/resolveParticipants.ts` | Sender identity resolution |
| `buildQualityReport` | `normalize/buildQualityReport.ts` | Quality report generation |
| `buildRenderModel` | `render/buildRenderModel.ts` | Render model from normalized data |

### 8.3 Quality Report (Constitution VIII)

Every import/normalization MUST produce a report containing:

| Metric | Description |
|---|---|
| Total raw messages | Count before processing |
| Total normalized messages | Count after normalization |
| Duplicates removed | Count of deduplicated messages |
| Unresolved replies | Replies that couldn't be linked |
| Missing images | Images that failed to download |
| Unsupported message types | By type with counts |
| Date range | From / to |
| Warnings | Non-fatal issues |
| Errors | Fatal issues |

### 8.4 Screen: Quality Report

**Purpose:** Give the user confidence that the import was analyzed
accurately.

**Behavior:**
- Warnings MUST NOT block export.
- Fatal errors MUST block export.
- Missing images show placeholders in preview/export.

**Actions:** Continue to Preview · View Details · Back

### 8.5 Frontend Updates

- Update preview screen to consume real render model structure.
- Build `QualitySummary` and `QualityIssueList` components.
- Build `UnsupportedMessage` card component.
- Build missing image placeholder component.

### 8.6 Tests

- Message normalization (each field mapping).
- Timestamp normalization (original preserved + ISO derived).
- Sorting correctness.
- Deduplication (most complete record preferred).
- Reply resolution (resolved, unresolved, edge cases).
- Missing image handling.
- Quality report field accuracy.
- Unsupported message preservation.
- Determinism: same input → same output.

### 8.7 Definition of Done

- [ ] Synthetic raw messages → normalized → render model pipeline works.
- [ ] Quality report generated with all required fields.
- [ ] Frontend renders render model accurately.
- [ ] No frontend parsing of raw messages.
- [ ] All normalization tests passing.

---

## 9. Phase 5: WhatsApp Session Integration

**Goal:** Connect to WhatsApp locally using `whatsapp-web.js`, display QR
code, manage session lifecycle.

### 9.1 WhatsApp Adapter: `WhatsappWebJsAdapter`

Implements the `WhatsAppAdapter` interface defined in Phase 2.

**Rules:**
- MUST NOT leak `whatsapp-web.js` types into core modules (Constitution IV).
- MUST map library messages into project-owned `RawWhatsAppMessage` type.
- MUST preserve adapter-specific raw payload separately.
- MUST NOT expose message-sending methods (Constitution II).
- MUST use `AsyncIterable` for message fetching (Constitution XVIII).

### 9.2 Session Lifecycle

```text
Disconnected
  ↓ user clicks "Connect"
Initializing
  ↓ library ready
Waiting for QR → QR Ready
  ↓ user scans
Connecting
  ↓ authenticated
Connected
```

**Session restore:** If a saved session exists, the backend MAY attempt
silent restore. If restore fails, transition to `session_expired` state.

**Logout:** `POST /api/session/logout` clears session files and
transitions to `disconnected`.

### 9.3 Session Safety (Constitution XIII)

- Session storage MUST be treated as protected local data.
- Session files MUST NOT be included in exports, logs, or archives.
- QR codes, tokens, and session secrets MUST NOT be logged.
- The application MUST provide a clear Logout / Unlink Session action.

### 9.4 API Endpoints Introduced

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/session/connect` | Start WhatsApp connection |
| `GET` | `/api/session/status` | Get current connection state |
| `POST` | `/api/session/logout` | Logout and clear session |

### 9.5 Real-Time Events (SSE)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events` | SSE stream for real-time updates |

**Event types introduced in this phase:**

```text
session.state          session.qr
```

### 9.6 Screen: WhatsApp Connection

**Purpose:** Start WhatsApp connection, display QR code, show status.

**Connection states:**

| State | UI Behavior |
|---|---|
| `disconnected` | Show "Connect WhatsApp" button |
| `initializing` | Show loading spinner |
| `waiting_for_qr` | Display QR code with scan instructions |
| `qr_ready` | QR code visible — user scans |
| `connecting` | QR scanned — establishing session |
| `connected` | Success — proceed to chat picker |
| `session_expired` | Show reconnect action |
| `connection_failed` | Show error + retry action |

**Requirements:**
- User MUST manually start connection.
- QR code MUST only appear in the UI — never logged.
- Display disclaimer banner at top of screen.
- Provide clear instructions: Open WhatsApp → Linked Devices → Scan QR.

**Actions:** Connect · Reconnect · Logout / Unlink Session

### 9.7 Frontend Components

- `QrPanel` — displays QR code from SSE events.
- `ConnectionStatus` — shows current state with appropriate UI.
- `DisclaimerBanner` — displays risk disclaimer.

### 9.8 Backend Modules

| Module | File | Responsibility |
|---|---|---|
| `WhatsappWebJsAdapter` | `whatsapp/WhatsappWebJsAdapter.ts` | Library implementation |
| `sessionStore` | `whatsapp/sessionStore.ts` | Session file management |
| `sessionProtection` | `security/sessionProtection.ts` | Session file safeguards |
| `sanitizeForLog` | `security/sanitizeForLog.ts` | Prevent secret leakage |

### 9.9 Definition of Done

- [ ] User can scan QR and establish connection.
- [ ] Connection state updates live via SSE.
- [ ] Session restores on app restart.
- [ ] Logout clears session files.
- [ ] Disclaimer banner visible.
- [ ] No QR codes or tokens in any log output.
- [ ] No send-message methods exposed.

---

## 10. Phase 6: Real Chat Listing

**Goal:** List one-to-one WhatsApp chats from a live connection.

### 10.1 Backend Tasks

- Implement `listPrivateChats` in `WhatsappWebJsAdapter`:
  - Fetch all chats from WhatsApp.
  - Filter out group chats.
  - Map library chat data to project-owned `ChatSummary` type.
- Expose `GET /api/chats/private` endpoint with real data.
- Handle disconnected session errors gracefully.

### 10.2 API Endpoints Introduced

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/chats/private` | List one-to-one chats (real data) |

### 10.3 Screen: Chat Picker

**Purpose:** Let the user select one private chat.

**Requirements:**
- Show only one-to-one chats. Groups MUST be filtered out.
- Search by contact name or phone number.
- Show: display name, phone number (if available), last message preview,
  timestamp.
- Use fake/generated avatar — never real WhatsApp profile pictures
  (Constitution XII).

**Actions:** Search · Select chat · Continue

### 10.4 Frontend Components

- `ChatSearch` — search input with filtering.
- `ChatList` — scrollable list of `ChatListItem`.
- `ChatListItem` — single chat row with fake avatar.

### 10.5 Definition of Done

- [ ] User sees real private chats from their WhatsApp.
- [ ] Groups are filtered out — never selectable.
- [ ] Search works by name and phone number.
- [ ] Chat selection works end-to-end.
- [ ] Disconnected state handled with clear error.

---

## 11. Phase 7: Real Message and Image Import

**Goal:** Import text messages and images from a selected chat into a
project folder, run normalization, and generate a quality report.

### 11.1 Import Orchestration

The `ImportOrchestrator` coordinates the full import pipeline:

```text
Create project folder
  ↓
Fetch chat metadata
  ↓
Fetch messages (streaming AsyncIterable)
  ↓
Save raw messages to NDJSON (immutable)
  ↓
Download images (when enabled)
  ↓
Save images to media/images/
  ↓
Save raw media metadata
  ↓
Run normalization pipeline (Phase 4)
  ↓
Generate quality report
  ↓
Emit completion event
```

### 11.2 Backend Modules

| Module | File | Responsibility |
|---|---|---|
| `ImportOrchestrator` | `import/ImportOrchestrator.ts` | Full pipeline coordination |
| `MessageFetcher` | `import/MessageFetcher.ts` | Stream messages from adapter |
| `ImageDownloader` | `import/ImageDownloader.ts` | Download images with retry |
| `ImportProgress` | `import/ImportProgress.ts` | Track + emit progress via SSE |

### 11.3 API Endpoints Introduced

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/import/start` | Start import for selected chat |
| `GET` | `/api/import/:importId/status` | Get import status |
| `POST` | `/api/import/:importId/cancel` | Cancel running import |

### 11.4 SSE Events Introduced

```text
import.progress        import.warning
import.error           import.completed
```

### 11.5 Screen: Import Options

**Purpose:** Let the user choose what to import.

| Option | Required? | Default |
|---|---|---|
| Import text messages | Yes (always on) | Enabled |
| Import images | No (optional) | Disabled |

**Requirements:**
- Explain that importing images may take longer.
- No automatic import — user MUST explicitly start (Constitution II).

**Actions:** Start Import · Back

### 11.6 Screen: Import Progress

**Purpose:** Show real-time import progress via SSE.

**Progress stages:**

```text
preparing_project → fetching_metadata → fetching_messages →
saving_raw_messages → downloading_images → normalizing →
resolving_replies → generating_quality_report → preparing_preview
```

**Example progress text:**
```text
Imported 420 / 2,000 messages
Downloaded 31 / 120 images
Resolving replies…
```

**Requirements:**
- MUST NOT freeze UI during import (Constitution XVIII).
- Show warnings without stopping unless fatal.
- Allow cancellation if practical.

### 11.7 Definition of Done

- [ ] User imports one real chat — text and optional images.
- [ ] Raw files written (immutable NDJSON).
- [ ] Normalized files derived from raw.
- [ ] Quality report generated.
- [ ] Import is explicitly user-triggered and read-only.
- [ ] Missing images handled without crash — reported in quality report.
- [ ] Progress updates visible in real-time via SSE.

---

## 12. Phase 8: WhatsApp-Like Preview

**Goal:** Provide an accurate, performant preview of the imported
conversation before export, using virtual scrolling.

### 12.1 Backend Responsibilities

- Serve paginated render model via preview API.
- Serve images via local API route (`/api/media/:projectId/:filename`).
- Apply privacy settings to render model when requested.

### 12.2 API Endpoints Introduced

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/projects/:projectId/preview` | Get paginated render model |
| `GET` | `/api/projects/:projectId/preview/count` | Get total message count |
| `GET` | `/api/media/:projectId/:filename` | Serve image file for preview |

### 12.3 Screen: Preview

**Purpose:** Display the conversation as it will appear in the exported HTML.

**Requirements:**
- WhatsApp-like visual layout with custom CSS (not Tailwind-only).
- Desktop app shell with phone-width conversation area.
- **Virtual scrolling** — render only visible messages (Constitution XVIII).
- Light and dark mode toggle.
- Date separators, timestamps (HH:MM:SS), reply blocks.
- Images inside message bubbles with captions.
- Missing image placeholders, unsupported message cards.
- Deleted message indicator, edited label.
- Fake/generated avatar only (Constitution XII).
- Frontend renders normalized data ONLY (Constitution VII).

**Message layout:**

| Element | Position |
|---|---|
| Incoming messages | Left side |
| Outgoing messages | Right side |
| Date separators | Centered |
| Replies | Compact quoted block inside bubble |
| Images | Inside bubble, caption below |
| Timestamp | Inside or below bubble |

**Actions:** Toggle light/dark · Change font size · Change conversation
width · Open export settings

### 12.4 Chat Renderer (Custom CSS)

The chat renderer uses **custom CSS** — not Tailwind-only. Defined in
`frontend/src/styles/chat-renderer.css`.

| Element | Specification |
|---|---|
| Bubbles | WhatsApp-like rounded rectangles |
| Outgoing | Right-aligned, distinct color |
| Incoming | Left-aligned, distinct color |
| Date separators | Centered pill-shaped badges |
| Replies | Compact quoted block inside bubble |
| Images | Inside bubble, maintain aspect ratio |
| Timestamps | HH:MM:SS, inside or below bubble |
| Light/dark mode | Full theme support |
| Conversation width | Phone-like within desktop shell |
| Mixed text | Arabic, English, emoji, numbers coexist |
| Avatars | Fake/generated only |
| Missing images | Styled placeholder card |
| Unsupported | Distinct card with type + reason |
| Deleted | Struck-through or dimmed indicator |
| Edited | Small "edited" label |

### 12.5 Frontend Components

- `ConversationPreview` — virtual scrolling container.
- `MessageBubble` — text message bubble (incoming/outgoing).
- `ReplyPreview` — compact quoted block inside bubble.
- `ImageMessage` — image inside bubble with caption.
- `DateSeparator` — centered date badge.
- `UnsupportedMessage` — distinct card.

### 12.6 Virtual Scrolling

- Render only visible messages plus a buffer above/below.
- Request message data in pages from the backend preview API.
- Maintain scroll position when navigating back to preview.

### 12.7 Definition of Done

- [ ] Preview visually resembles WhatsApp.
- [ ] Virtual scrolling handles 10,000+ messages smoothly.
- [ ] Privacy settings affect preview in real-time.
- [ ] All rendering uses normalized data only.
- [ ] Light/dark mode toggle works.
- [ ] RTL/LTR works correctly for mixed Arabic/English content.
- [ ] Font size and conversation width controls work.

---

## 13. Phase 9: HTML Export

**Goal:** Generate an offline HTML export with local assets that matches
the preview, obeys privacy settings, and works without the backend running.

### 13.1 Export Output Structure

```text
exports/html/
  conversation.html       # self-contained page — no JS required
  assets/
    style.css             # chat renderer styles
    fonts/                # Inter + IBM Plex Sans Arabic (subset)
    media/
      img_000001.jpg
      img_000002.jpg
```

### 13.2 Export Requirements (Constitution X, XI, XII, XIII)

| Requirement | Constitution Ref |
|---|---|
| Works offline without backend running | X |
| Uses local assets folder (no base64) | X |
| Uses same render model as preview | X |
| Obeys privacy settings (name/phone/alias) | XII |
| Fake avatar only | XII |
| Watermark ("Exported by ChatFrame") if enabled | XI |
| Session files NEVER included | XIII |
| Fonts bundled locally or safe fallbacks | XVI |
| Fully static — no JavaScript required to view | — |
| Exported HTML opened via "Open HTML" in new browser tab | — |

### 13.3 Watermark

- Default text: `Exported by ChatFrame`
- Enabled by default; user can disable in export settings.
- Custom watermark text is NOT part of MVP.

### 13.4 Backend Module: `HtmlExporter`

`export/HtmlExporter.ts` responsibilities:
- Generate `conversation.html` from render model.
- Copy chat renderer CSS into `assets/`.
- Bundle fonts locally in `assets/fonts/`.
- Copy images into `assets/media/`.
- Apply privacy settings (name, phone, alias).
- Apply theme (light/dark).
- Add/remove watermark based on settings.
- Ensure exported HTML is fully independent of the app.
- Ensure session files are NEVER included.

### 13.5 API Endpoints Introduced

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects/:projectId/export/html` | Generate HTML export |

### 13.6 Screen: Export Settings

**Purpose:** Let user decide privacy and export options.

| Setting | Type | Default |
|---|---|---|
| Show contact name | Toggle | Yes |
| Show phone number | Toggle | No |
| Display alias | Text input | Empty (optional) |
| Fake avatar | Required | Always on |
| Watermark | Toggle | Enabled ("Exported by ChatFrame") |
| Theme | Light / Dark | Current preview theme |

**Requirements:**
- Privacy settings MUST affect both preview and export.
- Export format is HTML only in MVP.

**Actions:** Export HTML · Back to Preview

### 13.7 Screen: Export Complete

**Purpose:** Confirm successful export.

**Requirements:**
- Show export folder path and main HTML file path.
- "Open HTML" opens the file in a new browser tab.
- "Open Folder" opens the OS file explorer (if supported).
- Session files MUST NOT be in the export.

**Actions:** Open HTML · Open Folder · Start New Import

### 13.8 Definition of Done

- [ ] HTML opens in browser without backend running.
- [ ] Images load from local `assets/media/`.
- [ ] Fonts load from local `assets/fonts/` or system fallbacks.
- [ ] Watermark appears when enabled, hidden when disabled.
- [ ] Privacy settings obeyed (name, phone, alias).
- [ ] Session files excluded from export folder.
- [ ] Export matches preview closely.

---

## 14. Phase 10: Hardening, QA, and MVP Polish

**Goal:** Make the MVP reliable enough for real personal use. No new
features — only stability, polish, and verification.

### 14.1 Backend Hardening

- Improve error messages across all error types (Constitution XIX):

  ```text
  WhatsApp connection errors    authentication/session errors
  import errors                 media download errors
  normalization warnings        storage errors
  export errors                 unsupported message types
  ```

- Strengthen runtime validation at all API boundaries.
- Add import cancellation support.
- Add edge case tests for normalization.
- Dependency review and `pnpm-lock.yaml` audit.
- Log sanitization audit — ensure no secrets leak.
- Large conversation smoke test (5,000+ messages).

### 14.2 Frontend Polish

- Polish UI spacing, loading states, empty states, error states.
- Polish Arabic and English copy.
- Verify RTL/LTR across all screens.
- Verify light/dark mode across all screens.
- Verify responsive desktop behavior.
- Accessibility pass (keyboard navigation, focus states).

### 14.3 End-to-End Verification

Full flow MUST work:

```text
connect → select chat → import → quality report → preview → export
```

### 14.4 Definition of Done

- [ ] Full flow works end-to-end with a real WhatsApp chat.
- [ ] No known constitution violations.
- [ ] No hidden cloud calls, no database, no message sending.
- [ ] No QR/session secrets in logs.
- [ ] Error messages are clear and user-friendly.
- [ ] RTL/LTR verified on every screen.
- [ ] Light/dark mode verified on every screen.
- [ ] Large conversation (5,000+ messages) completes without crash.
- [ ] Known limitations documented.

---

# Part III — Governance

---

## 15. Constitution Compliance Matrix

| # | Principle | How Addressed |
|---|---|---|
| I | Local-First, Private by Default | No cloud, no telemetry, all data local |
| II | Personal Read-Only Usage | No send methods, user-triggered import |
| III | WhatsApp-Only Scope | No multi-platform abstractions |
| IV | Adapter-Based Integration | `WhatsAppAdapter` interface, isolated impl |
| V | Filesystem Storage | pnpm workspace, JSON/NDJSON, no DB |
| VI | Raw Data Immutability | `raw/` directory immutable, normalized derived |
| VII | Accuracy Before Appearance | Backend normalization = source of truth |
| VIII | Quality Reporting | Mandatory report with all required fields |
| IX | Deterministic Normalization | Same input → same output, tested |
| X | HTML Primary Export | HTML folder with local assets, offline |
| XI | WhatsApp-Like, Not Owned | No branding, disclaimer, watermark |
| XII | Privacy Controls | Name/phone toggles, alias, fake avatar |
| XIII | Session Safety | Protected files, excluded from export, no logging |
| XIV | Strong Type Safety | TypeScript strict, Zod at boundaries |
| XV | Backend/Frontend Separation | Clear ownership, API-only communication |
| XVI | i18n and Directionality | Arabic RTL, English LTR, component-level |
| XVII | Desktop-First | Browser-based, no Electron/Tauri |
| XVIII | Streaming and Batching | NDJSON, AsyncIterable, virtual scrolling |
| XIX | Explicit Error Handling | Typed errors, user-friendly messages |
| XX | Testable Core Logic | Vitest + fixtures, no WhatsApp needed |
| XXI | Generated Code Governance | Must follow constitution |
| XXII | Dependency Hygiene | Conservative choices, locked versions |
| XXIII | No Silent Data Loss | Unsupported visible, quality report |
| XXIV | Compliance Review | Matrix in plan, checks in PRs |
| XXV | Amendment Procedure | Constitution governs all changes |

---

## 16. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| **WhatsApp library instability** | Adapter isolation, mock adapter, fixture tests |
| **Account restriction or ban** | Read-only, no sending, user-triggered, disclaimer |
| **Large chats cause memory issues** | NDJSON streaming, AsyncIterable, virtual scrolling |
| **Inaccurate rendering** | Single render model for preview + export |
| **Silent data loss** | Preserve raw data, unsupported visible, quality report |
| **Privacy leaks** | Name/phone toggles, fake avatars, no session in export |
| **`whatsapp-web.js` breaking changes** | Adapter layer absorbs changes, locked dependency |
| **Mixed RTL/LTR text breaking layout** | Component-level direction handling, mock fixtures |
| **Font rendering offline** | Bundle fonts in export `assets/fonts/` |

---

## 17. Non-Negotiable Implementation Rules

All code — human-written or AI-generated — MUST follow these rules:

1. Do NOT add a database.
2. Do NOT add cloud storage or external services.
3. Do NOT add telemetry, analytics, or crash reporting.
4. Do NOT send WhatsApp messages.
5. Do NOT mutate raw imported data.
6. Do NOT parse raw WhatsApp payloads in the frontend.
7. Do NOT use real WhatsApp profile images by default.
8. Do NOT include session files in exports.
9. Do NOT log QR codes, session tokens, or secrets.
10. Do NOT implement group chats in MVP.
11. Do NOT implement PDF/PNG/ZIP export in MVP.
12. Do NOT introduce Baileys/OpenWA adapters in MVP.
13. Do NOT make import automatic on app launch.
14. Do NOT silently drop unsupported messages.
15. Do NOT use `any` in core modules without justification.
16. Do NOT leak third-party library types across module boundaries.

---

## 18. Acceptance Criteria

The MVP is complete when ALL of the following are true:

| # | Criterion |
|---|---|
| 1 | User can open ChatFrame locally in a browser |
| 2 | User can choose Arabic or English |
| 3 | Arabic UI renders RTL correctly |
| 4 | English UI renders LTR correctly |
| 5 | User can connect WhatsApp by scanning QR |
| 6 | Disclaimer is displayed during connection |
| 7 | Session can be restored locally |
| 8 | User can logout/unlink session |
| 9 | User can view private one-to-one chats |
| 10 | Group chats are not selectable |
| 11 | User can select one chat |
| 12 | User can choose text-only or text+images import |
| 13 | Import is manually triggered |
| 14 | App imports messages without sending anything |
| 15 | App stores raw messages (immutable) |
| 16 | App stores normalized messages (derived) |
| 17 | App downloads images when enabled |
| 18 | App handles missing images with placeholders |
| 19 | App generates quality report with all required fields |
| 20 | Preview shows WhatsApp-like bubbles |
| 21 | Preview shows replies where available |
| 22 | Preview shows date separators |
| 23 | Preview shows timestamps with seconds |
| 24 | Preview shows deleted message indicators |
| 25 | Preview shows unsupported messages (never drops) |
| 26 | Preview uses virtual scrolling for large conversations |
| 27 | User can hide/show contact name |
| 28 | User can hide/show phone number |
| 29 | User can set a display alias |
| 30 | Preview uses fake/generated avatar |
| 31 | User can export HTML folder |
| 32 | Exported HTML works offline |
| 33 | Exported HTML includes local assets |
| 34 | Exported HTML includes watermark when enabled |
| 35 | Exported HTML matches preview closely |
| 36 | Session files never included in export |
| 37 | No telemetry or cloud calls exist |
| 38 | No database exists |
| 39 | Core normalization logic has tests |
| 40 | Quality report is stored in project folder |

---

## 19. MVP Completion Checklist

### Phase 1: Foundation
- [ ] pnpm workspace monorepo initialized
- [ ] Backend project initialized (Fastify + TypeScript)
- [ ] Frontend project initialized (React + Vite + TypeScript)
- [ ] Shared types package created (`@chatframe/shared`)
- [ ] Strict TypeScript configured for all packages
- [ ] Vitest configured for all packages
- [ ] ESLint + Prettier configured
- [ ] Welcome / language screen with RTL/LTR switch

### Phase 2: Contracts and Mocks
- [ ] All shared types defined with Zod schemas
- [ ] `WhatsAppAdapter` interface defined
- [ ] Mock adapter created
- [ ] Synthetic conversation fixture created
- [ ] Mock API endpoints serving fixture data
- [ ] Frontend wizard flow powered by mock data

### Phase 3: Storage
- [ ] Project folder storage implemented
- [ ] NDJSON reader/writer implemented (streaming)
- [ ] Media store implemented
- [ ] Project CRUD API working
- [ ] Storage tests passing

### Phase 4: Normalization
- [ ] Message normalization implemented
- [ ] Timestamp normalization implemented
- [ ] Deduplication implemented
- [ ] Reply resolution implemented
- [ ] Quality report generation implemented
- [ ] Render model generation implemented
- [ ] Quality report screen built
- [ ] Normalization tests passing

### Phase 5: WhatsApp Session
- [ ] `whatsapp-web.js` adapter implemented
- [ ] QR connection working via SSE
- [ ] Session restore working
- [ ] Logout/unlink working
- [ ] Disclaimer banner visible
- [ ] No secrets in logs

### Phase 6: Chat Listing
- [ ] Private chat listing working (groups filtered)
- [ ] Chat picker screen with search
- [ ] Fake avatars used

### Phase 7: Import
- [ ] Message import working (streaming)
- [ ] Image import working (optional)
- [ ] Raw NDJSON storage (immutable)
- [ ] Normalization runs after import
- [ ] Quality report generated
- [ ] Import progress screen with SSE
- [ ] Import cancellation supported

### Phase 8: Preview
- [ ] WhatsApp-like message bubbles (custom CSS)
- [ ] Virtual scrolling for large conversations
- [ ] Reply previews
- [ ] Date separators
- [ ] Image messages with captions
- [ ] Unsupported message cards
- [ ] Missing image placeholders
- [ ] Light/dark mode toggle
- [ ] RTL/LTR verified
- [ ] Privacy settings affect preview live

### Phase 9: Export
- [ ] HTML exporter implemented
- [ ] Local assets folder generated
- [ ] Fonts bundled for offline use
- [ ] Privacy settings applied to export
- [ ] Watermark toggle working
- [ ] Offline HTML verified
- [ ] Session files excluded
- [ ] Export matches preview

### Phase 10: Hardening
- [ ] Error messages clear and user-friendly
- [ ] No database, no cloud calls, no telemetry
- [ ] No message sending
- [ ] No QR/session secrets in logs
- [ ] No `any` in core modules
- [ ] Large conversation smoke test passing
- [ ] RTL/LTR verified across all screens
- [ ] Light/dark verified across all screens
- [ ] Constitution compliance verified

---

> **Final MVP Definition:**
> ChatFrame MVP is complete when a user can locally connect their personal
> WhatsApp account, select one private chat, import text messages and
> images, review a quality report, preview the conversation in a
> WhatsApp-like design with virtual scrolling, apply privacy settings, and
> export an offline HTML folder that accurately represents the conversation
> — without using any database, cloud service, telemetry, or message-sending
> behavior.
