// Reine Filter des Tabs Fällig (BAUPLAN § 3.5, § 5.4): E-Mail-Schritte aus der Queue, manuelle E-Mail-Aufgaben.
import type { QueueItem, Task, Template } from '@/types/domain'

/** Fällige E-Mail-Schritte: Sequenzschritte mit Kanal E-Mail in den Sektionen überfällig/heute (§ 5.4). */
export function faelligeEmailSchritte(items: readonly QueueItem[]): QueueItem[] {
  return items.filter(
    (i) =>
      i.channel === 'email' &&
      i.item_kind === 'sequenz_schritt' &&
      (i.section === 'ueberfaellig' || i.section === 'heute'),
  )
}

/** Manuelle E-Mail-Aufgaben: `aufgabe` mit Vorlage Kanal E-Mail oder Titel „Kurzinfo…“. */
export function manuelleEmailAufgaben(
  tasks: readonly Task[],
  templates: readonly Pick<Template, 'id' | 'channel'>[],
): Task[] {
  const emailVorlagen = new Set(templates.filter((t) => t.channel === 'email').map((t) => t.id))
  return tasks.filter(
    (t) =>
      t.kind === 'aufgabe' &&
      t.status === 'offen' &&
      ((t.template_id && emailVorlagen.has(t.template_id)) || /^kurzinfo/i.test(t.title ?? '')),
  )
}
