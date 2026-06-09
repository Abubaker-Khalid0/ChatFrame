<!--
  SYNC IMPACT REPORT
  ===========================================================================
  Version Change: N/A (initial) → 1.0.0
  Modified Principles: None (initial ratification)
  Added Sections:
    - 25 Core Principles (I through XXV)
    - Approved Technical Baseline (section)
    - Governance (section)
  Removed Sections: None
  Templates Requiring Updates:
    - .specify/templates/plan-template.md ✅ compatible (Constitution Check section present)
    - .specify/templates/spec-template.md ✅ compatible (requirements/scenarios aligned)
    - .specify/templates/tasks-template.md ✅ compatible (phase structure supports constitution-driven tasks)
    - .specify/templates/checklist-template.md ✅ compatible
  Follow-up TODOs: None
  ===========================================================================
-->

# ChatFrame Constitution

## Purpose

ChatFrame is a local-first web application for visually exporting personal
one-to-one WhatsApp conversations into accurate, readable, WhatsApp-like
archives.

This constitution defines the non-negotiable technical rules for the project.
All specifications, plans, tasks, code, refactors, and implementation
decisions MUST comply with this document. If a proposed implementation
conflicts with this constitution, the constitution wins unless it is
explicitly amended.

## Core Principles

### I. Local-First, Private by Default

ChatFrame MUST run locally on the user's machine.

The application MUST NOT depend on any external cloud service for storing,
processing, rendering, analyzing, or exporting user conversations.

The only permitted external network interaction is the minimum interaction
required to connect to WhatsApp through the selected WhatsApp integration
library.

Conversation data, media, session files, export files, logs, and quality
reports MUST remain on the local machine unless the user manually moves or
shares them outside the app.

No telemetry, analytics, remote logging, tracking pixels, crash reporting,
or hidden network requests are allowed.

### II. Personal Read-Only Usage

ChatFrame is a personal export and archive tool, not a WhatsApp bot,
automation tool, marketing tool, scraping system, CRM, or mass messaging
product.

The application MUST be read-only toward WhatsApp.

The application MUST NOT send messages, edit messages, delete messages, react
to messages, join groups, invite users, scrape unrelated contacts, or perform
background automation.

All imports MUST be explicitly user-triggered.

Long-running hidden background collection is forbidden.

### III. WhatsApp-Only Scope

ChatFrame is designed for WhatsApp only.

The architecture MAY be clean enough to support other chat platforms in the
future, but no non-WhatsApp platform code, abstraction, UI, copy, or data
model requirement may be added unless explicitly specified later.

The current project scope is one-to-one WhatsApp chats only. Group chat
behavior MUST NOT be assumed unless a future specification explicitly
introduces it.

### IV. Adapter-Based WhatsApp Integration

WhatsApp integration MUST be isolated behind a clear adapter interface.

The rest of the application MUST NOT directly depend on `whatsapp-web.js`,
Baileys, OpenWA, or any specific WhatsApp library shape.

The first production adapter is `whatsapp-web.js`, but the system MUST be
structured so that future adapters can be added without rewriting storage,
normalization, rendering, or export logic.

Adapter-specific raw data MUST be preserved separately from normalized
application data.

Any adapter implementation MUST expose normalized capabilities through
project-owned interfaces, not through third-party library types leaking
across the codebase.

### V. Filesystem Storage, No Database

The project MUST use organized filesystem storage as the primary persistence
layer.

A database MUST NOT be introduced unless the constitution is amended.

Project data MUST be stored in explicit project folders. Each import/export
project MUST be self-contained and inspectable by a developer or advanced
user.

The baseline storage structure MUST support the following concepts:

```text
project.json
source metadata
raw messages
normalized messages
media files
quality report
exports
logs
```

Large message collections MUST be stored in streaming-friendly formats such
as NDJSON, not as one huge in-memory JSON object.

The storage system MUST be deterministic, portable, and human-inspectable
where practical.

### VI. Raw Data Immutability

Raw imported data MUST be preserved.

The application MUST NOT overwrite, mutate, silently correct, or delete raw
imported WhatsApp data during normalization or rendering.

All cleaning, deduplication, enrichment, transformation, and formatting MUST
produce derived files.

If normalization fails, the raw import MUST still remain available for
debugging and reprocessing.

The project MUST clearly separate:

```text
raw data
normalized data
render model
export output
```

No renderer or exporter may directly depend on raw WhatsApp adapter payloads.

### VII. Accuracy Before Appearance

Visual quality is important, but data correctness is more important.

The backend normalization pipeline MUST be treated as the source of truth
for understanding the conversation.

The frontend MUST render normalized data. It MUST NOT contain hidden
message-parsing logic, WhatsApp-specific cleanup logic, deduplication logic,
or reply-resolution logic.

Message order, timestamps, sender identity, replies, deleted/edited states,
image associations, and unsupported message types MUST be handled
deliberately and traceably.

If a message cannot be fully understood, it MUST remain visible as an
unsupported or partially parsed message instead of being silently dropped.

### VIII. Quality Reporting Is Mandatory

Every import or normalization operation MUST produce a quality report.

The quality report MUST include, at minimum:

```text
total raw messages
total normalized messages
duplicates removed
messages with unresolved replies
messages with missing or unavailable media
unsupported message types
date range
warnings
errors
```

Quality reports MUST be stored inside the project folder.

The system MUST prefer transparent warnings over silent failure.

### IX. Deterministic Normalization

Normalization MUST be deterministic.

Given the same raw input and same version of the normalization logic, the
normalized output MUST be reproducible.

Deduplication, sorting, reply linking, sender resolution, media linking, and
timestamp conversion MUST be implemented in backend services with clear
tests.

Duplicate removal MUST prefer the most complete message record rather than
the first record blindly.

Timestamp handling MUST preserve the original timestamp where possible and
expose a normalized timestamp for rendering.

### X. HTML Is the Primary Export Source

HTML is the primary export format and the canonical visual output.

PDF and PNG exports, when introduced, MUST be generated from the same render
model and visual system used by the HTML export.

There MUST NOT be separate visual implementations for HTML, PDF, and PNG
that can drift apart.

The exported HTML MUST use a local assets folder by default instead of
embedding all media as base64.

Exports MUST remain usable offline after generation, as long as their local
assets remain beside them.

### XI. WhatsApp-Like, Not WhatsApp-Owned

The visual renderer MUST be close to the WhatsApp conversation experience,
especially in layout, bubbles, timestamps, replies, dates, and image
presentation.

However, the implementation MUST avoid claiming affiliation with WhatsApp.

The product name, UI copy, generated exports, and documentation MUST NOT
imply that ChatFrame is official, endorsed, certified, or provided by
WhatsApp or Meta.

Brand assets, logos, or protected marks MUST NOT be copied unless explicitly
approved later.

### XII. Privacy Controls Before Export

The application MUST provide privacy-conscious export behavior.

Before export, the user MUST be able to choose whether to show or hide
personal identifiers such as contact name and phone number.

Profile images used in rendering MUST be fake, generated, placeholder, or
user-provided inside ChatFrame. The app MUST NOT use the real WhatsApp
profile picture by default.

Future privacy features such as image blurring, media exclusion, project
encryption, and redacted export modes MUST be designed as first-class
options rather than hacks.

### XIII. Session Safety

WhatsApp session files are sensitive.

Session storage MUST be treated as protected local data.

The application MUST provide a clear Logout / Unlink Session action.

The implementation SHOULD protect local session files as much as practical
for the target environment.

Session files MUST NOT be included in exported conversation folders, shared
archives, HTML exports, PDF exports, PNG exports, or logs.

QR codes, authentication tokens, and session secrets MUST NOT be logged.

### XIV. Strong Type Safety

The codebase MUST use TypeScript for backend and frontend code.

Core data structures MUST be explicitly typed.

Runtime validation MUST be used at system boundaries, including API requests,
adapter outputs, storage reads, and normalized message creation.

Third-party library data MUST be validated or mapped before entering core
application logic.

Use of `any` is forbidden in core modules unless justified with a comment
and isolated at an external boundary.

### XV. Clear Backend / Frontend Separation

The backend owns:

```text
WhatsApp connection
import orchestration
raw storage
normalization
deduplication
reply resolution
media download and linking
quality reporting
export generation
filesystem operations
```

The frontend owns:

```text
language and direction selection
user flow
preview display
export settings UI
import options UI
progress display
error display
theme selection
```

The frontend MUST NOT directly access WhatsApp libraries or project files.
It MUST communicate through defined local backend APIs.

### XVI. Internationalization and Directionality

ChatFrame MUST support Arabic and English.

Arabic UI MUST be RTL.

English UI MUST be LTR.

Directionality MUST be handled intentionally at the layout and component
level, not through ad-hoc CSS overrides.

Conversation rendering MUST support Arabic, English, emojis,
mixed-direction text, numbers, and timestamps without breaking layout.

### XVII. Desktop-First Local Web App

ChatFrame is a desktop-first local web app.

The primary target is a desktop browser connected to a local backend.

The UI SHOULD remain reasonably responsive, but mobile is not the primary
target unless specified later.

No Electron, Tauri, native desktop shell, CLI, hosted SaaS deployment, or
mobile app MUST be introduced unless explicitly specified later.

## Approved Technical Baseline

The approved baseline stack is:

```text
Backend:          Node.js + TypeScript + Fastify
Frontend:         React + Vite + Tailwind CSS
Chat renderer:    Custom CSS
WhatsApp adapter: whatsapp-web.js
Storage:          Filesystem + JSON/NDJSON + media folders
Primary export:   HTML with local assets
```

Changing any major part of this baseline requires an explicit technical
decision and MUST NOT happen accidentally during feature implementation.

## Additional Constraints

### XVIII. Performance Through Streaming and Batching

The application MUST be designed to handle large conversations without
loading everything into memory at once.

Message import, normalization, storage, and rendering preparation SHOULD use
streaming, batching, pagination, or incremental processing where practical.

The UI preview SHOULD support large conversations through virtualization or
pagination when needed.

The application MUST avoid blocking the entire UI during long imports or
exports.

Progress and error states MUST be visible to the user.

### XIX. Explicit Error Handling

Errors MUST be handled deliberately.

The application MUST distinguish between:

```text
WhatsApp connection errors
authentication/session errors
import errors
media download errors
normalization warnings
storage errors
export errors
unsupported message types
```

Errors and warnings MUST be understandable to the user without exposing
sensitive internal details.

Developer logs may be more detailed, but MUST NOT include secrets, QR codes,
tokens, or private message contents unless explicitly required for local
debugging and clearly controlled.

### XX. Testable Core Logic

Core backend logic MUST be testable without connecting to WhatsApp.

Normalization, deduplication, reply resolution, timestamp handling, file
path generation, media linking, quality reporting, and export model creation
MUST be covered by tests using fixtures.

Fixtures MUST avoid real private user conversations unless explicitly placed
in a local ignored folder.

The codebase SHOULD include synthetic sample conversations for development
and UI testing.

### XXI. Generated Code Must Respect Architecture

AI-generated code from Claude Code, Gemini, AntiGravity, or any other tool
MUST follow this constitution.

Generated code MUST NOT introduce hidden dependencies, database layers,
cloud calls, telemetry, uncontrolled global state, untyped core logic, or
direct coupling between frontend and WhatsApp adapters.

If generated code violates the constitution, it MUST be rejected or
refactored before merging.

### XXII. Security and Dependency Hygiene

Dependencies MUST be chosen conservatively.

The project MUST avoid unknown forks, suspicious packages, abandoned
packages where safer alternatives exist, or packages that request
unnecessary permissions.

Package versions SHOULD be locked.

Dependency updates MUST be reviewed carefully, especially WhatsApp-related
packages.

No package may be added simply because generated code suggested it.

### XXIII. No Silent Data Loss

Silent data loss is forbidden.

If a message, media file, reply, reaction, or metadata field cannot be
imported, parsed, linked, displayed, or exported, the system MUST either
preserve it as unsupported data or record the issue in the quality report.

Unsupported content SHOULD be visible in the preview/export when possible.

## Development Workflow

### XXIV. Constitution Compliance Review

All specifications, plans, and task lists MUST include a constitution
compliance check before implementation begins.

Every pull request or code review MUST verify that the changes comply with
this constitution.

Complexity MUST be justified. If a simpler approach satisfies the
constitution, it MUST be preferred.

### XXV. Amendment Procedure

Changes to this constitution require an explicit amendment with:

```text
reason for change
affected principles
migration impact
new rule text
date of amendment
```

Feature specifications MUST NOT weaken these rules.

Implementation convenience is not a valid reason to bypass this constitution.

## Governance

This constitution is the highest-level technical authority for ChatFrame.

All future specs, plans, and tasks MUST include a constitution compliance
check. The plan template's "Constitution Check" section MUST validate
against every applicable principle before implementation proceeds.

Amendment rules:

- MAJOR version bump: Backward-incompatible governance or principle removals
  or redefinitions.
- MINOR version bump: New principle or section added or materially expanded
  guidance.
- PATCH version bump: Clarifications, wording, typo fixes, non-semantic
  refinements.

All PRs and reviews MUST verify compliance. Complexity MUST be justified.
Use `AGENTS.md` for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-06-09 | **Last Amended**: 2026-06-09
