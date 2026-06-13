import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  ExportSettingsSchema,
  type ExportSettings,
  type RenderEntry,
  type RenderModel,
} from '@chatframe/shared';
import {
  messageDirection,
  participantPhone,
  renderConversationHtml,
  type ExportLocale,
} from './renderConversationHtml';

const ME = '15550000001@c.us';
const CONTACT = '15551234567@c.us';

function model(entries: RenderEntry[], contactName = 'Sara'): RenderModel {
  return {
    projectId: 'proj-1',
    chatId: 'chat-1',
    participants: [
      { id: ME, displayName: 'Me', isMe: true },
      { id: CONTACT, displayName: contactName, isMe: false },
    ],
    entries,
    totalMessages: entries.filter((entry) => entry.kind === 'message').length,
  };
}

function textRow(overrides: Partial<Extract<RenderEntry, { kind: 'message' }>> = {}): RenderEntry {
  return {
    kind: 'message',
    id: 'msg-1',
    senderId: CONTACT,
    senderDisplayName: 'Sara',
    direction: 'received',
    type: 'text',
    timestampIso: '2026-06-07T08:30:15.000Z',
    dateKey: '2026-06-07',
    body: 'Hello there',
    ...overrides,
  };
}

async function render(
  renderModel: RenderModel,
  settings: ExportSettings = ExportSettingsSchema.parse({}),
  locale: ExportLocale = 'en',
): Promise<string> {
  const chunks: Buffer[] = [];
  const out = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  await renderConversationHtml(renderModel, { settings, locale }, out);
  return Buffer.concat(chunks).toString('utf8');
}

describe('document structure (research §2)', () => {
  it('emits the static skeleton linking fonts.css then style.css', async () => {
    const html = await render(model([textRow()]));
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html lang="en">');
    expect(html.indexOf('assets/fonts.css')).toBeLessThan(html.indexOf('assets/style.css'));
    expect(html).toContain('<div class="cf-chat-shell">');
    expect(html).toContain('<div class="cf-chat" data-theme="light">');
    expect(html).toContain('<div class="cf-chat__scroll">');
  });

  it('contains no <script> and no remote http(s) URLs (FR-002, FR-009)', async () => {
    const html = await render(
      model([textRow(), textRow({ id: 'm2', body: 'visit http://example.com please' })]),
    );
    expect(html).not.toContain('<script');
    // Message TEXT may mention a URL but no attribute/href ever references one.
    expect(html).not.toMatch(/(?:src|href)="https?:\/\//);
  });

  it('emits data-theme from settings', async () => {
    const dark = await render(model([textRow()]), ExportSettingsSchema.parse({ theme: 'dark' }));
    expect(dark).toContain('data-theme="dark"');
  });
});

describe('header (data-model §5)', () => {
  it('renders the generated avatar and contact name, phone hidden by default', async () => {
    const html = await render(model([textRow()]));
    expect(html).toContain('cf-chat__header');
    expect(html).toContain('<div class="cf-chat__header-name" dir="auto">Sara</div>');
    expect(html).toContain('role="img"');
    expect(html).toContain('background-color:#');
    expect(html).not.toContain('cf-chat__header-phone');
  });

  it('shows the phone when showPhoneNumber is true and the id is numeric', async () => {
    const html = await render(
      model([textRow()]),
      ExportSettingsSchema.parse({ showPhoneNumber: true }),
    );
    expect(html).toContain('<div class="cf-chat__header-phone">+15551234567</div>');
  });

  it('uses the contact name as the document title', async () => {
    const html = await render(model([textRow()]));
    expect(html).toContain('<title>Sara</title>');
  });
});

describe('message rows (data-model §5)', () => {
  it('aligns incoming left and outgoing right', async () => {
    const html = await render(
      model([
        textRow(),
        textRow({ id: 'm2', senderId: ME, senderDisplayName: 'Me', direction: 'sent' }),
      ]),
    );
    expect(html).toContain('cf-row--in');
    expect(html).toContain('cf-row--out');
    expect(html).toContain('cf-bubble--in');
    expect(html).toContain('cf-bubble--out');
  });

  it('shows the sender label only on the lead message of an incoming run', async () => {
    const html = await render(model([textRow(), textRow({ id: 'm2', body: 'Second' })]));
    expect(html.match(/cf-bubble__sender/g)).toHaveLength(1);
    expect(html.match(/cf-row--lead/g)).toHaveLength(1);
  });

  it('renders HH:MM:SS timestamps', async () => {
    const html = await render(model([textRow()]));
    expect(html).toMatch(/<time class="cf-bubble__time"[^>]*>\d{2}:\d{2}:\d{2}<\/time>/);
  });

  it('emits a date-separator pill', async () => {
    const html = await render(
      model([{ kind: 'date-separator', dateKey: '2026-06-07' }, textRow()]),
    );
    expect(html).toMatch(
      /<div class="cf-date"><span class="cf-date__badge">[^<]*2026[^<]*<\/span><\/div>/,
    );
  });

  it('resolves dir per message: rtl, ltr, and auto for mixed', async () => {
    const html = await render(
      model([
        textRow({ id: 'm1', body: 'مرحبا' }),
        textRow({ id: 'm2', body: 'Hello' }),
        textRow({ id: 'm3', body: 'Hello مرحبا' }),
      ]),
    );
    expect(html).toContain('<p class="cf-bubble__body" dir="rtl">مرحبا</p>');
    expect(html).toContain('<p class="cf-bubble__body" dir="ltr">Hello</p>');
    expect(html).toContain('<p class="cf-bubble__body" dir="auto">Hello مرحبا</p>');
  });

  it('renders a deleted message dimmed with localized text, never hidden (FR-023)', async () => {
    const html = await render(model([textRow({ isDeleted: true })]));
    expect(html).toContain('cf-bubble--deleted');
    expect(html).toContain('This message was deleted');
    expect(html).not.toContain('Hello there');
  });

  it('localizes deleted text in Arabic', async () => {
    const html = await render(
      model([textRow({ isDeleted: true })]),
      ExportSettingsSchema.parse({}),
      'ar',
    );
    expect(html).toContain('تم حذف هذه الرسالة');
  });

  it('renders the edited label beside the timestamp', async () => {
    const html = await render(model([textRow({ isEdited: true })]));
    expect(html).toContain('<span class="cf-bubble__edited">edited</span>');
  });

  it('renders a resolved reply block above the body', async () => {
    const html = await render(
      model([
        textRow({
          replyTo: { resolved: true, previewText: 'Original text', messageId: 'm0' },
        }),
      ]),
    );
    expect(html).toContain('<div class="cf-reply">');
    expect(html).toContain('Original text');
    expect(html.indexOf('cf-reply')).toBeLessThan(html.indexOf('cf-bubble__body'));
  });

  it('renders an unresolved reply placeholder', async () => {
    const html = await render(model([textRow({ replyTo: { resolved: false } })]));
    expect(html).toContain('cf-reply--unresolved');
    expect(html).toContain('Original message not available');
  });

  it('renders an unsupported message card with type and reason', async () => {
    const html = await render(
      model([
        textRow({
          type: 'unsupported',
          body: undefined,
          unsupported: { originalType: 'sticker', reason: 'Stickers are not supported' },
        }),
      ]),
    );
    expect(html).toContain('cf-unsupported');
    expect(html).toContain('Unsupported message · sticker');
    expect(html).toContain('Stickers are not supported');
  });
});

describe('images (data-model §5)', () => {
  const image = {
    mediaId: 'media-1',
    localPath: 'media/images/img_000001.jpg',
    exportPath: 'assets/media/img_000001.jpg',
    caption: 'Look at this',
  };

  it('renders an image with a relative assets/media src and its caption', async () => {
    const html = await render(model([textRow({ type: 'image', image })]));
    expect(html).toContain('src="assets/media/img_000001.jpg"');
    expect(html).toContain('<figcaption class="cf-image__caption"');
    expect(html).toContain('Look at this');
  });

  it('renders a placeholder card and preserves the caption for a missing image (FR-019)', async () => {
    const html = await render(
      model([textRow({ type: 'image', image: { ...image, missing: true } })]),
    );
    expect(html).toContain('cf-image__placeholder');
    expect(html).toContain('Image unavailable');
    expect(html).toContain('Look at this');
    expect(html).not.toContain('<img');
  });
});

describe('escaping (research §3)', () => {
  it('escapes a malicious body', async () => {
    const html = await render(model([textRow({ body: '<script>alert(1)</script>' })]));
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes a malicious caption in text and attribute positions', async () => {
    const html = await render(
      model([
        textRow({
          type: 'image',
          image: {
            mediaId: 'media-1',
            localPath: 'media/images/img_000001.jpg',
            exportPath: 'assets/media/img_000001.jpg',
            caption: '"><img src=x onerror=alert(1)>',
          },
        }),
      ]),
    );
    // No live element can form: every `<` of the payload is escaped and the
    // attribute value cannot break out of its quotes.
    expect(html).not.toContain('<img src=x');
    expect(html).not.toMatch(/alt="[^"]*"[^>]*onerror/);
    expect(html).toContain('alt="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes a malicious contact name in the header and title', async () => {
    const html = await render(model([textRow()], '<b>Evil & Co</b>'));
    expect(html).not.toContain('<b>');
    expect(html).toContain('<title>&lt;b&gt;Evil &amp; Co&lt;/b&gt;</title>');
  });
});

describe('privacy (US2, contract C6 / SC-005)', () => {
  function privacyModel(): RenderModel {
    return model([
      textRow({ id: 'm1', body: 'Hi, this is Sara speaking' }),
      textRow({ id: 'm2', senderId: ME, senderDisplayName: 'Me', direction: 'sent', body: 'Hey' }),
    ]);
  }

  it('showContactName:false replaces the name with the localized neutral label everywhere', async () => {
    const html = await render(
      privacyModel(),
      ExportSettingsSchema.parse({ showContactName: false }),
    );
    expect(html).toContain('<title>Contact</title>');
    expect(html).toContain('<div class="cf-chat__header-name" dir="auto">Contact</div>');
    expect(html).toContain('<div class="cf-bubble__sender" dir="auto">Contact</div>');
    expect(html).not.toContain('>Sara<');
    // The raw placeholder token never leaks into the document.
    expect(html).not.toContain('__contact__');
  });

  it('localizes the hidden-name placeholder in Arabic', async () => {
    const html = await render(
      privacyModel(),
      ExportSettingsSchema.parse({ showContactName: false }),
      'ar',
    );
    expect(html).toContain('جهة اتصال');
    expect(html).not.toContain('__contact__');
  });

  it('displayAlias replaces the contact name everywhere and wins over the hide toggle', async () => {
    const html = await render(
      privacyModel(),
      ExportSettingsSchema.parse({ showContactName: false, displayAlias: 'Friend' }),
    );
    expect(html).toContain('<title>Friend</title>');
    expect(html).toContain('<div class="cf-chat__header-name" dir="auto">Friend</div>');
    expect(html).toContain('<div class="cf-bubble__sender" dir="auto">Friend</div>');
    expect(html).not.toContain('>Sara<');
  });

  it('an empty alias is treated as unset', async () => {
    const html = await render(privacyModel(), ExportSettingsSchema.parse({ displayAlias: '  ' }));
    expect(html).toContain('<div class="cf-chat__header-name" dir="auto">Sara</div>');
  });

  it('showPhoneNumber toggles the header phone only', async () => {
    const shown = await render(
      privacyModel(),
      ExportSettingsSchema.parse({ showPhoneNumber: true }),
    );
    expect(shown).toContain('cf-chat__header-phone');
    expect(shown.match(/\+15551234567/g)).toHaveLength(1);

    const hidden = await render(privacyModel(), ExportSettingsSchema.parse({}));
    expect(hidden).not.toContain('cf-chat__header-phone');
    expect(hidden).not.toContain('+15551234567');
  });

  it('never alters message content even when the name is hidden (research §4)', async () => {
    const html = await render(
      privacyModel(),
      ExportSettingsSchema.parse({ showContactName: false, displayAlias: 'Friend' }),
    );
    // The body mentioning the real name stays verbatim.
    expect(html).toContain('Hi, this is Sara speaking');
  });

  it('renders a generated avatar from the privacy-applied name — never a real picture', async () => {
    const html = await render(
      privacyModel(),
      ExportSettingsSchema.parse({ displayAlias: 'Friend' }),
    );
    // The avatar circle shows the alias initial with a palette color.
    expect(html).toMatch(/background-color:#[0-9a-f]{6};">F<\/span>/);
    expect(html).not.toContain('<img class="cf-avatar');
  });
});

describe('theme (US3, contract C7 / SC-009)', () => {
  it('theme:"dark" sets data-theme="dark" on the .cf-chat root', async () => {
    const html = await render(model([textRow()]), ExportSettingsSchema.parse({ theme: 'dark' }));
    expect(html).toContain('<div class="cf-chat" data-theme="dark">');
  });

  it('theme:"light" sets data-theme="light" on the .cf-chat root', async () => {
    const html = await render(model([textRow()]), ExportSettingsSchema.parse({ theme: 'light' }));
    expect(html).toContain('<div class="cf-chat" data-theme="light">');
  });

  it('the bundled stylesheet resolves both themes via the data-theme attribute', async () => {
    // The verbatim chat-renderer.css copy defines the dark custom-property
    // overrides scoped to [data-theme='dark'] — one attribute flip suffices.
    const { readFile } = await import('node:fs/promises');
    const { CHAT_RENDERER_CSS_PATH } = await import('./copyExportAssets');
    const css = await readFile(CHAT_RENDERER_CSS_PATH, 'utf8');
    expect(css).toContain(".cf-chat[data-theme='dark']");
  });
});

describe('watermark (US4, contract C5 / SC-004)', () => {
  it('includes the fixed "Exported by ChatFrame" footer when enabled (the default)', async () => {
    const html = await render(model([textRow()]));
    expect(html).toContain('Exported by ChatFrame');
    expect(html).toContain('<footer class="cf-watermark"');
  });

  it('omits the watermark entirely when disabled', async () => {
    const html = await render(
      model([textRow()]),
      ExportSettingsSchema.parse({ showWatermark: false }),
    );
    expect(html).not.toContain('Exported by ChatFrame');
    expect(html).not.toContain('cf-watermark');
  });

  it('keeps the fixed English text regardless of locale (FR-008)', async () => {
    const html = await render(model([textRow()]), ExportSettingsSchema.parse({}), 'ar');
    expect(html).toContain('Exported by ChatFrame');
  });
});

describe('messageDirection (ported, FR-022)', () => {
  it('matches the preview component behavior', () => {
    expect(messageDirection('مرحبا')).toBe('rtl');
    expect(messageDirection('Hello')).toBe('ltr');
    expect(messageDirection('Hello مرحبا')).toBe('auto');
    expect(messageDirection('12345')).toBe('ltr');
    expect(messageDirection('👋')).toBe('auto');
    expect(messageDirection(undefined)).toBe('auto');
  });
});

describe('participantPhone (ported)', () => {
  it('formats a numeric WhatsApp id and rejects non-numeric ids', () => {
    expect(participantPhone('15551234567@c.us')).toBe('+15551234567');
    expect(participantPhone('mock-contact')).toBeUndefined();
  });
});
