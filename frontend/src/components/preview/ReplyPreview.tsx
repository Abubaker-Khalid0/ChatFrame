import type { ReplyReference } from '@chatframe/shared';
import { useTranslations } from '../../i18n';
import { messageDirection } from './messageDirection';

/**
 * Compact quoted block inside a bubble — WhatsApp-accurate with green accent
 * bar, author name, and truncated preview text.
 */
export function ReplyPreview({ reply }: { reply: ReplyReference }) {
  const t = useTranslations();

  if (!reply.resolved) {
    return (
      <div className="cf-reply cf-reply--unresolved">
        <p className="cf-reply__text">{t.preview.replyUnavailable}</p>
      </div>
    );
  }

  const text =
    reply.previewType === 'image'
      ? `📷 ${reply.previewText !== undefined && reply.previewText.length > 0 ? reply.previewText : t.preview.photo}`
      : (reply.previewText ?? '');

  // Show "You" as the reply author (simplified — the full sender resolution
  // would require looking up the original message's sender)
  const author = t.preview.you;

  return (
    <div className="cf-reply">
      <span className="cf-reply__author">{author}</span>
      <p className="cf-reply__text" dir={messageDirection(reply.previewText)}>
        {text}
      </p>
    </div>
  );
}
