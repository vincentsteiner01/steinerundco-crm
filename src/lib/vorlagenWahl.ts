// Inaktive Vorlagen nicht mehr verwenden (23.10.2026, Vincent hat Gesprächseröffnung V1, V2 und ZG deaktiviert und will mit V3
// weitermachen). Ein Sequenzschritt oder eine Rollen-Regel kann noch auf eine inaktive Vorlage zeigen – dann nimmt das CRM die
// aktive Variante derselben Familie (gleicher Kanal, gleiche Phase, gleicher Name vor der Klammer: „Gesprächseröffnung (V3)“).
// Gibt es keine aktive Variante, bleibt die ursprüngliche (lieber ein Text als „Keine Vorlage“). Geteilt mit der Erweiterung.

export type VorlageWahl = {
  id: string
  name: string
  channel: string
  phase: string
  active: boolean | null
  sort_order: number | null
}

/** „Gesprächseröffnung (V1)“ → „gesprächseröffnung“ (Name vor der ersten Klammer). */
export function vorlagenFamilie(name: string): string {
  return name.split('(')[0]!.trim().toLowerCase()
}

export const istAktiv = (t: Pick<VorlageWahl, 'active'> | null | undefined): boolean => !!t && t.active !== false

/** Aktive Vorlage für `t`: `t` selbst, wenn aktiv – sonst die erste aktive Variante seiner Familie (nach Reihenfolge). */
export function aktiveVariante<T extends VorlageWahl>(
  t: T | null | undefined,
  alle: readonly T[] | null | undefined,
): T | null {
  if (!t) return null
  if (istAktiv(t)) return t
  const familie = vorlagenFamilie(t.name)
  const ersatz = (alle ?? [])
    .filter((x) => istAktiv(x) && x.channel === t.channel && x.phase === t.phase && vorlagenFamilie(x.name) === familie)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'de'))
  return ersatz[0] ?? t
}
