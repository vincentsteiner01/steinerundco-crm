# Recherche-Dienst einrichten – Windows (LinkedIn-Recherche im CRM, mit ChatGPT), Gegenstück zu einrichten.sh für den Mac
# (30.10.2026). Lädt den Dienst von crm.steinerundco.de nach %LOCALAPPDATA%\steinerundco-recherche, legt den persönlichen
# Dienst-Schlüssel DPAPI-verschlüsselt ab (nur dieses Windows-Konto kann ihn lesen) und startet den Dienst bei jeder Anmeldung
# ohne Fenster (Autostart-Ordner → start.ps1, das ihn am Laufen hält). Kein Admin nötig. Den Befehl erzeugt das CRM
# (Laufseite → Recherche-Dienst einrichten → Windows), einzufügen in Windows PowerShell:
#
#   & ([scriptblock]::Create((irm https://crm.steinerundco.de/recherche-dienst/einrichten.ps1))) rd_…
#   & ([scriptblock]::Create((irm https://crm.steinerundco.de/recherche-dienst/einrichten.ps1))) -Aus      stoppen und entfernen
#
# Voraussetzungen: ChatGPT-App für Windows, darin Einstellungen → Computer Use mit Chrome und der Chrome-Erweiterung ChatGPT.
# Codex und Node bringt die App mit; ihre Pfade stehen im Computer-Use-Plugin unter %USERPROFILE%\.codex (ändern sich mit Updates,
# deshalb sucht start.ps1 bzw. dienst.mjs sie bei jedem Start neu).
# Achtung beim Bearbeiten: Das Skript läuft als Skriptblock – return statt exit (exit schlösse das Fenster) und keine
# typografischen Anführungszeichen im Code (PowerShell hält sie für echte).
param([string]$Schluessel, [switch]$Aus)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$crm = if ($env:CRM_URL) { $env:CRM_URL } else { 'https://crm.steinerundco.de' }
$basis = Join-Path $env:LOCALAPPDATA 'steinerundco-recherche'
$logs = Join-Path $basis 'logs'
$autostartOrdner = [Environment]::GetFolderPath('Startup')
$autostart = @((Join-Path $autostartOrdner 'Steiner-Recherche-Dienst.vbs'), (Join-Path $autostartOrdner 'Steiner-Recherche-Dienst.cmd'))
$computerUse = Join-Path $env:USERPROFILE '.codex\plugins\cache\openai-bundled\unified-computer-use'

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

function Stoppen {
  # alles aus dem Dienst-Ordner: Wächter (start.ps1), Dienst, Codex-Agent, CRM-Werkzeuge – nicht dieses Fenster
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -like '*steinerundco-recherche*' } |
    Sort-Object { if ($_.CommandLine -like '*start.ps1*') { 0 } else { 1 } } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

if ($Aus) {
  Stoppen
  $autostart | ForEach-Object { Remove-Item -LiteralPath $_ -Force -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath (Join-Path $basis 'schluessel.dpapi') -Force -ErrorAction SilentlyContinue
  Write-Host 'Recherche-Dienst gestoppt und entfernt.'
  return
}

if ($Schluessel -notmatch '^rd_[0-9a-f]{64}$') {
  Write-Host 'Bitte den vollständigen Befehl aus dem CRM verwenden (Dienst-Schlüssel fehlt).' -ForegroundColor Red
  return
}

$node = Finde-Node
$codex = Finde-Codex
if (-not $codex) {
  Write-Host 'Codex aus der ChatGPT-App wurde nicht gefunden.' -ForegroundColor Red
  Write-Host '1. ChatGPT-App für Windows installieren und anmelden: winget install --id 9PLM9XGG6VKS -s msstore'
  Write-Host '2. In der App: Einstellungen > Computer Use > Chrome auswählen, in Chrome die Erweiterung ChatGPT installieren.'
  Write-Host '3. Danach diesen Befehl erneut ausführen.'
  Write-Host ''
  Write-Host "Zur Fehlersuche: Plugin-Ordner vorhanden = $(Test-Path -LiteralPath $computerUse), Node = $node"
  return
}
if (-not $node) {
  Write-Host 'Node.js fehlt (die ChatGPT-App bringt hier keins mit).' -ForegroundColor Red
  Write-Host 'Installieren mit: winget install --id OpenJS.NodeJS.LTS  - danach PowerShell neu öffnen und diesen Befehl erneut ausführen.'
  return
}

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  New-Item -ItemType Directory -Force -Path $basis, (Join-Path $basis 'arbeitsordner'), $logs | Out-Null
  foreach ($f in 'dienst.mjs', 'crm-mcp.mjs', 'gemeinsam.mjs', 'verbindung.json') {
    $ziel = Join-Path $basis $f
    Invoke-WebRequest -UseBasicParsing -Uri "$crm/recherche-dienst/$f" -OutFile "$ziel.neu"
    # Unbekannte Pfade beantwortet der Server mit der CRM-Seite statt mit einem Fehler
    if ((Get-Content -LiteralPath "$ziel.neu" -TotalCount 1 -Encoding UTF8) -match '^\s*<') { throw "Download von $f fehlgeschlagen." }
    Move-Item -Force -LiteralPath "$ziel.neu" -Destination $ziel
  }
  [IO.File]::WriteAllText((Join-Path $basis 'package.json'), '{ "type": "module" }')
  ConvertTo-SecureString -String $Schluessel -AsPlainText -Force | ConvertFrom-SecureString |
    Set-Content -LiteralPath (Join-Path $basis 'schluessel.dpapi') -Encoding Ascii

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

  Stoppen
  Start-Sleep -Seconds 1
  $log = Join-Path $logs 'dienst.log'
  $vorher = if (Test-Path -LiteralPath $log) { @(Get-Content -LiteralPath $log -Encoding UTF8).Count } else { 0 }
  if ($mitVbs) { Start-Process -FilePath 'wscript.exe' -ArgumentList @('//B', '//Nologo', "`"$eintrag`"") }
  else { Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', "`"$eintrag`"") -WindowStyle Hidden }
} catch {
  Write-Host "Einrichtung fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Red
  return
}

# Erfolg erst melden, wenn der Dienst das CRM erreicht hat (Schlüssel, Verbindung) – sonst die neuen Protokollzeilen zeigen
$neu = @()
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path -LiteralPath $log) { $neu = @(Get-Content -LiteralPath $log -Encoding UTF8 | Select-Object -Skip $vorher) }
  if ($neu -match 'Verbunden mit dem CRM') { break }
}
if ($neu -match 'Verbunden mit dem CRM') {
  Write-Host 'Recherche-Dienst läuft. Im CRM steht gleich: Recherche-Dienst verbunden.' -ForegroundColor Green
} else {
  Write-Host 'Der Recherche-Dienst hat das CRM nicht erreicht. Bitte diese Zeilen an Vincent schicken:' -ForegroundColor Yellow
  if ($neu.Count) { $neu | Select-Object -Last 15 } else { Write-Host '(keine Protokollzeilen)' }
}
$browser = Join-Path $env:USERPROFILE '.codex\browser\config.toml'
if (-not ((Test-Path -LiteralPath $browser) -and (Select-String -LiteralPath $browser -SimpleMatch 'linkedin.com' -Quiet))) {
  Write-Host ''
  Write-Host 'Falls noch nicht geschehen: In der ChatGPT-App in einem Codex-Chat schreiben: @Chrome öffne https://www.linkedin.com/feed/'
  Write-Host 'und linkedin.com für diese Seite erlauben. Sonst darf der Agent LinkedIn nicht öffnen.'
}
