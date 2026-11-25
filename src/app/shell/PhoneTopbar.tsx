import { Link, useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { Marke } from '@/components/ui/Marke'
import { useAuth } from '@/features/auth/authStore'
import { ALLGEMEIN } from '@/texte/de'

/** Phone-Topbar 56 px: Marke links, rechts der Avatar mit dem Menü „Abmelden“ (DESIGN-SYSTEM § 4.2). Sonst nichts. */
export function PhoneTopbar() {
  const navigate = useNavigate()
  const member = useAuth((s) => s.member)
  const abmelden = useAuth((s) => s.abmelden)
  return (
    <header className="border-line bg-canvas sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4">
      <Link to={PFADE.leads} className="flex items-center">
        <Marke zusatz="CRM" />
      </Link>
      <DropdownMenu
        titel={member?.display_name ?? undefined}
        trigger={
          <button type="button" aria-label="Menü" className="grid h-10 w-10 place-items-center rounded-full">
            <Avatar member={member ? { display_name: member.display_name, email: member.email } : null} groesse={28} />
          </button>
        }
        eintraege={[
          {
            label: ALLGEMEIN.abmelden,
            onSelect: () => void abmelden(false).then(() => navigate(PFADE.anmelden, { replace: true })),
          },
        ]}
      />
    </header>
  )
}
