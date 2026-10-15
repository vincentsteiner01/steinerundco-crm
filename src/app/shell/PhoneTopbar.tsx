import { Search } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { useAuth } from '@/features/auth/authStore'
import { ALLGEMEIN } from '@/texte/de'

/** Phone-Topbar 56 px: Marke links, rechts Lupe (Palette, ux § 7.1) und Avatar → Menü (DESIGN-SYSTEM § 4.2). */
export function PhoneTopbar() {
  const navigate = useNavigate()
  const member = useAuth((s) => s.member)
  const abmelden = useAuth((s) => s.abmelden)
  const setPaletteOffen = useUiStore((s) => s.setPaletteOffen)
  return (
    <header className="border-line bg-canvas sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4">
      <NavLink to={PFADE.heute} className="flex items-baseline gap-2">
        <span className="text-ink-bright font-serif text-[22px] leading-none italic">Steiner &amp; Co.</span>
        <span className="label">CRM</span>
      </NavLink>
      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-label={ALLGEMEIN.suchenOderBefehl}
          title={ALLGEMEIN.suchenOderBefehl}
          onClick={() => setPaletteOffen(true)}
          className="text-ink-2 hover:bg-surface-hover hover:text-ink grid h-10 w-10 place-items-center rounded-sm"
        >
          <Search size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <DropdownMenu
          trigger={
            <button type="button" aria-label="Menü">
              <Avatar
                member={member ? { display_name: member.display_name, email: member.email } : null}
                groesse={28}
              />
            </button>
          }
          eintraege={[
            { label: ALLGEMEIN.suchenOderBefehl, onSelect: () => setPaletteOffen(true) },
            { label: 'Einstellungen', onSelect: () => navigate(PFADE.einstellungen()) },
            'trenner',
            {
              label: ALLGEMEIN.abmelden,
              onSelect: () => void abmelden(false).then(() => navigate(PFADE.anmelden, { replace: true })),
            },
          ]}
        />
      </span>
    </header>
  )
}
