# Quickstart Validation Guide: Shared Contracts and Mock Data

**Feature**: `002-shared-contracts-mock-data`
**Date**: 2026-06-09

## Prerequisites

- Phase 1 (Repository Foundation and Tooling) fully complete and passing
- Node.js 20+, pnpm installed
- Dependencies installed: `pnpm install`

## Validation Scenarios

### 1. Shared Types Compile Cleanly

Verify all shared type definitions and Zod schemas compile without errors.

```bash
pnpm typecheck
```

**Expected outcome**: Zero type errors across all packages
(`@chatframe/shared`, `@chatframe/backend`, `@chatframe/frontend`).

---

### 2. Zod Schema Tests Pass

Verify all schema validation tests run successfully.

```bash
pnpm test
```

**Expected outcome**: All test suites pass with zero failures. Schema tests
should verify:
- Valid data passes validation
- Invalid data is rejected with field-level error messages
- `z.infer<>` types match the documented data model
  (see [data-model.md](data-model.md))

---

### 3. Mock Mode Starts Successfully

Start the application in mock mode and confirm both services are reachable.

```bash
# Terminal 1: Start with mock mode
MOCK_MODE=true pnpm dev
```

**Expected outcome**:
- Backend starts on port 3714 (or configured port)
- Frontend starts on port 5173 (or configured port)
- `GET http://localhost:3714/api/health` returns `{"status":"ok"}`

---

### 4. Mock Chat List Endpoint Returns Data

Verify the mock chats endpoint returns 8 synthetic chats.

```bash
curl http://localhost:3714/api/chats/private
```

**Expected outcome**: JSON response containing a `chats` array with exactly
8 items. Each item matches the `ChatSummary` shape defined in
[data-model.md](data-model.md):
- Non-empty `id`
- `displayName` with culturally authentic Arabic/English names
- `phoneNumber` values present
- `isGroup` is `false` for all items
- `lastMessagePreview` and `lastMessageAt` present

See [chats contract](contracts/chats.md) for the full response schema.

---

### 5. Mock Preview Endpoint Returns Conversation

Verify the mock preview endpoint returns the synthetic conversation.

```bash
curl http://localhost:3714/api/projects/mock-project/preview
```

**Expected outcome**: JSON response containing a `messages` array with
50–80 items. The conversation includes at least one of each required
scenario:

| Scenario | Validation |
|----------|------------|
| Arabic text | Look for a message with Arabic characters in `body` |
| English text | Look for a message with English `body` |
| Mixed language | Look for a message with both Arabic and English |
| Emoji-only | Look for a message where `body` is only emojis |
| Outgoing | Look for `isFromMe: true` |
| Incoming | Look for `isFromMe: false` |
| Image with caption | Look for `type: "image"` with `image.caption` |
| Reply to text | Look for `replyTo.resolved: true` |
| Unresolved reply | Look for `replyTo.resolved: false` |
| Deleted message | Look for `isDeleted: true` |
| Edited message | Look for `isEdited: true` |
| Unsupported type | Look for `type: "unsupported"` |
| Date separators | Look for multiple distinct `dateKey` values |
| Long message | Look for `body` with 500+ characters |
| Missing image | Look for `image.missing: true` |
| Consecutive sender | Look for 2+ adjacent messages with same `senderId` |

See [preview contract](contracts/preview.md) for the full response schema.

---

### 6. Frontend Wizard Flow Works End-to-End

Open the application in a desktop browser and navigate through the wizard.

1. Open `http://localhost:5173`
2. Select a language (Arabic or English)
3. Navigate to the chat picker screen
4. Confirm 8 chats appear in the list
5. Select a chat
6. Navigate through import → quality → preview screens
7. Confirm the preview renders the mock conversation with visible message
   bubbles, date separators, and varied message types
8. Navigate to the export settings screen (placeholder)

**Expected outcome**: Full wizard flow completes without errors. Chat picker
shows 8 chats. Preview renders the mock conversation with visible Arabic
and English messages.

---

### 7. Type Safety Catches Contract Drift

Deliberately break a shared type to verify the type check catches it.

```bash
# In packages/shared/src/schemas/chat.ts, rename 'displayName' to 'name'
# Then run:
pnpm typecheck
```

**Expected outcome**: Type errors reported in every file that references
`displayName` — in both `backend/` and `frontend/` packages. This proves
the shared contract enforcement works (SC-003).

After verifying, **revert the change**.

---

### 8. Validation Rejects Invalid Data

Send malformed data to a validated endpoint and confirm rejection.

```bash
# Example: POST invalid export settings (if endpoint exists)
# Or: Run unit tests that verify schema rejection
pnpm test -- --grep "validation"
```

**Expected outcome**: Validation rejects invalid data with a human-readable
error message identifying which field failed and why (FR-012).

---

### 9. No External Network Activity

During all the above tests, verify no external network requests are made.

```bash
# Use browser DevTools Network tab:
# - Filter by domain (exclude localhost)
# - Confirm zero external requests
```

**Expected outcome**: Zero network requests to any domain other than
`localhost` (SC-007).

---

### 10. Linting and Style Checks Pass

```bash
pnpm lint
```

**Expected outcome**: Zero lint errors across all packages.
