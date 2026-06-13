import type { MessageRow } from '@chatframe/shared';
import { useTranslations } from '../../i18n';

/**
 * Distinct card for messages of unrecognized types (008 FR-016): shows the
 * original type and the reason it cannot be rendered, visually differentiated
 * from regular bubbles so nothing is silently dropped (Constitution XXIII).
 */
export function UnsupportedMessage({ message }: { message: MessageRow }) {
  const t = useTranslations();
  const info = message.unsupported;
  const isOutgoing = message.direction === 'sent';

  return (
    <div className={`cf-row ${isOutgoing ? 'cf-row--out' : 'cf-row--in'} cf-row--lead`}>
      <div className="cf-unsupported">
        <span className="cf-unsupported__type">
          {t.preview.unsupported}
          {info !== undefined ? ` · ${info.originalType}` : ''}
        </span>
        <p className="cf-unsupported__reason">{info?.reason ?? t.preview.unsupportedReason}</p>
      </div>
    </div>
  );
}
