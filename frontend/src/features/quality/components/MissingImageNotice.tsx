import { useTranslations } from '../../../i18n';

/** Notice shown when some images are unavailable (US8 AC3, FR-019). */
export function MissingImageNotice({ count }: { count: number }) {
  const t = useTranslations();
  if (count <= 0) {
    return null;
  }

  return (
    <p className="rounded-md bg-info-soft px-3 py-2 text-sm text-ink-secondary">
      {count} {t.quality.missingImagesNotice}
    </p>
  );
}
