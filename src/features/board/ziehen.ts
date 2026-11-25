// Karten ziehen (25.11.2026, Zusatz zu den Knöpfen): @dnd-kit/core mit zwei Sensoren.
// Maus/Stift: ab 8 px Bewegung – darunter bleibt es ein Klick, der das Lead-Blatt öffnet.
// Finger: erst nach 200 ms Halten – sonst würde jedes Wischen durch eine Liste eine Karte mitnehmen. Der Zeiger-Sensor
// überlässt Berührungen deshalb dem Finger-Sensor (beide zusammen starteten das Ziehen schon beim Scrollen).
// Link und Knöpfe auf der Karte tragen `data-kein-ziehen` und starten nie ein Ziehen.
import {
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { istBoardListe, type BoardListe } from './listen'

export const KEIN_ZIEHEN = 'data-kein-ziehen'

export function darfZiehen(ziel: EventTarget | null): boolean {
  return !(ziel instanceof Element && ziel.closest(`[${KEIN_ZIEHEN}]`))
}

const zeigerStart = PointerSensor.activators[0]?.handler
const fingerStart = TouchSensor.activators[0]?.handler

class ZeigerSensor extends PointerSensor {
  static activators: typeof PointerSensor.activators = [
    {
      eventName: 'onPointerDown',
      handler: (e, optionen) =>
        e.nativeEvent.pointerType !== 'touch' && darfZiehen(e.nativeEvent.target) && !!zeigerStart?.(e, optionen),
    },
  ]
}

class FingerSensor extends TouchSensor {
  static activators: typeof TouchSensor.activators = [
    {
      eventName: 'onTouchStart',
      handler: (e, optionen) => darfZiehen(e.nativeEvent.target) && !!fingerStart?.(e, optionen),
    },
  ]
}

export function useZiehSensoren() {
  return useSensors(
    useSensor(ZeigerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(FingerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
}

/** Ziel = die Liste unter dem Zeiger; liegt er daneben, die Liste, die die gezogene Karte am stärksten überdeckt. */
export const kollision: CollisionDetection = (args) => {
  const unterZeiger = pointerWithin(args)
  return unterZeiger.length > 0 ? unterZeiger : rectIntersection(args)
}

/** Liste, über der losgelassen wurde – `null`, wenn daneben. */
export function zielListe(e: Pick<DragEndEvent, 'over'>): BoardListe | null {
  const id = e.over?.id
  return istBoardListe(id) ? id : null
}
