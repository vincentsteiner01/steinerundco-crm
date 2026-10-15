// Status-Chips der E-Mail-Zeilen (ux § 3.6.1: gesendet bestätigt · beantwortet · Bounce · Widerspruch).
import type { ChipTon } from '@/components/ui/Chip'
import type { EmailStatus } from '@/types/domain'

export const STATUS_LABEL: Record<EmailStatus, { label: string; ton: ChipTon }> = {
  draft: { label: 'Entwurf', ton: 'muted' },
  opened_in_client: { label: 'In Gmail geöffnet', ton: 'today' },
  sent_confirmed: { label: 'Gesendet bestätigt', ton: 'done' },
  sent: { label: 'Gesendet', ton: 'done' },
  delivered: { label: 'Zugestellt', ton: 'done' },
  bounced: { label: 'Bounce', ton: 'danger' },
  replied: { label: 'Beantwortet', ton: 'neutral' },
  failed: { label: 'Verworfen', ton: 'ended' },
  received: { label: 'Eingang', ton: 'neutral' },
}
