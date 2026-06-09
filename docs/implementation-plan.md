# ChatFrame — MVP Implementation Plan

> **Version**: 1.0.0 · **Date**: 2026-06-09 · **Status**: Draft
> **Constitution**: v1.0.0 · **Scope**: One-to-one WhatsApp chats only

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [MVP Scope](#2-mvp-scope)
3. [Technical Stack](#3-technical-stack)
4. [Repository Structure](#4-repository-structure)
5. [User Flow](#5-user-flow)
6. [Screen Specifications](#6-screen-specifications)
7. [Backend Architecture](#7-backend-architecture)
8. [WhatsApp Adapter Design](#8-whatsapp-adapter-design)
9. [Local API Design](#9-local-api-design)
10. [Data Storage Design](#10-data-storage-design)
11. [Data Model](#11-data-model)
12. [Normalization Pipeline](#12-normalization-pipeline)
13. [Frontend Architecture](#13-frontend-architecture)
14. [UI Design Direction](#14-ui-design-direction)
15. [HTML Export Design](#15-html-export-design)
16. [Mock Conversation Requirements](#16-mock-conversation-requirements)
17. [Development Phases](#17-development-phases)
18. [Constitution Compliance Matrix](#18-constitution-compliance-matrix)
19. [Risks and Mitigations](#19-risks-and-mitigations)
20. [Non-Negotiable Implementation Rules](#20-non-negotiable-implementation-rules)
21. [Acceptance Criteria](#21-acceptance-criteria)
22. [MVP Completion Checklist](#22-mvp-completion-checklist)

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

## 4. Repository Structure

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

**Key architectural decision:** The `packages/shared/` package contains all
TypeScript types, Zod schemas, and constants shared between backend and
frontend. Both packages import from `@chatframe/shared`. This ensures
contract alignment without duplication.

---

## 5. User Flow

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

## 6. Screen Specifications

### 6.1 Welcome / Language Screen

**Purpose:** Introduce ChatFrame and let the user choose Arabic or English.

| Requirement | Details |
|---|---|
| Languages | Arabic (RTL) and English (LTR) |
| Persistence | Selected language stored locally (Zustand → localStorage) |
| Copy | Clearly state that ChatFrame runs locally and is read-only |
| Typography | Inter (English) / IBM Plex Sans Arabic (Arabic) |

**Actions:** Choose language → Continue

---

### 6.2 WhatsApp Connection Screen

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
- If a saved session exists, attempt silent restore.
- If restore fails, show reconnect action.
- Display disclaimer banner at top of screen.
- Provide clear instructions: Open WhatsApp → Linked Devices → Scan QR.

**Actions:** Connect · Reconnect · Logout / Unlink Session

---

### 6.3 Chat Picker Screen

**Purpose:** Let the user select one private chat.

**Requirements:**
- Show only one-to-one chats. Groups MUST be filtered out.
- Search by contact name or phone number.
- Show: display name, phone number (if available), last message preview, timestamp.
- Use fake/generated avatar — never real WhatsApp profile pictures.

**Actions:** Search · Select chat · Continue

---

### 6.4 Import Options Screen

**Purpose:** Let the user choose what to import.

| Option | Required? | Default |
|---|---|---|
| Import text messages | Yes (always on) | Enabled |
| Import images | No (optional) | Disabled |

**Requirements:**
- Explain that importing images may take longer.
- No automatic import before user confirmation.
- User MUST explicitly start import (Constitution II).

**Actions:** Start Import · Back

---

### 6.5 Import Progress Screen

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

---

### 6.6 Quality Report Screen

**Purpose:** Give the user confidence that the import was analyzed accurately.

**MUST display** (Constitution VIII):

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
| Errors | Fatal issues (block export if any) |

**Behavior:**
- Warnings MUST NOT block export.
- Fatal errors MUST block export.
- Missing images show placeholders in preview/export.

**Actions:** Continue to Preview · View Details · Back

---

### 6.7 Preview Screen

**Purpose:** Display the conversation as it will appear in the exported HTML.

**Requirements:**
- WhatsApp-like visual layout with custom CSS (not Tailwind-only).
- Desktop app shell with phone-width conversation area.
- **Virtual scrolling** for large conversations (Constitution XVIII).
- Light and dark mode toggle.
- Date separators, timestamps (HH:MM:SS), reply blocks.
- Images inside message bubbles with captions.
- Missing image placeholders, unsupported message cards.
- Deleted message indicator, edited label.
- Fake/generated avatar only.
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

---

### 6.8 Export Settings Screen

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
- Exported HTML uses local assets folder.

**Actions:** Export HTML · Back to Preview

---

### 6.9 Export Complete Screen

**Purpose:** Confirm successful export.

**Requirements:**
- Show export folder path and main HTML file path.
- "Open HTML" opens the file in a new browser tab.
- "Open Folder" opens the OS file explorer (if supported).
- Session files MUST NOT be in the export (Constitution XIII).

**Actions:** Open HTML · Open Folder · Start New Import

---

## 7. Backend Architecture

### 7.1 Responsibilities

The backend owns all data processing (Constitution XV):

```text
WhatsApp session lifecycle      Import orchestration
QR generation                   Raw storage (NDJSON)
Chat listing                    Normalization pipeline
Message import                  Deduplication
Image download                  Reply resolution
Media linking                   Quality reporting
Render model creation           HTML export generation
Filesystem operations           Image serving (API route)
```

The frontend MUST NOT access WhatsApp directly or read project files from
the filesystem.

### 7.2 Module Summary

| Module | Responsibility |
|---|---|
| `api/` | Fastify route handlers and request/response schemas |
| `whatsapp/` | Adapter interface + `whatsapp-web.js` implementation |
| `projects/` | Project lifecycle, paths, manifest |
| `storage/` | NDJSON read/write, JSON files, media store |
| `import/` | Orchestration, message fetching, image download, progress |
| `normalize/` | Message normalization, dedup, replies, timestamps, quality |
| `render/` | Build render model from normalized data |
| `export/` | HTML generation with templates and local assets |
| `security/` | Log sanitization, session protection |
| `utils/` | Logger, hashing, file names, error types |

---

## 8. WhatsApp Adapter Design

### 8.1 Adapter Interface

All WhatsApp-specific code MUST sit behind this interface (Constitution IV).
The rest of the application depends ONLY on this interface.

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

### 8.2 MVP Adapter: `WhatsappWebJsAdapter`

**Rules:**
- MUST NOT leak `whatsapp-web.js` types into core modules.
- MUST map library messages into project-owned `RawWhatsAppMessage` type.
- MUST preserve adapter-specific raw payload separately.
- MUST NOT expose message-sending methods.
- MUST use `AsyncIterable` for message fetching (streaming, Constitution XVIII).

### 8.3 Mock Adapter: `MockAdapter`

A mock adapter MUST be provided for development and testing. It returns
synthetic fixture data without connecting to WhatsApp (Constitution XX).

---

## 9. Local API Design

### 9.1 Overview

The backend provides local HTTP APIs consumed by the frontend.
Real-time events use **Server-Sent Events (SSE)**.

### 9.2 Endpoints

#### Session

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/session/connect` | Start WhatsApp connection |
| `GET` | `/api/session/status` | Get current connection state |
| `POST` | `/api/session/logout` | Logout and clear session |

#### Events (SSE)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events` | SSE stream for real-time updates |

**Event types:**

```text
session.state          session.qr
import.progress        import.warning
import.error           import.completed
```

#### Chats

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/chats/private` | List one-to-one chats |

#### Projects

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects` | Create a new project |
| `GET` | `/api/projects/:projectId` | Get project manifest |
| `PATCH` | `/api/projects/:projectId` | Rename project |

#### Import

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/import/start` | Start import for selected chat |
| `GET` | `/api/import/:importId/status` | Get import status |
| `POST` | `/api/import/:importId/cancel` | Cancel running import |

#### Preview

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/projects/:projectId/preview` | Get paginated render model |
| `GET` | `/api/projects/:projectId/preview/count` | Get total message count |

#### Media

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/media/:projectId/:filename` | Serve image file for preview |

#### Export

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects/:projectId/export/html` | Generate HTML export |

---

## 10. Data Storage Design

### 10.1 Project Folder Structure

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
        render-model.json           # or streamed via API

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

### 10.2 Project Naming

Auto-generated: `chatframe_YYYY-MM-DD_<contact-name-slug>`

The user can optionally rename the project via the API after creation.

### 10.3 Storage Rules

| Rule | Constitution Ref |
|---|---|
| Raw files are **immutable** — never overwritten | VI |
| Normalized files are **derived** — regeneratable from raw | VI |
| Export files are **derived** — regeneratable from normalized | VI |
| Session files NEVER stored inside project folders | XIII |
| Logs MUST NOT contain QR codes, tokens, or secrets | XIII, XIX |
| Message content MUST NOT be logged unless for local debugging | I |
| Large collections use NDJSON, not monolithic JSON | V, XVIII |

---

## 11. Data Model

All types live in `packages/shared/src/types/`. Zod schemas live in
`packages/shared/src/schemas/`.

### 11.1 ChatSummary

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

### 11.2 NormalizedMessage

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

### 11.3 QualityReport

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

### 11.4 ConnectionState

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

### 11.5 ImportProgress

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

### 11.6 ExportSettings

```typescript
export interface ExportSettings {
  showContactName: boolean;
  showPhoneNumber: boolean;
  displayAlias?: string;
  showWatermark: boolean;
  theme: 'light' | 'dark';
}
```

---

## 12. Normalization Pipeline

The normalization pipeline runs after raw import and MUST be deterministic
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

---

## 13. Frontend Architecture

### 13.1 Responsibilities

The frontend owns (Constitution XV):

```text
Language and direction selection     User flow (wizard steps)
QR display                          Chat selection UI
Import option UI                    Progress display
Quality report display              Preview rendering
Privacy settings UI                 Export action + completion
Theme selection (light/dark)        Font size / conversation width
```

The frontend MUST NOT:
- Connect to WhatsApp directly
- Read files from the filesystem
- Parse raw WhatsApp data
- Deduplicate messages or resolve replies
- Generate quality reports

### 13.2 State Management

| Layer | Tool | Scope |
|---|---|---|
| **Server state** | TanStack Query | Chats, preview data, quality report, import status, export results |
| **Client state** | Zustand | Language, theme, selected chat, current project, export settings |

### 13.3 API Communication

- **REST calls:** `fetch` wrapped in TanStack Query hooks
- **Real-time events:** SSE via `EventSource` in a custom hook
- **Image display:** `<img src="/api/media/:projectId/:filename" />`

### 13.4 Virtual Scrolling (Preview)

The preview MUST use virtual scrolling for large conversations:
- Render only visible messages plus a buffer above/below.
- Request message data in pages from the backend preview API.
- Maintain scroll position when navigating back to preview.

---

## 14. UI Design Direction

### 14.1 App Shell

- Desktop-first, centered layout.
- Clean wizard-like flow with step indicators.
- Minimal distractions, clear progress and error states.
- Arabic/English with intentional RTL/LTR handling at component level.
- Inter (English) + IBM Plex Sans Arabic (Arabic) with system fallbacks.

### 14.2 Chat Renderer

The chat renderer uses **custom CSS** (not Tailwind-only):

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

---

## 15. HTML Export Design

### 15.1 Output Structure

```text
exports/html/
  conversation.html       # self-contained page
  assets/
    style.css             # chat renderer styles
    fonts/                # Inter + IBM Plex Sans Arabic (subset)
    media/
      img_000001.jpg
      img_000002.jpg
```

### 15.2 Requirements

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
| Exported HTML opened via "Open HTML" action in new browser tab | — |

### 15.3 Watermark

- Default text: `Exported by ChatFrame`
- Enabled by default; user can disable in export settings.
- Custom watermark text is NOT part of MVP.

---

## 16. Mock Conversation Requirements

A synthetic mock conversation MUST be created before WhatsApp integration.
It powers development and testing of the preview, export, and normalization
pipeline (Constitution XX).

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

---

## 17. Development Phases

### Phase 1: Repository Foundation and Tooling

**Goal:** Stable full-stack TypeScript monorepo with tooling.

**Tasks:**
- Initialize pnpm workspace with `backend/`, `frontend/`, `packages/shared/`.
- Configure TypeScript strict mode for all packages.
- Set up Fastify backend with health endpoint.
- Set up React + Vite frontend with basic shell.
- Configure Vitest for all packages.
- Add linting (ESLint) and formatting (Prettier).
- Add Inter and IBM Plex Sans Arabic fonts.
- Configure i18n files (Arabic + English) with RTL/LTR handling.
- Set up Zustand stores (language, theme).
- Set up TanStack Query provider.
- Set up React Router v7 with wizard routes.
- Configure `.env` with default ports (3714, 5173).

**Definition of Done:**
- `pnpm dev` starts both backend and frontend.
- Frontend calls backend health endpoint successfully.
- Strict TypeScript — zero errors.
- Arabic RTL and English LTR switch works.
- Basic app shell visible in browser.

---

### Phase 2: Shared Contracts and Mock Data

**Goal:** Build the app around project-owned types before WhatsApp.

**Tasks:**
- Define all shared types in `packages/shared/`:
  ChatSummary, RawWhatsAppMessage, NormalizedMessage, QualityReport,
  RenderModel, ConnectionState, ImportProgress, ExportSettings.
- Add Zod schemas for each type.
- Create `MockAdapter` implementing `WhatsAppAdapter` interface.
- Create synthetic conversation fixture (see §16).
- Build mock API endpoints (chat list, preview).
- Build API client layer in frontend (TanStack Query hooks).
- Render mock chat list in chat picker screen.
- Render mock conversation in preview screen.

**Definition of Done:**
- Mock data powers full UI flow.
- No WhatsApp connection needed.
- Frontend and backend agree on shared contracts.
- Mock data covers all scenarios from §16.

---

### Phase 3: Project Folder Storage

**Goal:** Implement local filesystem storage.

**Tasks:**
- Implement `ProjectStore` (create, read, rename, get paths).
- Implement deterministic project folder naming.
- Implement `NdjsonWriter` and `NdjsonReader` (streaming).
- Implement `JsonFile` (read/write JSON with Zod validation).
- Implement `MediaStore` (image save/retrieve).
- Create `project.json` manifest schema.
- Ensure raw/normalized/export directory separation.
- Add tests for path generation, NDJSON read/write, project lifecycle.

**Definition of Done:**
- Backend creates well-structured project folders.
- NDJSON streaming works for large files.
- Raw and normalized directories are strictly separate.
- Tests cover all storage operations.

---

### Phase 4: Normalization Engine

**Goal:** Build the core intelligence — testable without WhatsApp.

**Tasks:**
- Implement `normalizeMessage` (raw → normalized mapping).
- Implement `normalizeTimestamp` (preserve original + derive ISO).
- Implement message sorting by normalized timestamp.
- Implement `dedupeMessages` (prefer most complete record).
- Implement `resolveReplies` (best-effort linking).
- Implement image linking (match media IDs to files).
- Implement unsupported message handling (preserve, never drop).
- Implement deleted/edited state handling.
- Implement `buildQualityReport`.
- Implement `buildRenderModel`.
- Add comprehensive tests using synthetic fixtures.

**Frontend tasks:**
- Update preview screen to consume real render model.
- Build quality report screen components.
- Build unsupported message card component.
- Build missing image placeholder component.

**Definition of Done:**
- Synthetic raw messages → normalized output → render model pipeline works.
- Tests cover: normalization, sorting, dedup, replies, missing images,
  quality report, unsupported messages.
- Frontend renders render model accurately.
- No frontend parsing of raw messages.

---

### Phase 5: WhatsApp Session Integration

**Goal:** Connect to WhatsApp locally using `whatsapp-web.js`.

**Tasks:**
- Implement `WhatsAppAdapter` interface.
- Implement `WhatsappWebJsAdapter`:
  - Session initialization and QR event handling.
  - Connection state machine with SSE broadcasting.
  - Session restore from local storage.
  - Logout/unlink with session cleanup.
  - Session file protection.
- Ensure QR/session secrets are NEVER logged.
- Ensure no send-message methods are exposed.

**Frontend tasks:**
- Build QR connection screen with real SSE events.
- Build connection status component.
- Build disclaimer banner.
- Add reconnect and logout actions.

**Definition of Done:**
- User can scan QR and establish connection.
- Connection state updates live via SSE.
- Session restores on app restart.
- Logout clears session files.
- No QR codes or tokens in any log output.

---

### Phase 6: Real Chat Listing

**Goal:** List one-to-one WhatsApp chats from a live connection.

**Tasks:**
- Implement `listPrivateChats` in adapter (filter groups).
- Map WhatsApp chat data to `ChatSummary`.
- Expose `GET /api/chats/private` endpoint.
- Handle disconnected session errors gracefully.

**Frontend tasks:**
- Connect chat picker to real API.
- Add search filtering.
- Add empty state and loading state.
- Ensure groups are never selectable.

**Definition of Done:**
- User sees real private chats.
- Groups are filtered out.
- Selection works end-to-end.

---

### Phase 7: Real Message and Image Import

**Goal:** Import text messages and images from a selected chat.

**Tasks:**
- Implement `ImportOrchestrator`:
  - Fetch messages via adapter (streaming `AsyncIterable`).
  - Save raw messages to NDJSON (immutable).
  - Download images when enabled.
  - Save images to `media/images/`.
  - Save raw media metadata.
  - Emit progress events via SSE.
  - Handle failed image downloads gracefully.
- Run normalization pipeline after raw import.
- Generate quality report.
- Build render model.

**Frontend tasks:**
- Build import options screen (text-only vs. text+images).
- Build import progress screen with real SSE events.
- Show warnings in-flight.
- Show completion state.

**Definition of Done:**
- User imports one real chat — text and optional images.
- Raw files written (immutable).
- Normalized files derived.
- Quality report generated.
- Import is explicitly user-triggered, read-only.
- Missing images handled without crash.

---

### Phase 8: WhatsApp-Like Preview

**Goal:** Accurate preview before export, using virtual scrolling.

**Tasks:**
- Serve paginated render model via preview API.
- Serve images via `/api/media/:projectId/:filename`.
- Apply privacy settings to render model.

**Frontend tasks:**
- Finalize virtual scrolling in `ConversationPreview`.
- Finalize all bubble components: `MessageBubble`, `ReplyPreview`,
  `ImageMessage`, `DateSeparator`, `UnsupportedMessage`.
- Add light/dark mode toggle.
- Add font size and conversation width controls.
- Apply privacy settings live in preview.
- Fake avatar display.

**Definition of Done:**
- Preview visually resembles WhatsApp.
- Virtual scrolling handles 10,000+ messages smoothly.
- Privacy settings affect preview in real-time.
- All rendering uses normalized data only.
- RTL/LTR works correctly for mixed content.

---

### Phase 9: HTML Export

**Goal:** Generate offline HTML export with local assets.

**Tasks:**
- Implement `HtmlExporter`:
  - Generate `conversation.html` from render model.
  - Copy chat renderer CSS into `assets/`.
  - Bundle fonts locally in `assets/fonts/`.
  - Copy images into `assets/media/`.
  - Apply privacy settings.
  - Apply theme (light/dark).
  - Add/remove watermark based on settings.
  - Ensure exported HTML is fully independent.
  - Ensure session files are NEVER included.

**Frontend tasks:**
- Build export settings screen (privacy + watermark + theme).
- Build export complete screen.
- Trigger HTML export via API.
- Display output path.
- "Open HTML" opens in new browser tab.
- "Open Folder" attempts to open OS explorer.

**Definition of Done:**
- HTML opens in browser without backend running.
- Images load from local `assets/media/`.
- Fonts load from local `assets/fonts/` or system fallbacks.
- Watermark appears when enabled.
- Privacy settings obeyed.
- Session files excluded.
- Export matches preview closely.

---

### Phase 10: Hardening, QA, and MVP Polish

**Goal:** Make the MVP reliable for real personal use.

**Backend tasks:**
- Improve error messages across all error types (Constitution XIX).
- Strengthen runtime validation at all boundaries.
- Add import cancellation.
- Add edge case tests.
- Dependency review and lock.
- Log sanitization audit.
- Large conversation smoke test (5,000+ messages).

**Frontend tasks:**
- Polish UI spacing, loading states, empty states, error states.
- Polish Arabic and English copy.
- Verify RTL/LTR across all screens.
- Verify light/dark mode across all screens.
- Verify responsive desktop behavior.
- Accessibility pass (keyboard navigation, focus states).

**Definition of Done:**
- Full flow works: connect → select → import → preview → export.
- No known constitution violations.
- No hidden cloud calls, no database, no message sending.
- No QR/session secrets in logs.
- Known limitations documented.

---

## 18. Constitution Compliance Matrix

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

## 19. Risks and Mitigations

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

## 20. Non-Negotiable Implementation Rules

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

## 21. Acceptance Criteria

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

## 22. MVP Completion Checklist

### Foundation
- [ ] pnpm workspace monorepo initialized
- [ ] Backend project initialized (Fastify + TypeScript)
- [ ] Frontend project initialized (React + Vite + TypeScript)
- [ ] Shared types package created (`@chatframe/shared`)
- [ ] Strict TypeScript configured for all packages
- [ ] Vitest configured for all packages
- [ ] ESLint + Prettier configured

### Shared Contracts
- [ ] All shared types defined with Zod schemas
- [ ] Mock adapter created
- [ ] Synthetic conversation fixture created

### Storage
- [ ] Project folder storage implemented
- [ ] NDJSON reader/writer implemented (streaming)
- [ ] Media store implemented
- [ ] Storage tests passing

### Normalization
- [ ] Message normalization implemented
- [ ] Timestamp normalization implemented
- [ ] Deduplication implemented
- [ ] Reply resolution implemented
- [ ] Quality report generation implemented
- [ ] Render model generation implemented
- [ ] Normalization tests passing

### WhatsApp Integration
- [ ] WhatsApp adapter interface defined
- [ ] `whatsapp-web.js` adapter implemented
- [ ] QR connection working
- [ ] Session restore working
- [ ] Logout/unlink working
- [ ] Private chat listing working
- [ ] Message import working
- [ ] Image import working

### Frontend Screens
- [ ] Welcome / language screen
- [ ] WhatsApp connection screen (QR + disclaimer)
- [ ] Chat picker screen (search + select)
- [ ] Import options screen
- [ ] Import progress screen (SSE)
- [ ] Quality report screen
- [ ] Preview screen (virtual scrolling)
- [ ] Export settings screen
- [ ] Export complete screen

### Preview and Renderer
- [ ] WhatsApp-like message bubbles
- [ ] Reply previews
- [ ] Date separators
- [ ] Image messages
- [ ] Unsupported message cards
- [ ] Missing image placeholders
- [ ] Light/dark mode
- [ ] RTL/LTR verified

### Export
- [ ] HTML exporter implemented
- [ ] Local assets folder generated
- [ ] Fonts bundled for offline use
- [ ] Privacy settings applied
- [ ] Watermark toggle working
- [ ] Offline HTML verified
- [ ] Session files excluded

### Quality and Compliance
- [ ] No database
- [ ] No cloud calls
- [ ] No telemetry
- [ ] No message sending
- [ ] No QR/session secrets in logs
- [ ] No `any` in core modules
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
