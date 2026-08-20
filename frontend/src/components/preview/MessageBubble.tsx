import { PRIVACY_NAME_PLACEHOLDER, type MessageRow } from '@chatframe/shared';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useTranslations } from '../../i18n';
import { messageDirection } from './messageDirection';
import { ReplyPreview } from './ReplyPreview';
import { ImageMessage } from './ImageMessage';

const LOCALES: Record<string, string> = { en: 'en-US', ar: 'ar' };

/**
 * A single conversation bubble — WhatsApp-accurate presentation. Outgoing
 * messages sit on the right, incoming on the left. Text direction is resolved
 * per message. When `showSender` is true (first of a consecutive same-sender
 * run) the sender name and bubble tail are shown.
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

  // h:mm AM/PM format matching WhatsApp reference
  const time = new Intl.DateTimeFormat(LOCALES[language] ?? language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
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

        <span className="cf-bubble__meta">
          {!isDeleted && message.isEdited === true && (
            <span className="cf-bubble__edited">{t.preview.edited}</span>
          )}
          <time className="cf-bubble__time" dateTime={message.timestampIso}>
            {time}
          </time>
          {isOutgoing && !isDeleted && <ReadReceipt />}
        </span>
      </div>
    </div>
  );
}

/** Blue double-check read receipt for outgoing messages. */
function ReadReceipt() {
  return (
    <span className="cf-bubble__receipt cf-bubble__receipt--read" aria-label="Read">
      <svg viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M11.07 0.66L4.98 6.75L2.91 4.68L1.5 6.09L4.98 9.57L12.48 2.07L11.07 0.66Z"
          fill="currentColor"
        />
        <path
          d="M14.07 0.66L7.98 6.75L7.01 5.79L5.6 7.2L7.98 9.57L15.48 2.07L14.07 0.66Z"
          fill="currentColor"
        />
      </svg>
    </span>
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
