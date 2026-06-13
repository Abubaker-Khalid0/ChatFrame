import type { ReplyReference } from '@chatframe/shared';
import { useTranslations } from '../../i18n';
import { messageDirection } from './messageDirection';

/**
 * Compact quoted block inside a bubble (008 FR-011). A resolved reply shows
 * the original message's preview text (image replies get a 📷 marker and the
 * caption or a localized "Photo" label); an unresolved reply shows a
 * placeholder instead of being silently dropped (Constitution XXIII).
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

  return (
    <div className="cf-reply">
      <p className="cf-reply__text" dir={messageDirection(reply.previewText)}>
        {text}
      </p>
    </div>
  );
}
