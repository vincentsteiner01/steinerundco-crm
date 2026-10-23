// Formatierter Leitfaden-Text (23.10.2026, wie in Mikes Sales Hub): Absätze, Überschriften, Listen, fett/kursiv/unterstrichen/
// markiert und Kundenantworten blau-kursiv (lib/leitfadenFormat). Platzhalter `[Name]` rendert der Aufrufer (gefüllt/offen);
// `[…]` steht für die Antwort des Gegenübers und ist immer blau. Gleich im Lesefenster, in der Vorschau und im Anruf-Skript.
import { Fragment, type ReactNode } from 'react'
import { istKundenPause } from '@/lib/kundenantwort'
import { bloecke, inline, type Inline } from '@/lib/leitfadenFormat'
import { cn } from './ui/cn'

const TOKEN = /(\[[^[\]\n]{1,40}\])/

export type PlatzhalterRender = (name: string, roh: string, key: string) => ReactNode

function Tokens({ text, platzhalter, k }: { text: string; platzhalter?: PlatzhalterRender; k: string }) {
  return (
    <>
      {text.split(TOKEN).map((teil, i): ReactNode => {
        if (!TOKEN.test(teil)) return teil
        const name = teil.slice(1, -1).trim()
        if (istKundenPause(name))
          return (
            <span key={i} className="text-signal" title="Antwort des Gegenübers">
              {teil}
            </span>
          )
        return platzhalter ? <Fragment key={i}>{platzhalter(name, teil, `${k}-${i}`)}</Fragment> : teil
      })}
    </>
  )
}

function Zeile({ text, platzhalter, k }: { text: string; platzhalter?: PlatzhalterRender; k: string }) {
  return (
    <>
      {inline(text).map((s: Inline, i) => {
        const inhalt = <Tokens text={s.text} platzhalter={platzhalter} k={`${k}-${i}`} />
        switch (s.art) {
          case 'fett':
            return (
              <strong key={i} className="text-ink-bright font-semibold">
                {inhalt}
              </strong>
            )
          case 'kursiv':
            return <em key={i}>{inhalt}</em>
          case 'unter':
            return (
              <span key={i} className="underline underline-offset-2">
                {inhalt}
              </span>
            )
          case 'mark':
            return (
              <mark key={i} className="bg-tag-gelb rounded-xs px-0.5 text-inherit">
                {inhalt}
              </mark>
            )
          default:
            return <Fragment key={i}>{inhalt}</Fragment>
        }
      })}
    </>
  )
}

function Zeilen({ zeilen, platzhalter, k }: { zeilen: string[]; platzhalter?: PlatzhalterRender; k: string }) {
  return (
    <>
      {zeilen.map((z, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          <Zeile text={z} platzhalter={platzhalter} k={`${k}-${i}`} />
        </Fragment>
      ))}
    </>
  )
}

export function FormatText({
  text,
  platzhalter,
  className,
}: {
  text: string
  platzhalter?: PlatzhalterRender
  className?: string
}) {
  return (
    <div className={cn('[&>*:last-child]:mb-0', className)}>
      {bloecke(text).map((b, i) => {
        const k = `b${i}`
        switch (b.art) {
          case 'ueberschrift':
            return (
              <h4 key={k} className="text-ink-bright mt-1 mb-[0.6em] text-[1.05em] font-semibold">
                <Zeile text={b.text} platzhalter={platzhalter} k={k} />
              </h4>
            )
          case 'kunde':
            return (
              <p key={k} className="text-signal mb-[0.9em] italic" data-kunde="">
                <Zeilen zeilen={b.zeilen} platzhalter={platzhalter} k={k} />
              </p>
            )
          case 'liste':
          case 'nummern': {
            const Tag = b.art === 'liste' ? 'ul' : 'ol'
            return (
              <Tag
                key={k}
                className={cn('mb-[0.9em] grid gap-0.5 pl-5', b.art === 'liste' ? 'list-disc' : 'list-decimal')}
              >
                {b.punkte.map((p, j) => (
                  <li key={j}>
                    <Zeile text={p} platzhalter={platzhalter} k={`${k}-${j}`} />
                  </li>
                ))}
              </Tag>
            )
          }
          default:
            return (
              <p key={k} className="mb-[0.9em]">
                <Zeilen zeilen={b.zeilen} platzhalter={platzhalter} k={k} />
              </p>
            )
        }
      })}
    </div>
  )
}
