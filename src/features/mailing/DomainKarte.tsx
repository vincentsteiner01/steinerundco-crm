// Versand-Domain mit DNS-Ampel (SPF, DKIM, DMARC, MX), Registrierungsdatum (Versand erst ab Tag 30), Website-Haken (T-Online
// verlangt eine erreichbare Website mit Impressum), Einträgen zum Kopieren und Links zu Blocklisten-Prüfungen.
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { type MailDomain, useDomainLoeschen, useDomainSpeichern } from '@/data/mailing'
import { fmtDatumZeit } from '@/lib/format'
import type { Json } from '@/types/database'
import { blocklistenLinks, dnsPruefen, type DnsErgebnis, empfohleneEintraege } from './dns'
import type { Anbieter } from './logik'
import { Ampel, KopierFeld, Warum } from './Teile'
import { useBestaetigung } from './useBestaetigung'

type DnsGespeichert = Partial<DnsErgebnis> & { website_ok?: boolean; selector?: string | null }

function alterTage(registriert: string | null): number | null {
  if (!registriert) return null
  return Math.floor((Date.now() - new Date(`${registriert}T12:00:00`).getTime()) / 86_400_000)
}

export function DomainKarte({ domain }: { domain: MailDomain }) {
  const speichern = useDomainSpeichern()
  const loeschen = useDomainLoeschen()
  const { dialog, fragen } = useBestaetigung()
  const [pruefend, setPruefend] = useState(false)
  const [eintraegeOffen, setEintraegeOffen] = useState(!(domain.dns as DnsGespeichert | null)?.ok)
  const dns = (domain.dns ?? {}) as DnsGespeichert
  const alter = alterTage(domain.registriert_am)
  const anbieter = domain.anbieter as Anbieter

  const sichern = (neu: Partial<DnsGespeichert>, extra: Partial<Pick<MailDomain, 'registriert_am'>> = {}) =>
    speichern.mutateAsync({
      domain: domain.domain,
      anbieter: domain.anbieter,
      zweck: domain.zweck,
      registriert_am: 'registriert_am' in extra ? extra.registriert_am : domain.registriert_am,
      dns: { ...dns, ...neu } as unknown as Json,
      dns_geprueft_at: neu.geprueft_at ?? domain.dns_geprueft_at,
    })

  const pruefen = async () => {
    setPruefend(true)
    try {
      const e = await dnsPruefen(domain.domain, anbieter, dns.selector)
      await sichern(e)
      toast(e.ok ? `${domain.domain}: alle DNS-Einträge da` : `${domain.domain}: es fehlt noch etwas`)
      if (!e.ok) setEintraegeOffen(true)
    } finally {
      setPruefend(false)
    }
  }

  const zeilen: { name: string; teil?: { ok: boolean; hinweis?: string | null; wert?: string | null } }[] = [
    { name: 'MX (Antworten kommen an)', teil: dns.mx },
    { name: 'SPF (wer senden darf)', teil: dns.spf },
    {
      name: `DKIM (Unterschrift${dns.dkim?.bits ? `, ${dns.dkim.bits} Bit` : ''})`,
      teil: dns.dkim,
    },
    { name: `DMARC${dns.dmarc?.policy ? ` (p=${dns.dmarc.policy})` : ''}`, teil: dns.dmarc },
  ]

  return (
    <article className="border-line-strong rounded-md border p-4" data-domain={domain.domain}>
      {dialog}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-ui text-ink-bright truncate">{domain.domain}</h3>
          <Chip ton={dns.ok ? 'done' : 'overdue'}>
            {dns.ok ? 'Startklar' : dns.geprueft_at ? 'Unvollständig' : 'Nicht geprüft'}
          </Chip>
          {domain.zweck === 'haupt' ? <Chip ton="grau">Hauptdomain</Chip> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variante="secondary" groesse="S" icon={RefreshCw} busy={pruefend} onClick={() => void pruefen()}>
            Prüfen
          </Button>
          <Button
            variante="icon"
            aria-label={`${domain.domain} entfernen`}
            icon={Trash2}
            onClick={() =>
              fragen({
                titel: `${domain.domain} entfernen?`,
                text: 'Die Domain verschwindet nur aus dieser Liste – beim Domain-Anbieter bleibt alles, wie es ist.',
                label: 'Entfernen',
                los: () => loeschen.mutate(domain.id),
              })
            }
          />
        </div>
      </header>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {zeilen.map((z) => (
          <li key={z.name} className="min-w-0">
            <Ampel ok={!!z.teil?.ok} warn={!!z.teil?.ok && !!z.teil?.hinweis}>
              {z.name}
              {z.teil?.hinweis ? <span className="text-ink-3"> – {z.teil.hinweis}</span> : null}
              {!z.teil ? <span className="text-ink-3"> – noch nicht geprüft</span> : null}
            </Ampel>
          </li>
        ))}
        <li>
          <Ampel ok={alter !== null && alter >= 30} warn={alter !== null && alter >= 14 && alter < 30}>
            {alter === null ? 'Alter der Domain unbekannt' : `Domain ${alter} Tage alt`}
            {alter !== null && alter < 30 ? <span className="text-ink-3"> – Versand ab Tag 30</span> : null}
          </Ampel>
        </li>
        <li>
          <Ampel ok={dns.website_ok === true} warn={dns.website_ok !== true}>
            Website mit Impressum
          </Ampel>
        </li>
      </ul>
      {dns.geprueft_at ? (
        <p className="text-ink-3 mt-2 text-[12px]">Zuletzt geprüft {fmtDatumZeit(dns.geprueft_at)}</p>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr] sm:items-start">
        <label className="text-small text-ink-2 grid gap-1">
          Registriert am
          <Input
            type="date"
            value={domain.registriert_am ?? ''}
            onChange={(e) => void sichern({}, { registriert_am: e.target.value || null })}
            aria-label="Registriert am"
          />
        </label>
        <div className="grid gap-1.5 pt-0.5">
          <Checkbox
            checked={dns.website_ok === true}
            onChange={(e) => void sichern({ website_ok: e.target.checked })}
            label={
              <span>
                Unter{' '}
                <a href={`https://${domain.domain}`} target="_blank" rel="noreferrer" className="text-signal underline">
                  {domain.domain}
                </a>{' '}
                steht eine kleine Seite mit Impressum und Datenschutz
              </span>
            }
          />
          <Warum>
            T-Online lehnt Mails von Domains ohne erreichbare Website mit Impressum ab, und Empfänger schauen nach, wer
            schreibt. Eine Seite mit Name, Zweck, Impressum und Datenschutz reicht. Eine reine Weiterleitung fällt
            Blocklisten eher auf.
          </Warum>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          className="text-small text-signal hover:underline"
          onClick={() => setEintraegeOffen((o) => !o)}
          aria-expanded={eintraegeOffen}
        >
          {eintraegeOffen ? 'Einträge ausblenden' : 'Einträge zum Kopieren anzeigen'}
        </button>
        {eintraegeOffen ? (
          <div className="mt-2 grid gap-3">
            <p className="text-small text-ink-2">
              Diese Einträge trägst du beim Domain-Anbieter (z. B. IONOS → Domain → DNS) ein. Danach dauert es bis zu
              einer Stunde, bis „Prüfen“ grün zeigt.
            </p>
            {empfohleneEintraege(domain.domain, anbieter).map((e) => (
              <div key={`${e.typ}-${e.name}-${e.wert}`} className="bg-sidebar grid gap-2 rounded-sm p-3">
                <div className="text-small text-ink-bright">
                  {e.typ}-Eintrag
                  <span className="text-ink-3"> · {e.warum}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <KopierFeld label="Name / Host" wert={e.name} />
                  <KopierFeld label="Wert" wert={e.wert} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="text-small text-ink-3 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        Blocklisten prüfen:
        {blocklistenLinks(domain.domain).map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="text-signal inline-flex items-center gap-1 hover:underline"
          >
            {l.label}
            <ExternalLink size={12} aria-hidden />
          </a>
        ))}
      </div>
    </article>
  )
}
