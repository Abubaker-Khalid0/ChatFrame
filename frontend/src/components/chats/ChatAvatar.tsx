import { avatarDescriptor } from '../../lib/avatarColor';
import { useTranslations } from '../../i18n';

/**
 * Generated avatar: the contact's initial on a deterministically hashed
 * palette color (FR-009, SC-005). Real profile pictures are never fetched or
 * shown (Constitution XII).
 */
export function ChatAvatar({
  displayName,
  phoneNumber,
}: {
  displayName: string | null;
  phoneNumber: string | null;
}) {
  const t = useTranslations();
  const { initial, color } = avatarDescriptor(displayName, phoneNumber);
  const name = displayName ?? phoneNumber ?? t.chatPicker.unknownContact;

  return (
    <span
      role="img"
      aria-label={t.chatPicker.avatarLabel.replace('{name}', name)}
      className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full text-base font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {initial}
    </span>
  );
}
