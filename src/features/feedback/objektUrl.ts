// Object-URL für die Screenshot-Vorschau im Feedback-Dialog.
// Runde 1: useMemo(createObjectURL) + Cleanup-Effekt widerrief die URL im StrictMode-Doppellauf → kaputtes Bild.
// Runde 2: URL im Effekt erzeugt und per setState gesetzt → Lint „set-state-in-effect“ (und ein Render ohne Bild).
// Runde 3: Die URL entsteht beim Rendern aus einem Cache je Blob (idempotent, kein State) und lebt, bis der Blob ersetzt bzw.
// entfernt ist oder der Dialog wirklich geschlossen wurde. Freigegeben wird erst nach dem Abbau – StrictMode baut Effekte einmal
// ab und sofort wieder auf, das darf die angezeigte URL nicht treffen.
import { useEffect, useState } from 'react'

export class ObjektUrls {
  private readonly urls = new Map<Blob, string>()
  private angemeldet = 0

  /** URL zum Blob – beim ersten Aufruf erzeugt, danach dieselbe. */
  url(blob: Blob): string {
    let u = this.urls.get(blob)
    if (!u) {
      u = URL.createObjectURL(blob)
      this.urls.set(blob, u)
    }
    return u
  }

  /** Alle URLs freigeben außer der von `behalten`. */
  freigeben(behalten: Blob | null = null): void {
    for (const [blob, u] of this.urls) {
      if (blob === behalten) continue
      URL.revokeObjectURL(u)
      this.urls.delete(blob)
    }
  }

  /** Für einen Effekt: anmelden; der Abbau gibt alles frei, sofern danach niemand wieder angemeldet ist. */
  anmelden(): () => void {
    this.angemeldet += 1
    return () => {
      this.angemeldet -= 1
      setTimeout(() => {
        if (this.angemeldet === 0) this.freigeben()
      }, 0)
    }
  }

  get anzahl(): number {
    return this.urls.size
  }
}

/** Object-URL für `blob`, gültig solange die Komponente steht und der Blob derselbe ist. */
export function useObjektUrl(blob: Blob | null): string | null {
  const [urls] = useState(() => new ObjektUrls())
  useEffect(() => urls.anmelden(), [urls])
  // Ersetzt oder entfernt: die alte URL wird nicht mehr angezeigt
  useEffect(() => urls.freigeben(blob), [urls, blob])
  return blob ? urls.url(blob) : null
}
