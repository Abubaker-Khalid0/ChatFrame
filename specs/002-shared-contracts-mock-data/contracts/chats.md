# API Contract: Private Chats

**Feature**: `002-shared-contracts-mock-data`
**Date**: 2026-06-09

## GET /api/chats/private

List all private (one-to-one) chats available from the messaging adapter.

### Request

- **Method**: `GET`
- **Path**: `/api/chats/private`
- **Headers**: None required (local-only)
- **Query Parameters**: None
- **Body**: None

### Response — Success (200)

```json
{
  "chats": [
    {
      "id": "chat-001",
      "displayName": "أحمد محمد",
      "phoneNumber": "+966501234567",
      "isGroup": false,
      "lastMessagePreview": "كيف حالك؟",
      "lastMessageAt": "2026-06-09T14:30:00.000Z"
    }
  ]
}
```

**Schema**: Array of `ChatSummarySchema` (from `@chatframe/shared`).

**Validation**:
- Each item in the `chats` array MUST pass `ChatSummarySchema` validation.
- `isGroup` MUST be `false` for all returned items (filtered by adapter).

### Response — Error (500)

```json
{
  "error": "ADAPTER_ERROR",
  "message": "Failed to list chats from messaging adapter"
}
```

### Behavior Notes

- In mock mode (`MOCK_MODE=true`), returns 8 synthetic chats instantly.
- In real mode, delegates to `WhatsAppAdapter.listPrivateChats()`.
- Filters out group chats (Constitution III: one-to-one only).
