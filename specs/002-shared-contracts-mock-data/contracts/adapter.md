# Contract: WhatsApp Adapter Interface

**Feature**: `002-shared-contracts-mock-data`
**Date**: 2026-06-09

## Purpose

The `WhatsAppAdapter` interface defines the contract between the ChatFrame
application and any WhatsApp integration library. It isolates all
WhatsApp-specific behavior behind a clean interface so the rest of the
application never depends on `whatsapp-web.js`, Baileys, or any other
library directly (Constitution IV).

## Interface Methods

### Lifecycle

| Method | Signature | Description |
|--------|-----------|-------------|
| `initialize` | `() => Promise<void>` | Start the adapter, begin session restoration or QR generation |
| `logout` | `() => Promise<void>` | End the current session cleanly |
| `destroy` | `() => Promise<void>` | Tear down the adapter and release resources |

### Connection State

| Method | Signature | Description |
|--------|-----------|-------------|
| `getConnectionState` | `() => ConnectionState` | Return the current connection state synchronously |
| `onQr` | `(callback: (qr: string) => void) => void` | Register a callback for QR code updates |
| `onStateChange` | `(callback: (state: ConnectionState) => void) => void` | Register a callback for state transitions |

### Data Access (Read-Only)

| Method | Signature | Description |
|--------|-----------|-------------|
| `listPrivateChats` | `() => Promise<ChatSummary[]>` | List all one-to-one chats (no groups) |
| `fetchMessages` | `(chatId: string, options: FetchMessagesOptions) => AsyncIterable<RawWhatsAppMessage>` | Stream messages from a chat |
| `downloadImage` | `(message: RawWhatsAppMessage) => Promise<DownloadedMedia \| null>` | Download media for an image message |

## Key Constraints

1. **Read-only**: No methods for sending, editing, or deleting messages
   (Constitution II).
2. **Streaming**: `fetchMessages` returns `AsyncIterable` for memory-safe
   processing of large conversations (Constitution XVIII).
3. **Normalized output**: Methods return project-owned types (`ChatSummary`,
   `ConnectionState`), not library types. `RawWhatsAppMessage` is the only
   adapter-internal type that crosses the boundary, and it is defined by the
   project, not by the library.
4. **No library leakage**: The interface does not reference `whatsapp-web.js`
   types anywhere.

## Supporting Types (Adapter-Internal)

### FetchMessagesOptions

```typescript
interface FetchMessagesOptions {
  limit?: number;       // Max messages to fetch (undefined = all)
  before?: string;      // Fetch messages before this ISO timestamp
  after?: string;       // Fetch messages after this ISO timestamp
}
```

### RawWhatsAppMessage

Project-owned representation of a raw message from the adapter, before
normalization. Preserves the original data without modification
(Constitution VI).

### DownloadedMedia

```typescript
interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}
```

## Implementations

| Implementation | Purpose | Phase |
|---------------|---------|-------|
| `MockAdapter` | Returns synthetic fixture data instantly | Phase 2 (this phase) |
| `WhatsappWebJsAdapter` | Real WhatsApp connection via `whatsapp-web.js` | Phase 5 |

## Selection

The active adapter is selected by `adapterFactory.ts` based on the
`MOCK_MODE` environment variable:

- `MOCK_MODE=true` → `MockAdapter`
- `MOCK_MODE=false` or unset → `WhatsappWebJsAdapter` (future)
