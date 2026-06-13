import { useState } from 'react';
import type { ImageMetadata } from '@chatframe/shared';
import { useTranslations } from '../../i18n';
import { mediaUrl } from '../../api/preview.api';
import { messageDirection } from './messageDirection';

/** Extracts the stored filename from the asset's local path. */
function filenameOf(localPath: string): string {
  const segments = localPath.split(/[\\/]/);
  return segments[segments.length - 1] ?? localPath;
}

/**
 * An image message body (008 FR-012, FR-015): the stored image streamed from
 * `GET /api/media/:projectId/:filename` at its natural aspect ratio, with the
 * caption below. Assets recorded as `missing` — or images that fail to load
 * client-side — render a styled placeholder card with the caption preserved
 * (Constitution XXIII — no silent data loss).
 */
export function ImageMessage({ image, projectId }: { image: ImageMetadata; projectId: string }) {
  const t = useTranslations();
  const [loadFailed, setLoadFailed] = useState(false);
  const missing = image.missing === true || loadFailed;

  return (
    <figure className={missing ? 'cf-image cf-image--missing' : 'cf-image'}>
      {missing ? (
        <div className="cf-image__placeholder" role="img" aria-label={t.preview.missingImage}>
          <span className="cf-image__placeholder-icon" aria-hidden="true">
            🖼️
          </span>
          <span>{t.preview.missingImage}</span>
        </div>
      ) : (
        <img
          className="cf-image__img"
          src={mediaUrl(projectId, filenameOf(image.localPath))}
          alt={image.caption ?? t.preview.photo}
          width={image.width}
          height={image.height}
          loading="lazy"
          onError={() => setLoadFailed(true)}
        />
      )}
      {image.caption !== undefined && image.caption.length > 0 && (
        <figcaption className="cf-image__caption" dir={messageDirection(image.caption)}>
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}
