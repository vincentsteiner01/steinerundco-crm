// Handbuch-Blöcke (themen.ts) als Lesetext: Body 15/1,55 auf 64 ch, Zwischentitel H3, Listen mit Gedankenstrich, Schritte mit
// Mono-Ziffer, Tastenzeilen als Haarlinien-Liste, „geplant“-Hinweis mit Chip, Tastenregister aus src/app/tasten.ts.
import { Chip } from '@/components/ui/Chip'
import { Inline, TastenFolge } from './Inline'
import { tastenRegister } from './register'
import type { Block } from './themen'

function TastenZeilen({ zeilen }: { zeilen: readonly { tasten: readonly string[]; text: string }[] }) {
  return (
    <dl className="border-line max-w-[64ch] border-t">
      {zeilen.map((z) => (
        <div
          key={`${z.tasten.join('+')}:${z.text}`}
          className="border-line grid grid-cols-[minmax(52px,auto)_1fr] items-baseline gap-3 border-b py-2 md:grid-cols-[minmax(88px,auto)_1fr] md:gap-4"
        >
          <dt>
            <TastenFolge tasten={z.tasten} />
          </dt>
          <dd className="text-ui text-ink-2 min-w-0 font-normal">{z.text}</dd>
        </div>
      ))}
    </dl>
  )
}

function TastenRegister() {
  const gruppen = tastenRegister()
  return (
    <div className="grid max-w-[880px] gap-x-10 gap-y-6 lg:grid-cols-2" data-tastenregister>
      {gruppen.map((g) => (
        <section key={g.gruppe} aria-label={g.gruppe} className="min-w-0">
          <h3 className="label mb-1.5">{g.gruppe}</h3>
          <ul className="border-line border-t">
            {g.eintraege.map((e) => (
              <li
                key={`${g.gruppe}:${e.beschreibung}`}
                className="border-line flex min-h-8 items-baseline justify-between gap-3 border-b py-1.5"
              >
                <span className="text-ui text-ink-2 min-w-0 font-normal">{e.beschreibung}</span>
                <TastenFolge tasten={e.tasten} className="max-w-[60%] flex-none justify-end" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function Bloecke({ bloecke }: { bloecke: readonly Block[] }) {
  return (
    <div className="grid gap-4">
      {bloecke.map((b, i) => {
        const key = `${b.art}:${i}`
        switch (b.art) {
          case 'absatz':
            return (
              <p key={key} className="text-body text-ink-2 max-w-[64ch]">
                <Inline text={b.text} />
              </p>
            )
          case 'zwischentitel':
            return (
              <h3 key={key} className="text-h3 text-ink-bright mt-5 first:mt-0">
                {b.text}
              </h3>
            )
          case 'liste':
            return (
              <ul key={key} className="grid max-w-[64ch] gap-2">
                {b.punkte.map((p) => (
                  <li key={p} className="text-body text-ink-2 grid grid-cols-[16px_minmax(0,1fr)]">
                    <span aria-hidden className="text-ink-3">
                      –
                    </span>
                    <span>
                      <Inline text={p} />
                    </span>
                  </li>
                ))}
              </ul>
            )
          case 'schritte':
            return (
              <ol key={key} className="grid max-w-[64ch] gap-2.5">
                {b.punkte.map((p, n) => (
                  <li key={p} className="text-body text-ink-2 grid grid-cols-[24px_minmax(0,1fr)]">
                    <span aria-hidden className="text-ink-3 tnum pt-px font-mono text-[13px]">
                      {n + 1}
                    </span>
                    <span>
                      <Inline text={p} />
                    </span>
                  </li>
                ))}
              </ol>
            )
          case 'tasten':
            return <TastenZeilen key={key} zeilen={b.zeilen} />
          case 'hinweis':
            return (
              <p
                key={key}
                className="border-line-strong text-body text-ink-2 max-w-[64ch] rounded-md border px-3.5 py-2.5"
                data-geplant={b.geplant || undefined}
              >
                {b.geplant ? (
                  <Chip ton="later" className="mr-2 align-[1px]">
                    geplant
                  </Chip>
                ) : null}
                <Inline text={b.text} />
              </p>
            )
          case 'tastenregister':
            return <TastenRegister key={key} />
        }
      })}
    </div>
  )
}
