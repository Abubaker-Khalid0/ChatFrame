# Feature Specification: Shared Contracts and Mock Data

**Feature Branch**: `002-shared-contracts-mock-data`

**Created**: 2026-06-09

**Status**: Draft

## Clarifications

### Session 2026-06-09

- Q: How should the application determine whether to use the mock adapter vs the real messaging adapter? → A: Mock mode is toggled via an environment variable (e.g., MOCK_MODE=true).
- Q: How many synthetic one-to-one chats should the mock fixture include? → A: 8 mock chats to test list layout, search, timestamps, and varied names.
- Q: How many messages should the synthetic mock conversation contain? → A: 50–80 messages, enough to demonstrate scrolling, date separators, and all message types.
- Q: Should the mock data use culturally authentic Arabic/English names and realistic message content? → A: Yes, use culturally authentic names and realistic content for believable demos and QA.
- Q: Should the mock adapter simulate realistic delays or return data instantly? → A: Return data instantly; simulated delays can be added later if needed.

**Input**: User description: "Phase 2 — Shared Contracts and Mock Data: Define all project-owned data shapes and validation rules in a shared location so that the local service and the user interface always agree on the structure of chats, messages, import status, export settings, and quality information. Create a synthetic mock conversation and a mock integration adapter so the full application flow can be developed, demonstrated, and tested without connecting to any real messaging service."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Develop and demonstrate the full application flow without a real messaging connection (Priority: P1)

A contributor or reviewer opens ChatFrame and navigates through the entire
wizard — from welcome screen to chat selection, import progress, quality
report, conversation preview, and export settings — all powered by realistic
synthetic data. No real WhatsApp account or phone is needed. This lets the
team build, refine, and validate every screen before the real messaging
integration exists.

**Why this priority**: This is the highest-value capability of this phase
because it unblocks all frontend and backend development for every later
phase. Without a working mock data flow, UI work would stall waiting for
the real messaging integration. It also enables stakeholder demos and early
visual QA.

**Independent Test**: Can be fully tested by starting the app in mock mode,
navigating through every wizard step, and confirming that realistic
synthetic data appears on each screen — including a mock chat list, mock
import progress, a mock quality report, and a mock conversation preview —
without any real messaging connection.

**Acceptance Scenarios**:

1. **Given** the application is running in mock mode, **When** the user
   navigates to the chat selection screen, **Then** a list of synthetic
   one-to-one chats is displayed with contact names, phone numbers, and
   recent message previews.
2. **Given** a mock chat is selected, **When** the user proceeds to the
   conversation preview, **Then** a synthetic conversation is rendered
   showing a variety of message types (text, images, replies, deleted,
   edited, unsupported) with realistic content.
3. **Given** the mock conversation is loaded, **When** the user views the
   preview, **Then** Arabic text renders correctly in right-to-left
   direction, English text renders left-to-right, and mixed-language
   messages display without layout breakage.
4. **Given** the import has completed in mock mode, **When** the user views
   the quality report, **Then** it displays realistic metrics including
   total messages, duplicates removed, unresolved replies, missing images,
   and unsupported message counts.

---

### User Story 2 - Ensure the local service and user interface always agree on data shapes (Priority: P2)

A contributor adds or modifies a field on a shared data shape — for example,
adding a new message type or renaming a property. The project-wide type
check immediately surfaces any mismatch between the local service and the
user interface, preventing silent data contract drift.

**Why this priority**: Shared contracts are the technical foundation that
every subsequent feature depends on. If the local service and the user
interface disagree on data shapes, bugs appear silently at runtime. Catching
mismatches at build time eliminates an entire class of integration errors.
However, this story provides no direct end-user outcome, so it ranks below
the mock flow.

**Independent Test**: Can be fully tested by making a deliberate change to a
shared data shape (e.g., renaming a field), running the project-wide type
check, and confirming that the tool immediately reports errors in every file
that references the old name — in both the local service and the user
interface.

**Acceptance Scenarios**:

1. **Given** shared data shapes are defined in a common location, **When**
   the local service and the user interface both reference these shapes,
   **Then** a project-wide type check passes with zero errors.
2. **Given** a contributor changes a shared data shape, **When** the
   project-wide type check is run, **Then** any file in the local service
   or the user interface that uses the old shape is reported as an error.
3. **Given** shared data shapes include validation rules, **When** the local
   service receives data from an external source or the user interface sends
   data to the local service, **Then** the data is validated against these
   rules at the boundary and invalid data is rejected with a clear reason.

---

### User Story 3 - Validate data at system boundaries using shared rules (Priority: P3)

When data arrives from an external source (e.g., the future messaging
adapter) or flows between the local service and the user interface, it is
validated against shared rules before being accepted. Invalid data is
rejected with a clear, descriptive reason rather than silently corrupting
the application state.

**Why this priority**: Runtime validation prevents corrupt or unexpected
data from propagating through the system. While the project's governance
requires validation at all boundaries, this is a safeguard that builds on
the shared shapes (P2) and primarily benefits system reliability rather
than direct user experience.

**Independent Test**: Can be fully tested by sending deliberately malformed
data to a local service endpoint and confirming it is rejected with a
descriptive validation error, while valid data is accepted and processed.

**Acceptance Scenarios**:

1. **Given** a shared validation rule defines the structure of a chat
   summary, **When** the local service receives a chat summary with a
   missing required field, **Then** the validation rejects it and reports
   which field is missing.
2. **Given** a shared validation rule defines the structure of a message,
   **When** a mock adapter returns a message with an unexpected type value,
   **Then** the validation rejects it and reports the invalid value.
3. **Given** the user interface sends export settings to the local service,
   **When** a required field is missing, **Then** the local service responds
   with a clear validation error rather than silently accepting the request.

---

### User Story 4 - Cover all critical message scenarios in synthetic test data (Priority: P3)

The synthetic mock conversation includes representative examples of every
message scenario the application will encounter — Arabic text, English text,
mixed language, emojis, images with captions, replies, deleted messages,
edited messages, unsupported message types, date separators, and missing
media. This ensures that rendering, normalization, and export logic can be
developed and tested against a comprehensive fixture before any real data
exists.

**Why this priority**: Comprehensive fixtures prevent gaps in rendering and
normalization from being discovered late. However, this is an extension of
the mock data (P1) rather than an independent capability, so it sits at a
lower priority.

**Independent Test**: Can be fully tested by loading the synthetic
conversation, rendering it in the preview, and verifying that every expected
message scenario is present and visually distinguishable — including Arabic
RTL, English LTR, mixed text, emoji, image bubbles, reply blocks, deleted
indicators, edited labels, unsupported cards, date separators, and missing
image placeholders.

**Acceptance Scenarios**:

1. **Given** the synthetic conversation fixture, **When** it is loaded into
   the preview, **Then** at least one example of each required message
   scenario (Arabic, English, mixed, emoji, image, reply, deleted, edited,
   unsupported, date separator, missing image) is present.
2. **Given** the synthetic conversation includes messages spanning multiple
   dates, **When** rendered in the preview, **Then** date separators appear
   at the correct boundaries.
3. **Given** the synthetic conversation includes a long message (500+
   characters), **When** rendered, **Then** the text wraps correctly within
   the message bubble without overflowing.

---

### Edge Cases

- What happens when the mock adapter returns an empty chat list? The chat
  selection screen shows a clear "no chats found" state rather than a blank
  or broken layout.
- What happens when a mock message has a reply reference to a message that
  does not exist in the fixture? The reply is marked as unresolved and
  displayed with a "message not found" indicator rather than crashing.
- What happens when validation rejects data at a boundary? The rejection
  includes a human-readable description of which field failed and why,
  rather than a generic or technical error.
- What happens when the mock conversation contains consecutive messages from
  the same sender? They are rendered with appropriate visual grouping rather
  than treating each as fully independent.
- What happens when the shared data shapes evolve between phases? Existing
  validation rules continue to enforce the contract; any incompatibility is
  caught by the type check before it reaches the user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST define a complete set of shared data shapes
  covering: chat summaries, messages (with all supported sub-types),
  connection states, import progress, quality reports, and export settings.
- **FR-002**: Each shared data shape MUST have a corresponding set of
  validation rules that can be executed at runtime to verify that data
  conforms to the expected structure.
- **FR-003**: The local service and the user interface MUST both reference
  the shared data shapes from a common source, so that a project-wide type
  check catches any mismatch between them.
- **FR-004**: The project MUST define a messaging adapter interface that
  describes the capabilities the application requires from any messaging
  integration — without depending on or exposing the internals of any
  specific messaging library.
- **FR-005**: The messaging adapter interface MUST NOT include any capability
  to send, edit, or delete messages (read-only contract).
- **FR-006**: A mock adapter MUST implement the messaging adapter interface
  using synthetic fixture data, enabling the full application flow without
  a real messaging connection. The mock adapter MUST return data instantly
  without simulating network delays.
- **FR-007**: The mock adapter MUST return 8 synthetic one-to-one chat
  summaries when asked for private chats, and a synthetic conversation of
  50–80 messages when asked for a conversation — matching the shapes
  defined in FR-001.
- **FR-008**: The local service MUST expose mock endpoints that serve
  synthetic data (chat list, conversation preview) to the user interface.
- **FR-009**: The user interface MUST connect to the local service and
  display mock data on each wizard screen, demonstrating the full
  application flow.
- **FR-010**: The synthetic mock conversation MUST include at least one
  example of every required message scenario: Arabic text, English text,
  mixed Arabic/English text, emoji-only, outgoing, incoming, image with
  caption, reply to text, reply to image, unresolved reply, deleted
  message, edited message, unsupported message type, date separator, long
  message (500+ characters), missing image placeholder, and consecutive
  same-sender messages.
- **FR-011**: All mock data MUST pass the shared validation rules — the mock
  adapter MUST NOT bypass validation.
- **FR-012**: Validation at system boundaries MUST reject invalid data with
  a clear, human-readable reason that identifies which field failed and why.
- **FR-013**: The application MUST NOT make any network request during this
  phase other than local communication between the user interface and the
  local service.
- **FR-014**: The application MUST NOT include any telemetry, analytics,
  remote logging, or crash reporting.
- **FR-015**: The application MUST select between the mock adapter and the
  real adapter based on an environment variable, so that mock mode can be
  activated without changing source code.
- **FR-016**: All synthetic fixture data — including chat names, phone
  numbers, message content, and timestamps — MUST use culturally authentic
  Arabic and English values to produce realistic, believable demos and
  QA sessions.
- **FR-017**: The mock adapter MUST support at least 8 synthetic one-to-one
  chats with varied contact names, phone numbers, and last-message
  timestamps to enable meaningful search and list layout testing.

### Key Entities *(include if feature involves data)*

- **Chat Summary**: A compact representation of a single one-to-one
  conversation, containing a unique identifier, contact display name, phone
  number, a flag indicating whether it is a group chat, and the most recent
  message preview with its timestamp.
- **Normalized Message**: A single message in a conversation after
  processing, containing sender identity, direction (incoming/outgoing),
  content, timestamp (both original and normalized), message type (text,
  image, deleted, unsupported), delivery status, edit/delete flags, optional
  reply reference, optional image metadata, and optional unsupported-type
  details.
- **Quality Report**: A summary of data accuracy after import/normalization,
  including counts of raw and normalized messages, duplicates removed,
  unresolved replies, missing images, unsupported message types by kind,
  date range covered, and any warnings or errors encountered.
- **Connection State**: The current status of the messaging adapter, ranging
  from disconnected through QR-ready to connected, with error states for
  expiry and failure.
- **Import Progress**: A real-time status indicator for an ongoing import,
  tracking the current stage, messages and images processed, warnings, and
  start/completion timestamps.
- **Export Settings**: The user's privacy and presentation choices for an
  export, including whether to show contact name and phone number, an
  optional display alias, watermark toggle, and theme selection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor can navigate through the full wizard flow (chat
  selection → import → quality report → preview → export settings) using
  synthetic data in under 60 seconds, without any real messaging connection.
- **SC-002**: A project-wide type check passes with zero errors when both
  the local service and the user interface reference the shared data shapes.
- **SC-003**: A deliberate change to a shared data shape causes the
  project-wide type check to report errors in 100% of affected files across
  both the local service and the user interface.
- **SC-004**: 100% of synthetic mock data passes the shared validation rules
  without exception.
- **SC-005**: When deliberately malformed data is sent to a validated
  boundary, the system rejects it with a human-readable reason that
  identifies the failing field in 100% of cases.
- **SC-006**: The synthetic mock conversation contains at least one example
  of every required message scenario listed in FR-010.
- **SC-007**: No network activity occurs beyond local service-to-interface
  communication during normal use of this phase.

## Assumptions

- Phase 1 (Repository Foundation and Tooling) is complete: the monorepo,
  tooling, app shell, and language switching are already functional.
- The shared data shapes defined in this phase are the initial versions;
  they may evolve in later phases as real integration reveals new needs, but
  the validation contract ensures backward-incompatible changes are caught
  immediately.
- The mock adapter simulates a realistic but not exhaustive conversation —
  it is designed to cover rendering and processing edge cases, not to
  replicate the full volume or complexity of a real WhatsApp conversation.
- The mock conversation contains 50–80 messages and the mock chat list
  contains 8 chats, sized for scenario coverage and visual testing rather
  than stress testing.
- The mock adapter returns data instantly without simulating delays;
  delay simulation may be added later for UX testing if needed.
- Mock mode is controlled via an environment variable; no source code
  changes are needed to switch between mock and real adapters.
- The messaging adapter interface defined here is the contract for all
  future real integrations; the first real adapter (connecting to WhatsApp)
  will be built in a later phase.
- No real WhatsApp connection, session management, or message fetching
  occurs in this phase; all data is synthetic.
- The mock endpoints in the local service are temporary scaffolding; they
  will be replaced or extended when real data flows are implemented in
  later phases.
