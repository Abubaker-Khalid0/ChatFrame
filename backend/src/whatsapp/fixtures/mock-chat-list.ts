import type { ChatSummary } from '@chatframe/shared';
import { isEmptyChat, toChatSummary, type RawChatInfo } from '../chatMapping';

/** ISO timestamp → Unix seconds, as the adapter layer reports them. */
const ts = (iso: string): number => Date.parse(iso) / 1000;

/**
 * Synthetic adapter-shaped chats with culturally authentic Arabic and English
 * names (FR-017). Beyond the original eight text chats, the set covers a media
 * last message, a phone-only contact with a >100-char body (truncation), a
 * chat with no usable timestamp, and an empty chat that the adapter must
 * exclude (FR-021). The first chat (`chat-001`, أحمد محمد) is the subject of
 * the detailed conversation fixture.
 */
export const mockRawChats: RawChatInfo[] = [
  {
    id: 'chat-001',
    name: 'أحمد محمد',
    isGroup: false,
    user: '966501234567',
    timestamp: ts('2026-06-09T14:32:00.000Z'),
    lastMessage: { type: 'chat', body: 'تمام، نلتقي بكرة إن شاء الله 🙏' },
  },
  {
    id: 'chat-002',
    name: 'Sarah Johnson',
    isGroup: false,
    user: '14155550142',
    timestamp: ts('2026-06-09T11:05:00.000Z'),
    lastMessage: { type: 'chat', body: 'See you tomorrow! 😊' },
  },
  {
    id: 'chat-003',
    name: 'فاطمة الزهراء',
    isGroup: false,
    user: '966555512345',
    timestamp: ts('2026-06-08T19:45:00.000Z'),
    lastMessage: { type: 'chat', body: 'شكراً جزيلاً، وصلتني الملفات' },
  },
  {
    id: 'chat-004',
    name: 'Omar Khalid',
    isGroup: false,
    user: '971501112233',
    timestamp: ts('2026-06-08T08:20:00.000Z'),
    lastMessage: { type: 'chat', body: "Let's catch up next week" },
  },
  {
    id: 'chat-005',
    name: 'ليلى حسن',
    isGroup: false,
    user: '201002003000',
    timestamp: ts('2026-06-07T22:10:00.000Z'),
    lastMessage: { type: 'chat', body: 'أرسلت لك الصور 📸' },
  },
  {
    id: 'chat-006',
    name: 'David Chen',
    isGroup: false,
    user: '6598761234',
    timestamp: ts('2026-06-07T16:00:00.000Z'),
    lastMessage: { type: 'chat', body: 'Thanks for the update.' },
  },
  {
    id: 'chat-007',
    name: 'مريم عبدالله',
    isGroup: false,
    user: '962790001122',
    timestamp: ts('2026-06-06T13:30:00.000Z'),
    lastMessage: { type: 'chat', body: 'إن شاء الله نلتقي قريباً' },
  },
  {
    id: 'chat-008',
    name: 'Elena García',
    isGroup: false,
    user: '34600112233',
    timestamp: ts('2026-06-05T09:15:00.000Z'),
    lastMessage: { type: 'chat', body: '¡Perfecto! 👍' },
  },
  {
    // Media last message → emoji placeholder preview (FR-018).
    id: 'chat-009',
    name: 'خالد العتيبي',
    isGroup: false,
    user: '966509876543',
    timestamp: ts('2026-06-09T08:15:00.000Z'),
    lastMessage: { type: 'image', body: '' },
  },
  {
    // Phone-only contact (no saved name) with a >100-char body (FR-004).
    id: 'chat-010',
    name: null,
    isGroup: false,
    user: '4915123456789',
    timestamp: ts('2026-06-08T15:40:00.000Z'),
    lastMessage: {
      type: 'chat',
      body: 'Hey! Just wanted to follow up on the documents we discussed last week — let me know once you have had a chance to review them all.',
    },
  },
  {
    // A message exists but the source reported no usable timestamp (FR-007:
    // sorts after every dated chat).
    id: 'chat-011',
    name: 'Yusuf Rahman',
    isGroup: false,
    user: '8801712345678',
    timestamp: null,
    lastMessage: { type: 'chat', body: 'Assalamu alaikum! Long time no see.' },
  },
  {
    // Saved contact with zero history — must never reach the picker (FR-021).
    id: 'chat-012',
    name: 'New Contact',
    isGroup: false,
    user: '12025550199',
    timestamp: null,
    lastMessage: null,
  },
];

/**
 * The mapped, message-bearing fixture list exactly as `MockAdapter` serves it
 * (empty chats excluded, FR-021). Other mock routes (e.g. the preview) resolve
 * contacts from this list by id.
 */
export const mockChatList: ChatSummary[] = mockRawChats
  .filter((chat) => !chat.isGroup && !isEmptyChat(chat))
  .map(toChatSummary);
