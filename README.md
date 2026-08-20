# ChatFrame

Turn a one-to-one WhatsApp conversation into a clean, self-contained HTML
archive that looks like WhatsApp and opens in any browser — offline, forever.

ChatFrame runs entirely on your own machine. It reads your conversations and
never sends, edits, or deletes anything. There is no cloud, no account, no
database, and no telemetry.

## How it works

You move through seven stages in a single dashboard:

1. **Connect** — link your WhatsApp by scanning a QR code.
2. **Choose chat** — pick one personal conversation (group chats are excluded).
3. **Import options** — text is always included; images are opt-in.
4. **Import** — live progress, with cancel and retry.
5. **Quality** — a report of exactly what was imported and what was missing.
6. **Preview** — the conversation rendered as WhatsApp-like bubbles.
7. **Export** — a portable HTML folder you can open, move, or back up.

Everything is written to a self-contained project folder on disk, so an import
survives a restart and can be re-normalized or re-exported without refetching.

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer (22 LTS recommended)
- [pnpm](https://pnpm.io/) 9 or newer — `corepack enable pnpm` if you have Corepack
- A desktop browser

No Chromium or browser automation is required: the WhatsApp connection is a
direct WebSocket link via [Baileys](https://github.com/WhiskeySockets/Baileys).

## Quick start

```bash
pnpm install
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
pnpm dev
```

Then open <http://localhost:5173>.

To try the full flow without connecting a real account, set `MOCK_MODE=true` in
`.env` and restart. The backend then serves synthetic conversations covering
Arabic, English, emoji, images, replies, edited, deleted, and unsupported
messages.

## Commands

| Command          | Description                                     |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Run the backend and frontend together.          |
| `pnpm build`     | Build all packages.                             |
| `pnpm test`      | Run the full test suite.                        |
| `pnpm typecheck` | Strict type-check every package.                |
| `pnpm lint`      | ESLint + Prettier check.                        |
| `pnpm format`    | Apply Prettier formatting.                      |

## Configuration

All settings live in `.env` — no source changes needed.

| Variable           | Default                     | Purpose                                  |
| ------------------ | --------------------------- | ---------------------------------------- |
| `BACKEND_PORT`     | `3714`                      | Local Fastify service port.              |
| `FRONTEND_PORT`    | `5173`                      | Vite dev server port.                    |
| `VITE_BACKEND_URL` | `http://localhost:3714`     | Backend URL used by the browser.         |
| `WORKSPACE_DIR`    | `./chatframe-data`          | Where imported projects are stored.      |
| `SESSION_DIR`      | `./chatframe-data/sessions` | WhatsApp session files.                  |
| `MOCK_MODE`        | `false`                     | Use synthetic data instead of WhatsApp.  |

Your workspace and session directories are git-ignored. Session credentials are
kept outside project folders and never appear in an export or a log.

## Where your data lives

Each import becomes one folder under `$WORKSPACE_DIR/projects/`, named
`chatframe_<date>_<contact>` (Arabic and other Unicode names are preserved):

```text
chatframe_2026-06-10_أحمد/
├── project.json      # manifest: display name, status, counts
├── source.json       # which adapter produced this data
├── raw/              # immutable, append-only NDJSON exactly as fetched
├── normalized/       # derived messages, participants, render model, quality report
├── media/images/     # downloaded images
├── exports/html/     # generated archive + assets
└── logs/             # import and normalization logs (structure only, no content)
```

`raw/` is never rewritten. Normalization is deterministic and always rebuilds
`normalized/` from it, writing to a staging directory that is promoted only on
full success — a failed run leaves your previous results untouched. Logs record
counts and timings, never message text, contact names, or session data.

## Architecture

```text
packages/shared/   # @chatframe/shared — types, Zod schemas, constants
backend/           # @chatframe/backend — Fastify local service
frontend/          # @chatframe/frontend — React + Vite dashboard
```

The shared package is the single source of truth for cross-cutting types, and
data is validated against those schemas at every boundary. The frontend talks
only to the local HTTP API — it never imports WhatsApp libraries and never
touches project files directly. All WhatsApp access sits behind one read-only
adapter interface, so the mock and real integrations are interchangeable.

**Backend:** Node.js · TypeScript · Fastify · Baileys · Zod · Pino
**Frontend:** React 19 · Vite · Tailwind CSS · TanStack Query · Zustand
**Tooling:** pnpm workspaces · Vitest · ESLint · Prettier

The interface is fully bilingual (Arabic RTL / English LTR) with light and dark
themes.

## Limitations

- **One-to-one chats only.** Group conversations are filtered out.
- **Images only.** Audio, video, documents, and stickers are preserved as
  visible "unsupported" placeholders — never silently dropped.
- **Full history only.** There is no date-range filter on import.
- **HTML export only.** No PDF, PNG, or ZIP.
- **One project at a time.** Finished projects stay on disk but cannot yet be
  reopened from the interface.
- **Desktop browsers only.** No mobile or tablet layout.
- **Unofficial integration.** Baileys is an unofficial WhatsApp client. WhatsApp
  can break or restrict it at any time, and using it carries risk to your
  account. Use it at your own discretion.

## Privacy

No data leaves your machine. The only network traffic is between the interface
and the local service, and between the local service and WhatsApp itself.

ChatFrame is not affiliated with, endorsed by, or provided by WhatsApp or Meta.
