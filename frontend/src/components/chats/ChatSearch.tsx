import { useLanguageStore } from '../../stores/useLanguageStore';
import { useTranslations } from '../../i18n';
import { directionForLanguage } from '../../i18n/direction';

/**
 * Controlled search input for the chat picker (FR-010). The field follows the
 * active layout direction so Arabic input is RTL-aligned (FR-011, SC-007).
 */
export function ChatSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  const language = useLanguageStore((s) => s.language);

  return (
    <input
      type="search"
      dir={directionForLanguage(language)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={t.chatPicker.searchPlaceholder}
      aria-label={t.chatPicker.searchLabel}
      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
    />
  );
}
