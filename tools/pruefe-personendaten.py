"""Prüft, dass keine echten Personendaten aus den Alt-Sheets im (öffentlichen) Repository landen.

Quelle der echten Daten: supabase/seed-privat/crm_leads.json (gitignored, nur lokal vorhanden).
Geprüft werden alle Dateien, die git verfolgt oder verfolgen würde (git ls-files + nicht ignorierte neue Dateien).
Treffer: vollständige Namen, seltene Nachnamen, Firmennamen, LinkedIn-Slugs, Telefonnummern, E-Mail-Adressen, Notiz-Anfänge.

Aufruf:  python3 -I tools/pruefe-personendaten.py          (Exit 1 bei Treffern)
Läuft lokal als pre-push-Hook (tools/hooks/pre-push). Ohne seed-privat/crm_leads.json: Hinweis, Exit 0.
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
QUELLE = ROOT / "supabase" / "seed-privat" / "crm_leads.json"
TEXT_ENDUNGEN = {".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".sql", ".sh", ".yml", ".yaml", ".html", ".css", ".txt", ".py", ".toml", ""}
# Nachnamen, die zugleich gewöhnliche Wörter oder sehr häufige Namen sind, erzeugen nur Rauschen.
ALLTAG = {
    "albert", "werner", "martin", "simon", "thomas", "otto", "frank", "peter", "peters", "lange", "klein", "braun",
    "schmidt", "müller", "fischer", "wagner", "becker", "schulz", "hoffmann", "schneider", "richter", "wolf",
    "neumann", "schwarz", "zimmermann", "krüger", "hartmann", "schmitz", "meyer", "weber", "koch", "hofmann",
    "lehmann", "schröder", "kaiser", "fuchs", "scholz", "möller", "keller", "günther", "berger", "winkler", "roth",
    "beck", "lorenz", "baumann", "franke", "albrecht", "schuster", "ludwig", "winter", "kraus", "schumacher",
    "krämer", "vogt", "stein", "jäger", "sommer", "seidel", "heinrich", "brandt", "haas", "schreiber", "graf",
    "schulte", "dietrich", "ziegler", "kuhn", "pohl", "engel", "horn", "busch", "bergmann", "voigt", "sauer",
    "arnold", "wolff", "pfeiffer", "steiner", "dienst", "steuer", "jung", "adler", "hinz", "hunt", "meine", "seine", "keine", "reine",
}


def zeilen_finden(o):
    if isinstance(o, list) and o and isinstance(o[0], dict) and "vor_und_nachname" in o[0]:
        return o
    if isinstance(o, dict):
        for v in o.values():
            r = zeilen_finden(v)
            if r:
                return r
    if isinstance(o, list):
        for v in o:
            r = zeilen_finden(v)
            if r:
                return r
    return None


def muster_bauen(zeilen):
    exakt = {}  # text -> art
    for z in zeilen:
        name = (z.get("vor_und_nachname") or "").strip()
        if len(name) >= 5:
            exakt[name] = "Name"
            teile = name.replace("Dr.", "").split()
            if len(teile) >= 2 and len(teile[-1]) >= 5 and teile[-1].lower() not in ALLTAG:
                exakt[teile[-1]] = "Nachname"
        firma = (z.get("unternehmen") or "").strip()
        if len(firma) >= 6:
            exakt[firma] = "Firma"
        url = z.get("linkedin_url") or ""
        m = re.search(r"/in/([^/?#]+)", url)
        if m and len(m.group(1)) >= 6:
            exakt[m.group(1).lower()] = "LinkedIn-Slug"
        tel = re.sub(r"\D", "", str(z.get("telefonnummer") or ""))
        if len(tel) >= 7:
            exakt[tel] = "Telefon"
        notiz = (z.get("notizen") or "").strip()
        if len(notiz) >= 30:
            exakt[notiz[:30]] = "Notiz"
    # Ausnahmen: Gründer selbst und die Sperr-Formel sind kein Lead-Datum
    for frei in ("Vincent Steiner", "Mike Mbokolanzi", "Steiner & Co."):
        exakt.pop(frei, None)
    return exakt


def dateien():
    aus = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout.splitlines()
    for f in aus:
        p = ROOT / f
        if p.suffix.lower() in TEXT_ENDUNGEN and p.is_file() and p.stat().st_size < 3_000_000:
            yield f, p


def main():
    if not QUELLE.exists():
        print("pruefe-personendaten: supabase/seed-privat/crm_leads.json fehlt – Prüfung übersprungen.")
        return 0
    zeilen = zeilen_finden(json.loads(QUELLE.read_text(encoding="utf-8"))) or []
    muster = muster_bauen(zeilen)
    treffer = []
    for rel, p in dateien():
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        unten = text.lower()
        for wort, art in muster.items():
            suche = wort.lower() if art == "LinkedIn-Slug" else wort
            quelle = unten if art == "LinkedIn-Slug" else text
            if art == "Nachname":
                if not re.search(r"(?<![\wäöüÄÖÜß])" + re.escape(wort) + r"(?![\wäöüÄÖÜß])", quelle):
                    continue
            elif suche not in quelle:
                continue
            zeile = quelle[: quelle.find(suche)].count("\n") + 1 if suche in quelle else "?"
            treffer.append((rel, zeile, art, wort))
    if treffer:
        print(f"Echte Personendaten im Repository gefunden ({len(treffer)}):")
        for rel, zeile, art, wort in sorted(treffer):
            print(f"  {rel}:{zeile}  {art}: {wort}")
        print("Bitte durch synthetische Beispiele ersetzen (Testdaten, Kommentare, Doku).")
        return 1
    print(f"pruefe-personendaten: keine Treffer ({len(muster)} Muster, Repository sauber).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
