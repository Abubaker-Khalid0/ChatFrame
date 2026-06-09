# Phase 1 Data Model: Repository Foundation and Tooling

**Feature**: 001-repo-foundation-tooling | **Date**: 2026-06-09

This phase introduces two small data structures only. There is no database and
no server-side persistence (Constitution V). The `HealthStatus` shape is owned
by `@chatframe/shared` and validated with Zod at the frontend boundary
(Constitution XIV). `LanguagePreference` lives only in the browser.

## Entity: LanguagePreference

The user's chosen interface language and its layout direction, persisted in the
browser and restored on later launches.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `language` | `'en' \| 'ar'` | Yes | Selected interface language. |
| `direction` | `'ltr' \| 'rtl'` | Yes | Derived layout direction (`en→ltr`, `ar→rtl`). |
| `hasChosen` | `boolean` | Yes | `true` once the user has explicitly chosen, used to decide whether to skip the welcome screen. |

**Persistence**: `localStorage` (via Zustand `persist`), key e.g.
`chatframe.language`. Frontend-only; never sent to the backend.

**Validation / derivation rules**:
- `direction` MUST always be consistent with `language` (`ar→rtl`, `en→ltr`);
  it is derived, never set independently (Constitution XVI).
- On load, if no stored value or an unrecognized value is found, default to
  `{ language: 'en', direction: 'ltr', hasChosen: false }` (Clarification:
  default English LTR; Edge Cases: unrecognized value → English LTR).
- FR-005: persisted and restored without re-prompting.
- FR-021: when `hasChosen === true` on launch, the welcome screen is skipped and
  the user lands on the next-step screen.

**State transitions**:

```text
[no/invalid stored value]
        │ app load → default {en, ltr, hasChosen:false}
        ▼
  Welcome screen shown
        │ user selects language + Continue
        ▼
  {language, direction, hasChosen:true}  ──► persisted to localStorage
        │ next launch (hasChosen:true)
        ▼
  Welcome skipped → Next-step screen
        │ language switcher (any screen)
        ▼
  language/direction updated immediately, hasChosen stays true (FR-020)
```

## Entity: HealthStatus

A simple readiness indicator reported by the backend and consumed by the
frontend to confirm the application is ready.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `'ok'` | Yes | Readiness flag. Backend returns `'ok'` when healthy. |
| `service` | `string` | No | Service identifier, e.g. `"chatframe-backend"`. |
| `timestamp` | `string` (ISO 8601) | No | Time the status was generated. |

**Ownership**: Defined as a Zod schema in `@chatframe/shared` (e.g.
`HealthStatusSchema`) with the TypeScript type inferred from it. Both backend
(response shape) and frontend (response validation) import it (FR-012).

**Validation rules**:
- The frontend MUST validate the response against `HealthStatusSchema` before
  treating the app as ready (Constitution XIV — runtime validation at
  boundaries).
- A network failure, non-2xx response, or schema-invalid body is treated as
  "not ready" and surfaces a clear non-technical message (FR-010,
  Constitution XIX), not a raw error.

**Consumption states (frontend)**:

```text
loading  → "Starting ChatFrame…" (neutral, non-technical)
ok       → app ready; shell/flow enabled
error /  → "ChatFrame isn't ready yet." (non-technical, retryable)
invalid
```

## Relationships

The two entities are independent. `LanguagePreference` governs presentation
(language + direction) of every screen, including the message shown for any
`HealthStatus` state, so health messages are rendered in the selected language
and direction.
