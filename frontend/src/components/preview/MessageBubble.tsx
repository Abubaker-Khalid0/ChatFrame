import { PRIVACY_NAME_PLACEHOLDER, type MessageRow } from '@chatframe/shared';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useTranslations } from '../../i18n';
import { messageDirection } from './messageDirection';
import { ReplyPreview } from './ReplyPreview';
import { ImageMessage } from './ImageMessage';

const LOCALES: Record<string, string> = { en: 'en-US', ar: 'ar' };

/**
 * A single conversation bubble (008 FR-008/010/013/014/022/026). Outgoing
 * messages sit on the right, incoming on the left — the WhatsApp convention,
 * held stable regardless of the app shell's direction by the renderer CSS.
 * Text direction is resolved per message (Constitution XVI). When
 * `showSender` is true (first of a consecutive same-sender run) the sender
 * name and bubble tail are shown; later messages of the run group tightly.
 */
export function MessageBubble({
  message,
  showSender,
  projectId,
}: {
  message: MessageRow;
  showSender: boolean;
  projectId: string;
}) {
  const t = useTranslations();
  const language = useLanguageStore((s) => s.language);

  const isOutgoing = message.direction === 'sent';
  const isDeleted = message.isDeleted === true || message.type === 'deleted';

  // HH:MM:SS timestamps (FR-010).
  const time = new Intl.DateTimeFormat(LOCALES[language] ?? language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(message.timestampIso));

  const senderName = isOutgoing
    ? t.preview.you
    : message.senderDisplayName === PRIVACY_NAME_PLACEHOLDER
      ? t.preview.contact
      : (message.senderDisplayName ?? '');

  const rowClass = `cf-row ${isOutgoing ? 'cf-row--out' : 'cf-row--in'}${showSender ? ' cf-row--lead' : ''}`;
  const bubbleClass = `cf-bubble ${isOutgoing ? 'cf-bubble--out' : 'cf-bubble--in'}${isDeleted ? ' cf-bubble--deleted' : ''}`;

  return (
    <div className={rowClass}>
      <div className={bubbleClass}>
        {showSender && !isOutgoing && (
          <div className="cf-bubble__sender" dir="auto">
            {senderName}
          </div>
        )}

        {!isDeleted && message.replyTo && <ReplyPreview reply={message.replyTo} />}

        <BubbleBody message={message} isDeleted={isDeleted} projectId={projectId} />

        <div className="cf-bubble__meta">
          {!isDeleted && message.isEdited === true && (
            <span className="cf-bubble__edited">{t.preview.edited}</span>
          )}
          <time className="cf-bubble__time" dateTime={message.timestampIso}>
            {time}
          </time>
        </div>
      </div>
    </div>
  );
}

function BubbleBody({
  message,
  isDeleted,
  projectId,
}: {
  message: MessageRow;
  isDeleted: boolean;
  projectId: string;
}) {
  const t = useTranslations();

  // Deleted treatment replaces the body but the message stays visible (FR-013).
  if (isDeleted) {
    return <p className="cf-bubble__body">{t.preview.deletedMessage}</p>;
  }

  if (message.type === 'image' && message.image) {
    return <ImageMessage image={message.image} projectId={projectId} />;
  }

  return (
    <p className="cf-bubble__body" dir={messageDirection(message.body)}>
      {message.body}
    </p>
  );
}
