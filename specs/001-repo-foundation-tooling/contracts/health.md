# Contract: Health Endpoint

**Feature**: 001-repo-foundation-tooling | **Date**: 2026-06-09

The only external interface exposed in this phase. It lets the frontend confirm
the local backend is ready (FR-007, FR-008, FR-010). The response shape is owned
by `@chatframe/shared` (`HealthStatusSchema`) so backend and frontend cannot
diverge (FR-012).

## `GET /api/health`

Returns the backend readiness status.

### Request

- **Method**: `GET`
- **Path**: `/api/health`
- **Auth**: None (local-only service; no auth introduced this phase).
- **Body**: None.
- **Origin**: Called cross-origin by the Vite dev server (default
  `http://localhost:5173` → `http://localhost:3714`); backend MUST allow this
  origin via CORS (FR-008).

### Response — 200 OK

`Content-Type: application/json`

```json
{
  "status": "ok",
  "service": "chatframe-backend",
  "timestamp": "2026-06-09T17:16:06.000Z"
}
```

Schema (`HealthStatusSchema` in `@chatframe/shared`):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `status` | `"ok"` | Yes | Literal; present only when healthy. |
| `service` | `string` | No | Service identifier. |
| `timestamp` | `string` (ISO 8601) | No | Generation time. |

### Behavior contract

- The frontend MUST validate the body against `HealthStatusSchema` before
  treating the app as ready (Constitution XIV).
- If the backend is unreachable, returns a non-2xx, or returns a body that fails
  schema validation, the frontend MUST present a clear, non-technical "app not
  ready" message in the selected language (FR-010, Constitution XIX) and MUST NOT
  expose raw errors or internal details.
- The endpoint MUST NOT trigger any external network activity and MUST NOT log
  secrets (Constitution I, XIII, XIX).

### Acceptance mapping

- **FR-007 / AC-2 (Story 2)**: healthy backend → `200` with `status: "ok"` →
  frontend indicates ready.
- **FR-010 / AC-3 (Story 2)**: backend not running → frontend shows non-technical
  not-ready message.
- **SC-004**: with `pnpm dev`, first health request after startup succeeds.
