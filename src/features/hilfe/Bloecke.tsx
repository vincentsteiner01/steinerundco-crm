// Handbuch-Blöcke (themen.ts) als Lesetext: Body 15/1,55 auf 64 ch, Zwischentitel H3, Listen mit Gedankenstrich, Schritte mit
// Mono-Ziffer, „geplant“-Hinweis mit Chip. Tastenzeilen und Tastenregister sind mit den Tastenkürzeln entfallen
// (Neustart 25.11.2026).
import { Chip } from '@/components/ui/Chip'
import { Inline } from './Inline'
import type { Block } from './themen'

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
        }
      })}
    </div>
  )
}
