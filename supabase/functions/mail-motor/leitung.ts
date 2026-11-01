// Zeilenweise lesen und schreiben über eine TCP/TLS-Verbindung (für smtp.ts und imap.ts). Bytegenau, damit IMAP-Literale
// ({123}) exakt gelesen werden können. Jede Leseoperation hat ein Zeitlimit – hängt der Server, wird die Verbindung
// geschlossen und ein Fehler geworfen (die Edge Function darf nie bis zum 150-s-Limit festhängen).

export class LeitungsFehler extends Error {
  constructor(
    message: string,
    readonly art: 'zeit' | 'geschlossen' | 'netz',
  ) {
    super(message)
  }
}

const dec = new TextDecoder()
const enc = new TextEncoder()

export class Leitung {
  private puffer = new Uint8Array(0)
  private zu = false

  constructor(
    public conn: Deno.Conn,
    private zeitMs = 20_000,
  ) {}

  /** Verbindung austauschen (nach STARTTLS) – der Puffer muss dann leer sein. */
  tauschen(conn: Deno.Conn) {
    this.conn = conn
    this.puffer = new Uint8Array(0)
  }

  private async nachladen(zeitMs: number): Promise<void> {
    const stueck = new Uint8Array(16_384)
    let timer: ReturnType<typeof setTimeout> | undefined
    const ablauf = new Promise<never>((_, nein) => {
      timer = setTimeout(() => {
        this.schliessen()
        nein(new LeitungsFehler('Zeitüberschreitung beim Lesen', 'zeit'))
      }, zeitMs)
    })
    try {
      const n = await Promise.race([this.conn.read(stueck), ablauf])
      if (n === null) throw new LeitungsFehler('Verbindung vom Server geschlossen', 'geschlossen')
      const neu = new Uint8Array(this.puffer.length + n)
      neu.set(this.puffer)
      neu.set(stueck.subarray(0, n), this.puffer.length)
      this.puffer = neu
    } catch (e) {
      if (e instanceof LeitungsFehler) throw e
      throw new LeitungsFehler(`Netzwerkfehler: ${String((e as Error)?.message ?? e)}`, 'netz')
    } finally {
      clearTimeout(timer)
    }
  }

  /** Eine Zeile ohne CRLF (als Text). */
  async zeile(zeitMs = this.zeitMs): Promise<string> {
    for (;;) {
      const i = this.puffer.indexOf(0x0a)
      if (i >= 0) {
        const roh = this.puffer.subarray(0, i)
        this.puffer = this.puffer.slice(i + 1)
        const t = dec.decode(roh)
        return t.endsWith('\r') ? t.slice(0, -1) : t
      }
      if (this.puffer.length > 2_000_000) throw new LeitungsFehler('Zeile zu lang', 'netz')
      await this.nachladen(zeitMs)
    }
  }

  /** Genau n Bytes (IMAP-Literal). */
  async bytes(n: number, zeitMs = this.zeitMs): Promise<Uint8Array> {
    while (this.puffer.length < n) await this.nachladen(zeitMs)
    const raus = this.puffer.slice(0, n)
    this.puffer = this.puffer.slice(n)
    return raus
  }

  async schreiben(text: string): Promise<void> {
    const daten = enc.encode(text)
    let geschrieben = 0
    try {
      while (geschrieben < daten.length) geschrieben += await this.conn.write(daten.subarray(geschrieben))
    } catch (e) {
      throw new LeitungsFehler(`Netzwerkfehler beim Schreiben: ${String((e as Error)?.message ?? e)}`, 'netz')
    }
  }

  schliessen() {
    if (this.zu) return
    this.zu = true
    try {
      this.conn.close()
    } catch {
      /* schon zu */
    }
  }
}

/** Verbindung mit Zeitlimit aufbauen (TLS oder einfach). */
export async function verbinden(host: string, port: number, tls: boolean, zeitMs = 15_000): Promise<Deno.Conn> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      tls ? Deno.connectTls({ hostname: host, port }) : Deno.connect({ hostname: host, port }),
      new Promise<never>((_, nein) => {
        timer = setTimeout(() => nein(new LeitungsFehler(`Keine Verbindung zu ${host}:${port}`, 'zeit')), zeitMs)
      }),
    ])
  } catch (e) {
    if (e instanceof LeitungsFehler) throw e
    throw new LeitungsFehler(`Keine Verbindung zu ${host}:${port}: ${String((e as Error)?.message ?? e)}`, 'netz')
  } finally {
    clearTimeout(timer)
  }
}
