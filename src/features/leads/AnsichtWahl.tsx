// Ansicht-Dropdown + Favoriten-Segment (ux § 3.2.1/§ 3.2.3): 15 System-Ansichten, Stern = Favorit (max. 6, localStorage);
// Spaltenwähler (Popover mit Checkboxen, persistiert je Ansicht über ansichtSpeicher.ts, LE-01).
import { ChevronDown, Columns3, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/components/ui/cn'
import { Popover, PopoverEintrag } from '@/components/ui/Popover'
import { Segment } from '@/components/ui/Segment'
import { FAVORITEN_MAX, SYSTEM_ANSICHTEN, type AnsichtDef } from './ansichten'
import { SPALTEN_KEYS, SPALTEN_LABEL, type SpaltenKey } from './spaltenKeys'

export function AnsichtWahl({
  ansicht,
  favoriten,
  onAnsicht,
  onFavoriten,
}: {
  ansicht: AnsichtDef
  favoriten: readonly string[]
  onAnsicht: (key: string) => void
  onFavoriten: (liste: string[]) => void
}) {
  const toggleFav = (key: string) => {
    if (favoriten.includes(key)) onFavoriten(favoriten.filter((k) => k !== key))
    else if (favoriten.length < FAVORITEN_MAX) onFavoriten([...favoriten, key])
  }
  const favAnsichten = favoriten
    .map((k) => SYSTEM_ANSICHTEN.find((a) => a.key === k))
    .filter((a): a is AnsichtDef => !!a)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Popover
        titel="Ansicht"
        trigger={
          <Button variante="secondary" groesse="S" aria-label={`Ansicht: ${ansicht.name}`}>
            {ansicht.name}
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
          </Button>
        }
        className="w-[300px] max-w-[300px]"
      >
        <div role="menu" aria-label="Ansichten" className="max-h-[60vh] overflow-auto">
          {SYSTEM_ANSICHTEN.map((a) => (
            <div key={a.key} className="flex items-center gap-1">
              <PopoverEintrag
                role="menuitem"
                aktiv={a.key === ansicht.key}
                onClick={() => onAnsicht(a.key)}
                title={a.definition}
              >
                <span className="flex-1">{a.name}</span>
              </PopoverEintrag>
              <button
                type="button"
                aria-label={favoriten.includes(a.key) ? `${a.name} aus Favoriten entfernen` : `${a.name} als Favorit`}
                aria-pressed={favoriten.includes(a.key)}
                onClick={() => toggleFav(a.key)}
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-sm',
                  favoriten.includes(a.key) ? 'text-ink' : 'text-ink-3 hover:text-ink',
                )}
              >
                <Star
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden
                  fill={favoriten.includes(a.key) ? 'currentColor' : 'none'}
                />
              </button>
            </div>
          ))}
        </div>
      </Popover>
      {favAnsichten.length ? (
        <Segment
          klein
          ariaLabel="Favoriten"
          wert={favAnsichten.some((a) => a.key === ansicht.key) ? ansicht.key : '__'}
          onChange={(k) => onAnsicht(k)}
          optionen={favAnsichten.map((a) => ({ key: a.key, label: a.name }))}
        />
      ) : null}
    </div>
  )
}

export function SpaltenWahl({
  keys,
  onChange,
  offen,
  onOpenChange,
}: {
  keys: readonly SpaltenKey[]
  onChange: (keys: SpaltenKey[]) => void
  /** Kontrolliert öffnen (Palette-Befehl „Spalten wählen“) */
  offen?: boolean
  onOpenChange?: (offen: boolean) => void
}) {
  const toggle = (k: SpaltenKey) => {
    if (keys.includes(k)) onChange(keys.filter((x) => x !== k))
    else {
      // Reihenfolge wie SPALTEN_KEYS
      onChange(SPALTEN_KEYS.filter((x) => x === k || keys.includes(x)))
    }
  }
  return (
    <Popover
      titel="Spalten"
      offen={offen}
      onOpenChange={onOpenChange}
      trigger={<Button variante="icon" icon={Columns3} aria-label="Spalten wählen" title="Spalten wählen" />}
      align="end"
      className="w-[240px]"
    >
      <div className="grid gap-1 p-1" role="group" aria-label="Spalten">
        {SPALTEN_KEYS.map((k) => (
          <Checkbox
            key={k}
            label={SPALTEN_LABEL[k]}
            checked={keys.includes(k)}
            disabled={k === 'name'}
            onChange={() => toggle(k)}
          />
        ))}
      </div>
    </Popover>
  )
}
