#!/usr/bin/env bash
# Setzt den Passcode (Supabase-Passwort) eines Mitglieds – BAUPLAN § 9.3, architektur § 3.8 b (Weg 1: SQL, ohne service_role).
#   bash tools/passcode-setzen.sh vincent@steinerundco.de
# Der Passcode wird zweimal mit read -s abgefragt (≥ 10 Zeichen, nie im Terminal sichtbar), das SQL im Speicher gebaut und über
# tools/db-query.sh ausgeführt (Datei 0600 im temporären Verzeichnis, danach rm -P). Die Kontrolle druckt kein Geheimnis
# (bcrypt_ok, bestaetigt). pg_stat_statements normalisiert Konstanten, log_statement ist auf Supabase none.
set -euo pipefail
cd "$(dirname "$0")/.."
EMAIL="${1:?Aufruf: bash tools/passcode-setzen.sh <email>}"
case "$EMAIL" in
  *@steinerundco.de) ;;
  *) echo "Nur Mitglieder-Adressen (@steinerundco.de)." >&2; exit 2 ;;
esac

read -r -s -p "Passcode für $EMAIL (mind. 10 Zeichen): " P1; echo >&2
read -r -s -p "Passcode wiederholen: " P2; echo >&2
[[ "$P1" == "$P2" ]] || { echo "Die Eingaben stimmen nicht überein." >&2; exit 3; }
[[ "${#P1}" -ge 10 ]] || { echo "Der Passcode muss mindestens 10 Zeichen haben (password_min_length = 10)." >&2; exit 3; }
unset P2
P1_SQL="${P1//\'/\'\'}"   # einfache Anführungszeichen für das SQL-Literal verdoppeln

# Kostenfaktor 10: GoTrue vergleicht Go-bcrypt, ein crypt()-Hash $2a$10$… ist byte-kompatibel (architektur § 3.8 b).
TMP="$(mktemp)"; chmod 600 "$TMP"
trap 'rm -P "$TMP" 2>/dev/null || rm -f "$TMP"' EXIT
printf "update auth.users set encrypted_password = extensions.crypt('%s', extensions.gen_salt('bf', 10)), updated_at = now() where email = '%s';" \
  "$P1_SQL" "${EMAIL//\'/\'\'}" > "$TMP"
unset P1 P1_SQL

bash tools/db-query.sh -f "$TMP" > /dev/null
rm -P "$TMP" 2>/dev/null || rm -f "$TMP"

# Kontrolle ohne Geheimnis
bash tools/db-query.sh "select email, encrypted_password like '\$2a\$10\$%' as bcrypt_ok, email_confirmed_at is not null as bestaetigt from auth.users where email = '${EMAIL//\'/\'\'}'"
echo "Passcode für $EMAIL gesetzt (nicht gespeichert, nicht ausgegeben)."
