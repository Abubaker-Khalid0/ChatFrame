# Feature Specification: Repository Foundation and Tooling

**Feature Branch**: `001-repo-foundation-tooling`

**Created**: 2026-06-09

**Status**: Draft

## Clarifications

### Session 2026-06-09

- Q: When a user opens ChatFrame for the first time with no stored language preference, which language and direction should the app default to? → A: Default to English (LTR).
- Q: After the user selects a language and clicks "Continue" on the welcome screen, where should they land in this foundation phase? → A: Navigate to a placeholder "next step" screen with a friendly "coming soon" message in the selected language.
- Q: Should the user be able to switch language from any screen, or only from the welcome screen? → A: A language switcher should be accessible from the app shell on all screens.
- Q: When a returning user opens the app and their language is already stored, should the welcome screen be skipped? → A: Yes, returning users skip the welcome screen and land directly on the next step.
- Q: Should this foundation phase produce a root README.md with setup/run instructions? → A: Yes, include a minimal README.md with project description, prerequisites, setup instructions, and dev/test/lint commands.

**Input**: User description: "Phase 1 - Repository Foundation and Tooling: a stable full-stack TypeScript monorepo with all tooling configured and a working app shell with internationalization (Arabic RTL / English LTR) support."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose a language and see a correctly directioned interface (Priority: P1)

A first-time user opens ChatFrame in their desktop browser and is greeted by a
welcome screen. They are told, in plain language, that ChatFrame runs entirely
on their own machine and only reads their data. They choose either Arabic or
English. The interface immediately adapts: Arabic presents a right-to-left
layout, English presents a left-to-right layout. Their choice is remembered the
next time they open the app.

**Why this priority**: This is the only end-user-facing capability delivered by
the foundation phase, and it establishes the trust message (local-first,
read-only) and the bilingual, bidirectional experience that every later screen
depends on. Without it, no other screen can be presented correctly.

**Independent Test**: Can be fully tested by opening the app, selecting each
language, confirming the layout direction flips correctly, reloading the app,
and confirming the previously chosen language is restored.

**Acceptance Scenarios**:

1. **Given** a user opens ChatFrame for the first time, **When** the welcome
   screen loads, **Then** they see a clear statement that the app runs locally
   and is read-only, and they are offered a choice between Arabic and English.
2. **Given** the welcome screen is shown, **When** the user selects Arabic,
   **Then** the interface switches to a right-to-left layout using
   Arabic-appropriate typography.
3. **Given** the welcome screen is shown, **When** the user selects English,
   **Then** the interface switches to a left-to-right layout using
   English-appropriate typography.
4. **Given** a user has previously chosen a language, **When** they reopen the
   app, **Then** the welcome screen is skipped and they land directly on the
   next step with their previously chosen language and direction restored.
5. **Given** the user is on any screen after the welcome screen, **When** they
   use the language switcher in the app shell, **Then** the interface language
   and direction switch immediately without navigating away.

---

### User Story 2 - Launch the complete local application reliably (Priority: P2)

A user (or the developer running the app on the user's behalf) starts ChatFrame
with a single action. Both the local service that will later handle WhatsApp
work and the user-facing interface start together and successfully communicate
with each other, confirming the app is healthy and ready to use.

**Why this priority**: A dependable local startup and a verified link between
the interface and its local service is the backbone every subsequent feature
builds on. It must exist before any session, import, preview, or export work can
begin, but it delivers no standalone end-user outcome beyond "the app runs," so
it sits below the language experience.

**Independent Test**: Can be fully tested by starting the app with the documented
single command, confirming both the interface and the local service come up on
their expected local addresses, and confirming the interface reports a
successful health check from the local service.

**Acceptance Scenarios**:

1. **Given** a clean local environment with dependencies installed, **When** the
   user runs the documented start command, **Then** both the interface and the
   local service start and become reachable on their default local addresses.
2. **Given** the application is running, **When** the interface requests a health
   status from the local service, **Then** it receives a successful response and
   indicates the app is ready.
3. **Given** the local service is not running, **When** the interface attempts a
   health check, **Then** the user is shown a clear, non-technical message that
   the app is not ready rather than an unexplained failure.

---

### User Story 3 - Build on a consistent, quality-enforced foundation (Priority: P3)

A contributor works in a single, organized project that cleanly separates shared
definitions, the local service, and the user interface. Automated quality checks
(type safety, code style, and tests) run consistently across the whole project,
so mistakes are caught early and the codebase stays maintainable as later phases
are added.

**Why this priority**: Consistent structure and automated quality gates protect
long-term reliability and accuracy, which the project's governance requires.
This is essential for sustainable delivery but provides no direct end-user
outcome, so it is the lowest priority of the three.

**Independent Test**: Can be fully tested by running the project-wide type check,
style check, and test commands on a fresh checkout and confirming each completes
with no errors and no failures.

**Acceptance Scenarios**:

1. **Given** a fresh checkout of the project, **When** the project-wide type
   check is run, **Then** it completes with zero type errors across all parts of
   the project.
2. **Given** a fresh checkout, **When** the project-wide style check is run,
   **Then** it completes with no style violations.
3. **Given** a fresh checkout, **When** the project-wide test command is run,
   **Then** the test runner executes successfully with zero failures.
4. **Given** the project structure, **When** a contributor inspects it, **Then**
   shared definitions, the local service, and the user interface are clearly
   separated and the user interface can reference the shared definitions.

---

### Edge Cases

- What happens when the user's browser has no previously stored language choice
  (first run) versus a stored but unrecognized value? The app defaults to
  English (LTR) rather than rendering an ambiguous or broken layout.
- How does the interface behave when the local service is slow to start or
  temporarily unreachable during startup? The user sees a clear "not ready yet"
  state instead of a blank screen or a raw error.
- What happens when content mixes Arabic and English (and numbers) on the same
  screen? The layout direction follows the selected interface language and does
  not break or misalign.
- What happens if the configured local addresses are already in use? Startup
  surfaces an understandable message rather than failing silently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST present a welcome screen on first launch that
  allows the user to choose between Arabic and English.
- **FR-002**: The welcome screen MUST clearly state, in the selected language,
  that ChatFrame runs locally on the user's machine and is read-only.
- **FR-003**: The application MUST render a right-to-left layout when Arabic is
  selected and a left-to-right layout when English is selected.
- **FR-004**: The application MUST apply language-appropriate typography for
  Arabic and English, with graceful fallback when a preferred font is
  unavailable.
- **FR-005**: The application MUST persist the user's selected language locally
  and restore it on subsequent launches without prompting again.
- **FR-006**: The application MUST start the user interface and the local service
  together through a single documented start action.
- **FR-007**: The local service MUST expose a health status that the interface
  can query to confirm readiness.
- **FR-008**: The interface MUST be able to successfully communicate with the
  local service during local development, including across their separate default
  local addresses.
- **FR-009**: The application MUST allow its default local addresses to be
  configured without changing source code.
- **FR-010**: The interface MUST present a clear, non-technical message when the
  local service is unavailable instead of an unexplained failure.
- **FR-011**: The project MUST be organized as a single workspace that clearly
  separates shared definitions, the local service, and the user interface.
- **FR-012**: The user interface and the local service MUST both be able to use a
  shared set of common definitions to avoid divergence.
- **FR-013**: The project MUST enforce strict type safety across all parts, such
  that a project-wide type check completes with zero errors.
- **FR-014**: The project MUST provide automated code-style checking that passes
  across all files.
- **FR-015**: The project MUST provide an automated test capability that runs
  across all parts of the project and completes with zero failures for the
  baseline.
- **FR-016**: The application MUST NOT make any network request during this phase
  other than local communication between the interface and the local service.
- **FR-017**: The application MUST NOT include any telemetry, analytics, remote
  logging, or crash reporting.
- **FR-018**: A basic application shell MUST be visible in the browser, including
  the language selection, as the entry point for later wizard steps.
- **FR-019**: After selecting a language and continuing, the user MUST be
  navigated to a placeholder screen that displays a friendly "next steps coming
  soon" message in the selected language, serving as the destination for the
  wizard flow in this phase.
- **FR-020**: A language switcher MUST be accessible from the app shell on all
  screens, allowing the user to change language and direction at any time
  without returning to the welcome screen.
- **FR-021**: When a returning user opens the app with a previously stored
  language preference, the welcome screen MUST be skipped and the user MUST
  land directly on the next step.
- **FR-022**: The project MUST include a root README.md with the project
  description, prerequisites, setup instructions, and commands for running
  the dev server, tests, and linting.

### Key Entities *(include if feature involves data)*

- **Language Preference**: The user's chosen interface language (Arabic or
  English) and its associated layout direction (right-to-left or left-to-right),
  stored locally so it can be restored on later launches.
- **Health Status**: A simple readiness indicator reported by the local service
  and consumed by the interface to confirm the application is ready for use.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can select a language and reach a correctly directioned
  app shell in under 30 seconds from first opening the app.
- **SC-002**: Switching between Arabic and English changes the layout direction
  correctly in 100% of attempts, with no broken or misaligned layouts.
- **SC-003**: A returning user has their previously selected language restored
  automatically on 100% of subsequent launches.
- **SC-004**: Starting the application with the single documented action results
  in both the interface and local service being reachable and reporting a
  successful health check on the first attempt.
- **SC-005**: On a fresh checkout, the project-wide type check, style check, and
  test run each complete with zero errors and zero failures.
- **SC-006**: No network activity occurs beyond local interface-to-service
  communication during normal use of this phase.

## Assumptions

- The primary target is a modern desktop browser connected to a local service on
  the same machine, consistent with the project's desktop-first scope.
- Arabic and English are the only languages required for this phase; no
  additional languages are in scope.
- Language preference is stored using standard local browser storage; no account,
  database, or cloud storage is involved.
- Default local addresses follow the project's documented defaults and are
  configurable through local environment configuration.
- This phase delivers the foundation and the welcome/language experience only;
  WhatsApp connection, chat selection, import, preview, and export are delivered
  in later phases and are out of scope here.
- Returning users who already have a stored language preference skip the welcome
  screen and land on the next step directly.
- The baseline test capability is expected to run successfully even before
  substantial feature tests exist (a green baseline), rather than requiring a
  specific minimum number of tests.
