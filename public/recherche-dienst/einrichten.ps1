# Recherche-Dienst einrichten – Windows (LinkedIn-Recherche im CRM, mit ChatGPT), Gegenstück zu einrichten.sh für den Mac
# (30.10.2026). Für Menschen ohne Technikerfahrung gebaut (Vincent: „idiotensicher, so viel es geht vorkauen und sagen, WARUM“):
# Das Skript prüft der Reihe nach Chrome, ChatGPT-App, ChatGPT-Erweiterung, Computer Use und LinkedIn-Freigabe, öffnet die
# passende Seite, erklärt jeden Schritt samt Grund und wartet auf Enter. Danach lädt es den Dienst nach
# %LOCALAPPDATA%\steinerundco-recherche, legt den persönlichen Dienst-Schlüssel DPAPI-verschlüsselt ab (nur dieses Windows-Konto
# kann ihn lesen) und startet den Dienst bei jeder Anmeldung ohne Fenster (Autostart-Ordner → start.ps1, das ihn am Laufen hält).
# Kein Admin nötig. Den Befehl erzeugt das CRM (Recherche-Dienst einrichten → Windows), einzufügen in Windows PowerShell:
#
#   & ([scriptblock]::Create((irm https://crm.steinerundco.de/recherche-dienst/einrichten.ps1))) rd_…
#   & ([scriptblock]::Create((irm https://crm.steinerundco.de/recherche-dienst/einrichten.ps1))) -Aus      stoppen und entfernen
#
# Codex und Node bringt die ChatGPT-App mit; ihre Pfade stehen im Computer-Use-Plugin unter %USERPROFILE%\.codex (ändern sich mit
# Updates, deshalb sucht start.ps1 bzw. dienst.mjs sie bei jedem Start neu).
# Achtung beim Bearbeiten: Das Skript läuft als Skriptblock – return statt exit (exit schlösse das Fenster) und keine
# typografischen Anführungszeichen im Code (PowerShell hält sie für echte). Prüfen: Parser auf diese Datei, 0 Fehler.
param([string]$Schluessel, [switch]$Aus)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$crm = if ($env:CRM_URL) { $env:CRM_URL } else { 'https://crm.steinerundco.de' }
$basis = Join-Path $env:LOCALAPPDATA 'steinerundco-recherche'
$logs = Join-Path $basis 'logs'
$autostartOrdner = [Environment]::GetFolderPath('Startup')
if (-not $autostartOrdner) { $autostartOrdner = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup' }
$autostart = @((Join-Path $autostartOrdner 'Steiner-Recherche-Dienst.vbs'), (Join-Path $autostartOrdner 'Steiner-Recherche-Dienst.cmd'))
$computerUse = Join-Path $env:USERPROFILE '.codex\plugins\cache\openai-bundled\unified-computer-use'
$erweiterungen = @('hehggadaopoacecdllhhajmbjkdcmajg', 'odlomjlbamekndcpllcnffbgeohgkmjh')
$erweiterungSeite = 'https://chromewebstore.google.com/detail/chatgpt/hehggadaopoacecdllhhajmbjkdcmajg'
$schritte = 6

# ---- Ausgabe: kurz, freundlich, immer mit Grund ----
function Titel([int]$Nr, [string]$Text) {
  Write-Host ''
  Write-Host "Schritt $Nr von ${schritte}: $Text" -ForegroundColor Cyan
}
function Warum([string]$Text) { Write-Host "  Warum? $Text" -ForegroundColor Gray }
function Tun([string]$Text) { Write-Host "  >> $Text" -ForegroundColor Yellow }
function Gut([string]$Text) { Write-Host "  OK: $Text" -ForegroundColor Green }
function Hinweis([string]$Text) { Write-Host "  $Text" }

function Warte-Bis([scriptblock]$Pruefung, [int]$Versuche = 4) {
  # wartet auf Enter und prüft dann; nach mehreren Versuchen darf die Person selbst bestätigen
  for ($i = 1; $i -le $Versuche; $i++) {
    [void](Read-Host '  Wenn du das erledigt hast, drück hier Enter')
    if (& $Pruefung) { return $true }
    Write-Host '  Das sehe ich noch nicht. Schau bitte noch einmal nach, warte einen Moment und drück dann wieder Enter.' -ForegroundColor Yellow
  }
  $antwort = Read-Host '  Ich kann es nicht prüfen. Bist du sicher, dass es erledigt ist? Dann tippe j und Enter'
  return ($antwort -match '^\s*j')
}

# ---- Prüfungen ----
function Chrome-Pfad {
  $kandidaten = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA) | Where-Object { $_ } |
    ForEach-Object { Join-Path $_ 'Google\Chrome\Application\chrome.exe' }
  foreach ($k in $kandidaten) { if (Test-Path -LiteralPath $k) { return $k } }
  foreach ($wurzel in 'HKCU:', 'HKLM:') {
    try {
      $p = (Get-ItemProperty -Path "$wurzel\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction Stop).'(default)'
      if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    } catch {}
  }
  return $null
}

function ChatGPT-App {
  # Store-Paket – oder Spuren der App in %USERPROFILE%\.codex, falls Get-AppxPackage hier nicht geht (PowerShell 7)
  try {
    if (Get-AppxPackage -ErrorAction Stop | Where-Object { $_.Name -like 'OpenAI.*' -or $_.Name -like '*ChatGPT*' }) { return $true }
  } catch {}
  return (Test-Path -LiteralPath $computerUse) -or (Test-Path -LiteralPath (Join-Path $env:USERPROFILE '.codex\auth.json'))
}

function Erweiterung-Da {
  foreach ($id in $erweiterungen) {
    if (Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\*\Extensions\$id") -Directory -ErrorAction SilentlyContinue) { return $true }
  }
  return $false
}

function Computer-Use {
  # cua_repl aus dem neuesten Computer-Use-Plugin der ChatGPT-App (enthält die Pfade zu Node und Codex)
  $datei = Get-ChildItem -Path (Join-Path $computerUse '*\.mcp.json') -Force -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $datei) { return $null }
  try { return (Get-Content -Raw -Encoding UTF8 -LiteralPath $datei.FullName | ConvertFrom-Json).mcpServers.cua_repl } catch { return $null }
}

function Finde-Node {
  $cua = Computer-Use
  if ($cua -and $cua.command -and ((Split-Path -Leaf $cua.command) -match '^node(\.exe)?$') -and (Test-Path -LiteralPath $cua.command)) { return $cua.command }
  $n = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($n) { return $n.Source }
  return $null
}

function Finde-Codex {
  $cua = Computer-Use
  if ($cua -and $cua.env -and $cua.env.CODEX_CLI_PATH -and (Test-Path -LiteralPath $cua.env.CODEX_CLI_PATH)) { return $cua.env.CODEX_CLI_PATH }
  $c = Get-Command codex.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  return $null
}

function LinkedIn-Erlaubt {
  foreach ($f in (Join-Path $env:USERPROFILE '.codex\browser\config.toml'), (Join-Path $env:USERPROFILE '.codex\config.toml')) {
    if ((Test-Path -LiteralPath $f) -and (Select-String -LiteralPath $f -SimpleMatch 'linkedin.com' -Quiet)) { return $true }
  }
  return $false
}

function Oeffnen([string]$Ziel, [string]$Mit) {
  try { if ($Mit) { Start-Process -FilePath $Mit -ArgumentList $Ziel } else { Start-Process $Ziel } } catch {}
}

function Stoppen {
  # alles aus dem Dienst-Ordner: Wächter (start.ps1), Dienst, Codex-Agent, CRM-Werkzeuge – nicht dieses Fenster
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -like '*steinerundco-recherche*' } |
    Sort-Object { if ($_.CommandLine -like '*start.ps1*') { 0 } else { 1 } } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Abbruch([string]$Text) {
  Write-Host ''
  Write-Host "Hier komme ich nicht weiter: $Text" -ForegroundColor Red
  Write-Host 'Mach bitte ein Foto von diesem Fenster und schick es Vincent. Du hast nichts kaputt gemacht.' -ForegroundColor Red
}

# ---- Entfernen ----
if ($Aus) {
  Stoppen
  $autostart | ForEach-Object { Remove-Item -LiteralPath $_ -Force -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath (Join-Path $basis 'schluessel.dpapi') -Force -ErrorAction SilentlyContinue
  Write-Host 'Recherche-Dienst gestoppt und entfernt.'
  return
}

if ($Schluessel -notmatch '^rd_[0-9a-f]{64}$') {
  Write-Host 'Da fehlt dein persönlicher Schlüssel. Bitte den ganzen Befehl aus dem CRM kopieren (Knopf Kopieren) und erneut einfügen.' -ForegroundColor Red
  return
}

Write-Host ''
Write-Host 'Hallo! Dieses Fenster richtet den Recherche-Dienst für die LinkedIn-Recherche ein.' -ForegroundColor Cyan
Write-Host 'Ich erkläre dir jeden Schritt und warum er nötig ist. Du kannst dabei nichts kaputt machen.'
Write-Host 'Wenn ich dich um etwas bitte: mach es, komm hierher zurück und drück Enter.'
Write-Host 'Klemmt etwas: Foto von diesem Fenster an Vincent schicken.'

# ---- 1. Chrome ----
Titel 1 'Google Chrome'
Warum 'ChatGPT arbeitet für dich in Chrome, weil du dort bei LinkedIn angemeldet bist.'
$chrome = Chrome-Pfad
if ($chrome) { Gut 'Chrome ist installiert.' }
else {
  Tun 'Chrome fehlt noch. Ich öffne dir die Download-Seite. Klick dort auf Chrome herunterladen und installiere es.'
  Tun 'Melde dich danach in Chrome bei LinkedIn an.'
  Oeffnen 'https://www.google.com/chrome/'
  if (-not (Warte-Bis { [bool](Chrome-Pfad) })) { Abbruch 'Chrome ist nicht installiert.'; return }
  $chrome = Chrome-Pfad
  Gut 'Chrome ist installiert.'
}

# ---- 2. ChatGPT-App ----
Titel 2 'ChatGPT-App'
Warum 'Die Recherche macht ChatGPT. Die App bringt das Programm mit, das später im Hintergrund für dich arbeitet - über deinen ChatGPT-Zugang.'
if (ChatGPT-App) { Gut 'Die ChatGPT-App ist installiert.' }
else {
  Tun 'Die ChatGPT-App fehlt noch. Ich öffne dir den Microsoft Store. Klick dort auf Herunterladen (oder Installieren).'
  Tun 'Öffne danach die App (Windows-Taste drücken, ChatGPT tippen, Enter) und melde dich mit deinem ChatGPT-Konto an.'
  Oeffnen 'ms-windows-store://pdp/?ProductId=9PLM9XGG6VKS'
  if (-not (Warte-Bis { ChatGPT-App })) { Abbruch 'Die ChatGPT-App ist nicht installiert.'; return }
  Gut 'Die ChatGPT-App ist installiert. Bitte sei darin angemeldet.'
}

# ---- 3. ChatGPT-Erweiterung in Chrome ----
Titel 3 'ChatGPT-Erweiterung in Chrome'
Warum 'Über diese Erweiterung kann ChatGPT in Chrome lesen und klicken - so, wie du es selbst tun würdest.'
if (Erweiterung-Da) { Gut 'Die Erweiterung ist in Chrome installiert.' }
else {
  Tun 'Ich öffne dir die Seite der Erweiterung in Chrome. Klick dort auf Zu Chrome hinzufügen.'
  Tun 'Chrome fragt dann, ob die Erweiterung Webseiten lesen und ändern darf. Klick auf Erweiterung hinzufügen.'
  Hinweis 'Chrome fragt das, weil die Erweiterung Webseiten für dich bedienen soll - genau das brauchen wir für LinkedIn.'
  Oeffnen $erweiterungSeite $chrome
  if (-not (Warte-Bis { Erweiterung-Da })) { Abbruch 'Die ChatGPT-Erweiterung fehlt in Chrome.'; return }
  Gut 'Die Erweiterung ist in Chrome installiert.'
}

# ---- 4. Computer Use in der ChatGPT-App ----
Titel 4 'Computer Use in der ChatGPT-App einschalten'
Warum 'Erst damit darf ChatGPT dein Chrome steuern. Ohne Computer Use kann es nur chatten, aber nichts anklicken.'
if (Finde-Codex) { Gut 'Computer Use ist eingeschaltet.' }
else {
  Tun 'Öffne die ChatGPT-App und wechsle dort zu Codex.'
  Tun 'Klick auf Plugins und dann auf Computer Use.'
  Tun 'Klick auf Installieren (Install plugin) - oder auf Aktivieren (Enable), falls das dort steht.'
  Tun 'Schalte die Schalter dort ein und klick auf Jetzt ausprobieren (Try now).'
  Tun 'Zur Kontrolle: In der App unter Einstellungen > Computer Use steht bei Google Chrome Verwalten (Manage).'
  Hinweis 'Fragt die App dabei nach einer Erlaubnis, klick auf Erlauben - genau darum geht es in diesem Schritt.'
  if (-not (Warte-Bis { [bool](Finde-Codex) })) { Abbruch 'Computer Use ist in der ChatGPT-App noch nicht eingeschaltet.'; return }
  Gut 'Computer Use ist eingeschaltet.'
}
$node = Finde-Node
if (-not $node) {
  Abbruch 'Ein Teil der ChatGPT-App (Node) fehlt. Vincent kann das mit einem Befehl nachinstallieren.'
  Hinweis "Zur Fehlersuche: Codex = $(Finde-Codex), Plugin-Ordner = $(Test-Path -LiteralPath $computerUse)"
  return
}

# ---- 5. Recherche-Dienst einrichten ----
Titel 5 'Recherche-Dienst einrichten'
Warum 'Der Dienst ist ein kleines Programm ohne Fenster. Er wartet, bis du im CRM auf Recherche starten drückst, und startet dann ChatGPT für dich.'
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  New-Item -ItemType Directory -Force -Path $basis, (Join-Path $basis 'arbeitsordner'), $logs, $autostartOrdner | Out-Null
  foreach ($f in 'dienst.mjs', 'crm-mcp.mjs', 'gemeinsam.mjs', 'verbindung.json') {
    $ziel = Join-Path $basis $f
    Invoke-WebRequest -UseBasicParsing -Uri "$crm/recherche-dienst/$f" -OutFile "$ziel.neu"
    # Unbekannte Pfade beantwortet der Server mit der CRM-Seite statt mit einem Fehler
    if ((Get-Content -LiteralPath "$ziel.neu" -TotalCount 1 -Encoding UTF8) -match '^\s*<') { throw "Download von $f fehlgeschlagen." }
    Move-Item -Force -LiteralPath "$ziel.neu" -Destination $ziel
  }
  [IO.File]::WriteAllText((Join-Path $basis 'package.json'), '{ "type": "module" }')
  Gut 'Dienst geladen.'

  ConvertTo-SecureString -String $Schluessel -AsPlainText -Force | ConvertFrom-SecureString |
    Set-Content -LiteralPath (Join-Path $basis 'schluessel.dpapi') -Encoding Ascii
  Gut 'Deinen persönlichen Schlüssel verschlüsselt gespeichert.'
  Warum 'Damit nur dieser Computer in deinem Namen im CRM arbeiten darf. Gib den Befehl deshalb nicht weiter.'

  # Wächter: sucht Node bei jedem Start neu (App-Updates ändern den Pfad) und startet den Dienst nach 30 s wieder
  $waechter = @'
# Recherche-Dienst (Steiner & Co.): startet dienst.mjs ohne Fenster und haelt ihn am Laufen. Erzeugt von einrichten.ps1.
$basis = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $basis 'logs\dienst.log'
$plugin = Join-Path $env:USERPROFILE '.codex\plugins\cache\openai-bundled\unified-computer-use'
function Finde-Node {
  $datei = Get-ChildItem -Path (Join-Path $plugin '*\.mcp.json') -Force -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($datei) {
    try {
      $c = (Get-Content -Raw -Encoding UTF8 -LiteralPath $datei.FullName | ConvertFrom-Json).mcpServers.cua_repl.command
      if ($c -and ((Split-Path -Leaf $c) -match '^node(\.exe)?$') -and (Test-Path -LiteralPath $c)) { return $c }
    } catch {}
  }
  $n = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($n) { return $n.Source }
  return $null
}
while ($true) {
  $node = Finde-Node
  if ($node) {
    & $node (Join-Path $basis 'dienst.mjs') *> $null
  } else {
    Add-Content -LiteralPath $log -Value ((Get-Date).ToString('o') + ' Kein Node gefunden - ChatGPT-App mit Computer Use einrichten.')
  }
  Start-Sleep -Seconds 30
}
'@
  [IO.File]::WriteAllText((Join-Path $basis 'start.ps1'), $waechter, [Text.Encoding]::ASCII)

  # Autostart: VBScript startet PowerShell wirklich unsichtbar; ohne VBScript (neuere Windows-Versionen) eine .cmd
  $autostart | ForEach-Object { Remove-Item -LiteralPath $_ -Force -ErrorAction SilentlyContinue }
  $probe = Join-Path $basis 'probe.vbs'
  [IO.File]::WriteAllText($probe, 'WScript.Quit 42', [Text.Encoding]::ASCII)
  try {
    $mitVbs = (Start-Process -FilePath 'cscript.exe' -ArgumentList @('//Nologo', '//B', "`"$probe`"") -Wait -PassThru -WindowStyle Hidden).ExitCode -eq 42
  } catch { $mitVbs = $false }
  Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
  if ($mitVbs) {
    $eintrag = $autostart[0]
    $vbs = @'
' Recherche-Dienst (Steiner & Co.) bei der Anmeldung ohne Fenster starten - erzeugt von einrichten.ps1
Set sh = CreateObject("WScript.Shell")
skript = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\steinerundco-recherche\start.ps1"
sh.Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & skript & """", 0, False
'@
    [IO.File]::WriteAllText($eintrag, $vbs, [Text.Encoding]::ASCII)
  } else {
    $eintrag = $autostart[1]
    $cmd = '@start "" /min powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LOCALAPPDATA%\steinerundco-recherche\start.ps1"'
    [IO.File]::WriteAllText($eintrag, $cmd, [Text.Encoding]::ASCII)
  }
  Gut 'In den Autostart eingetragen.'
  Warum 'Damit der Dienst nach jedem Neustart von allein läuft. Du siehst davon kein Fenster.'

  Stoppen
  Start-Sleep -Seconds 1
  $log = Join-Path $logs 'dienst.log'
  $vorher = if (Test-Path -LiteralPath $log) { @(Get-Content -LiteralPath $log -Encoding UTF8).Count } else { 0 }
  if ($mitVbs) { Start-Process -FilePath 'wscript.exe' -ArgumentList @('//B', '//Nologo', "`"$eintrag`"") }
  else { Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', "`"$eintrag`"") -WindowStyle Hidden }
} catch {
  Abbruch "Einrichtung fehlgeschlagen ($($_.Exception.Message))."
  return
}

# Erfolg erst melden, wenn der Dienst das CRM erreicht hat (Schlüssel, Verbindung) – sonst die neuen Protokollzeilen zeigen
Hinweis 'Ich teste jetzt die Verbindung zum CRM. Das dauert bis zu 45 Sekunden ...'
$neu = @()
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path -LiteralPath $log) { $neu = @(Get-Content -LiteralPath $log -Encoding UTF8 | Select-Object -Skip $vorher) }
  if ($neu -match 'Verbunden mit dem CRM') { break }
}
if ($neu -match 'Verbunden mit dem CRM') {
  Gut 'Der Recherche-Dienst läuft und ist mit dem CRM verbunden.'
} else {
  Abbruch 'Der Recherche-Dienst hat das CRM nicht erreicht.'
  if ($neu.Count) { $neu | Select-Object -Last 15 | ForEach-Object { Hinweis $_ } } else { Hinweis '(keine Protokollzeilen)' }
  return
}

# ---- 6. LinkedIn einmal erlauben ----
Titel 6 'LinkedIn einmal erlauben'
Warum 'ChatGPT fragt bei jeder neuen Webseite einmal nach, ob es sie benutzen darf. Später arbeitet es im Hintergrund und kann dich nicht fragen - deshalb erlaubst du LinkedIn jetzt einmal vorab.'
if (LinkedIn-Erlaubt) { Gut 'LinkedIn ist schon erlaubt.' }
else {
  Tun 'In der ChatGPT-App bei Codex einen neuen Chat öffnen.'
  Tun 'Dort eintippen:  @Chrome öffne https://www.linkedin.com/feed/  und Enter drücken.'
  Tun 'Fragt ChatGPT, ob es linkedin.com benutzen darf: auf Für diese Seite erlauben klicken (Allow for this site).'
  Hinweis 'Bist du in Chrome noch nicht bei LinkedIn angemeldet, melde dich jetzt dort an.'
  [void](Read-Host '  Wenn LinkedIn in Chrome aufgegangen ist und du es erlaubt hast, drück hier Enter')
}

Write-Host ''
Write-Host 'Alles fertig! Du kannst dieses Fenster jetzt schließen.' -ForegroundColor Green
Write-Host 'Im CRM steht jetzt: Recherche-Dienst verbunden.'
Write-Host ''
Write-Host 'So geht es weiter:'
Hinweis '1. Im CRM links auf den blauen Knopf Recherche starten drücken.'
Hinweis '2. ChatGPT sucht in deinem Chrome passende Leute. Lass Chrome offen und den Computer an - du kannst zuschauen.'
Hinweis '3. Bevor jemand angefragt wird, steht im CRM Freigabe nötig mit der Liste. Erst wenn du Freigeben klickst, gehen die Anfragen raus.'
Warum 'Die Anfragen gehen in deinem Namen raus - deshalb entscheidest du, wer angefragt wird.'
