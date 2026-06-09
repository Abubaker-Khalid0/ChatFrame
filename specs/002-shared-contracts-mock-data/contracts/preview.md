# API Contract: Conversation Preview

**Feature**: `002-shared-contracts-mock-data`
**Date**: 2026-06-09

## GET /api/projects/:projectId/preview

Retrieve the conversation preview for a project. Returns normalized messages
ready for rendering.

### Request

- **Method**: `GET`
- **Path**: `/api/projects/:projectId/preview`
- **Headers**: None required (local-only)
- **Path Parameters**:
  - `projectId` — the project identifier (string, non-empty)
- **Query Parameters**: None for this phase. Future phases may add
  `offset`/`limit` for pagination.
- **Body**: None

### Response — Success (200)

```json
{
  "projectId": "project-001",
  "chatId": "chat-001",
  "contactName": "أحمد محمد",
  "messages": [
    {
      "id": "msg-001",
      "chatId": "chat-001",
      "senderId": "me",
      "senderDisplayName": "Me",
      "isFromMe": true,
      "type": "text",
      "body": "Hello! How are you?",
      "timestampIso": "2026-06-07T09:00:00.000Z",
      "dateKey": "2026-06-07",
      "status": "read"
    }
  ],
  "totalMessages": 65
}
```

**Schema**:
- `messages`: Array of `NormalizedMessageSchema` (from `@chatframe/shared`).
- `totalMessages`: Total count (for future pagination awareness).

**Validation**:
- Each item in `messages` MUST pass `NormalizedMessageSchema` validation.
- Messages MUST be ordered by `timestampIso` ascending.

### Response — Error (404)

```json
{
  "error": "PROJECT_NOT_FOUND",
  "message": "No project found with the given ID"
}
```

### Response — Error (500)

```json
{
  "error": "PREVIEW_ERROR",
  "message": "Failed to load conversation preview"
}
```

### Behavior Notes

- In mock mode (`MOCK_MODE=true`), the `projectId` is accepted but the same
  synthetic conversation is returned regardless of value. This establishes the
  URL pattern for real mode.
- In real mode (future phases), the endpoint reads normalized messages from the
  project's filesystem storage.
- Messages include all sub-types: text, image, deleted, unsupported.
