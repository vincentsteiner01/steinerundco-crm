/**
 * LinkedIn ins CRM – Steiner & Co.
 *
 * Läuft in DEINEM Gmail-Konto (script.google.com) und schickt alle 5 Minuten nur LinkedIn-Benachrichtigungen
 * (Absender linkedin.com) an das CRM: Betreff, Absender, Datum, den Anfang des Textes und die LinkedIn-Links.
 * Das CRM verbucht daraus „Einladung angenommen“ und „Antwort erhalten“ am passenden Lead.
 *
 * Das Script liest keine anderen Mails, sendet nichts, löscht nichts und tut nichts bei LinkedIn.
 * Es setzt nur das Label „CRM/erfasst“ an die übertragenen LinkedIn-Mails.
 * Der Eingangs-Schlüssel steht NICHT im Code, sondern in den Skripteigenschaften (CRM_SCHLUESSEL).
 *
 * Einrichtung: tools/apps-script/ANLEITUNG.md – kurz: Schlüssel als Skripteigenschaft CRM_SCHLUESSEL eintragen,
 * dann einrichten() ausführen. Anhalten: stoppen() ausführen.
 */

var CRM_URL = 'https://ekaqkfgvisdngsskzbai.supabase.co/functions/v1/linkedin-eingang';
var LABEL = 'CRM/erfasst';
var SUCHE = 'from:linkedin.com newer_than:3d -label:"CRM/erfasst"';
var MAX_MAILS = 50;            // Mails je Aufruf (Grenze der Edge Function)
var MAX_JE_THREAD = 10;        // jüngste Mails je Unterhaltung
var MAX_TEXT = 6000;           // Zeichen Klartext je Mail
var MAX_LINKS = 20;            // LinkedIn-Links je Mail
var MAX_ZEICHEN = 90000;       // Zeichen je Aufruf – bleibt sicher unter 200 kB
// Diese Link-Parameter bleiben erhalten (Weiterleitungsziel); alle anderen (Tracking, Login-Token) werden entfernt.
var BEHALTEN = ['url', 'q', 'u', 'redirect', 'redirect_uri', 'redirectUrl', 'dest', 'destination', 'target', 'session_redirect'];

/**
 * Einmal ausführen. Nimmt den Schlüssel aus der Skripteigenschaft CRM_SCHLUESSEL (oder als Argument),
 * legt das Label an, ersetzt alte Trigger durch einen 5-Minuten-Trigger und holt sofort die Mails der letzten 3 Tage.
 */
function einrichten(schluessel) {
  var props = PropertiesService.getScriptProperties();
  if (typeof schluessel === 'string' && schluessel.trim()) props.setProperty('CRM_SCHLUESSEL', schluessel.trim());
  var s = props.getProperty('CRM_SCHLUESSEL') || '';
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(s.trim())) {
    throw new Error('Kein gültiger Schlüssel: bitte in den Projekteinstellungen die Skripteigenschaft CRM_SCHLUESSEL eintragen (siehe ANLEITUNG.md).');
  }
  if (!GmailApp.getUserLabelByName(LABEL)) GmailApp.createLabel(LABEL);
  stoppen();
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(5).create();
  console.log('Eingerichtet: läuft ab jetzt alle 5 Minuten.');
  var ergebnis = sync();
  console.log('Erster Lauf: ' + JSON.stringify(ergebnis));
}

/** Entfernt den 5-Minuten-Trigger. Danach wird nichts mehr übertragen. */
function stoppen() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sync') { ScriptApp.deleteTrigger(t); n++; }
  });
  console.log(n ? 'Gestoppt: ' + n + ' Trigger entfernt.' : 'Es lief kein Trigger.');
}

/** Ein Lauf von Hand, mit Ausgabe der CRM-Antwort im Ausführungsprotokoll. */
function test() {
  console.log('CRM-Antwort: ' + JSON.stringify(sync()));
}

/** Holt neue LinkedIn-Mails (je Mail, nicht je Unterhaltung), schickt sie in Paketen und setzt danach das Label. */
function sync() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { console.log('Läuft schon – übersprungen.'); return null; }
  try {
    var schluessel = (PropertiesService.getScriptProperties().getProperty('CRM_SCHLUESSEL') || '').trim();
    if (!schluessel) { console.error('Kein Schlüssel – bitte einrichten() ausführen (ANLEITUNG.md).'); return null; }
    var label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
    var grenze = Date.now() - 3 * 24 * 3600 * 1000;
    var cache = CacheService.getScriptCache();   // schon übertragene Message-IDs (6 Stunden) nicht erneut schicken
    var summe = { neu: 0, doppelt: 0, verarbeitet: 0, unbekannt: 0, ignoriert: 0, offen: 0, fehler: 0, mails: 0 };
    var paket = [], paketThreads = [], zeichen = 0;

    var threads = GmailApp.search(SUCHE, 0, MAX_MAILS);
    for (var i = 0; i < threads.length; i++) {
      var eintraege = threads[i].getMessages()
        .filter(function (m) { return istLinkedin_(m.getFrom()) && m.getDate().getTime() >= grenze && !cache.get(m.getId()); })
        .slice(-MAX_JE_THREAD)
        .map(eintrag_);
      var groesse = eintraege.reduce(function (n, e) { return n + JSON.stringify(e).length; }, 0);
      if (groesse > MAX_ZEICHEN) {   // sehr lange Unterhaltung: Texte kürzen, damit ein Aufruf nie zu groß wird
        eintraege.forEach(function (e) { e.text = e.text.slice(0, 1500); e.links = e.links.slice(0, 5); });
        groesse = eintraege.reduce(function (n, e) { return n + JSON.stringify(e).length; }, 0);
      }
      if (paket.length && (paket.length + eintraege.length > MAX_MAILS || zeichen + groesse > MAX_ZEICHEN)) {
        if (!senden_(schluessel, paket, paketThreads, label, summe)) return summe;
        paket = []; paketThreads = []; zeichen = 0;
      }
      paket = paket.concat(eintraege);
      paketThreads.push(threads[i]);
      zeichen += groesse;
    }
    if (paketThreads.length) senden_(schluessel, paket, paketThreads, label, summe);
    console.log('CRM: ' + summe.mails + ' Mails · neu ' + summe.neu + ' · doppelt ' + summe.doppelt + ' · verbucht ' + summe.verarbeitet +
                ' · unbekannt ' + summe.unbekannt + ' · ignoriert ' + summe.ignoriert + ' · offen ' + summe.offen + ' · Fehler ' + summe.fehler);
    return summe;
  } finally {
    lock.releaseLock();
  }
}

/** Schickt ein Paket ans CRM; bei Erfolg bekommen die Unterhaltungen das Label. false = abbrechen (nächster Lauf versucht es neu). */
function senden_(schluessel, paket, threads, label, summe) {
  if (paket.length) {
    var antwort = UrlFetchApp.fetch(CRM_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + schluessel },
      payload: JSON.stringify({ nachrichten: paket }),
      muteHttpExceptions: true,
    });
    var code = antwort.getResponseCode();
    if (code === 401) {
      console.error('Schlüssel ungültig oder widerrufen – im CRM einen neuen erzeugen und als CRM_SCHLUESSEL eintragen.');
      return false;
    }
    if (code < 200 || code >= 300) {
      console.error('CRM antwortet ' + code + ': ' + antwort.getContentText().slice(0, 300));
      return false;
    }
    var z = JSON.parse(antwort.getContentText());
    Object.keys(summe).forEach(function (k) { if (typeof z[k] === 'number') summe[k] += z[k]; });
    summe.mails += paket.length;
    var ids = {};
    paket.forEach(function (e) { ids[e.id] = '1'; });
    CacheService.getScriptCache().putAll(ids, 21600);
  }
  for (var i = 0; i < threads.length; i += 100) label.addToThreads(threads.slice(i, i + 100));
  return true;
}

/** Eine Mail → das, was das CRM braucht. Kein HTML, keine Anhänge, Text gekürzt, Links ohne Tracking-Parameter. */
function eintrag_(m) {
  var auth = m.getHeader('Authentication-Results') || '';
  return {
    id: m.getId(),
    datum: m.getDate().toISOString(),
    betreff: m.getSubject().slice(0, 500),
    von: m.getFrom().slice(0, 300),
    text: (m.getPlainBody() || '').slice(0, MAX_TEXT),
    links: linkedinLinks_(m.getBody() || ''),
    dmarc: /dmarc=pass/i.test(auth) ? 'pass' : /dmarc=fail/i.test(auth) ? 'fail' : '',
  };
}

function istLinkedin_(von) {
  var m = /<([^>]+)>/.exec(von);
  var adresse = (m ? m[1] : von).trim().toLowerCase();
  return /@(?:[a-z0-9-]+\.)*linkedin\.com$/.test(adresse);
}

/** Alle href-Ziele, die linkedin.com enthalten (auch kodiert in Weiterleitungen), bereinigt und ohne Doppelte. */
function linkedinLinks_(html) {
  var re = /href\s*=\s*["']([^"']+)["']/gi, treffer, links = [];
  while ((treffer = re.exec(html)) !== null && links.length < MAX_LINKS) {
    var href = treffer[1].replace(/&amp;/g, '&');
    if (!/linkedin\.com/i.test(href)) continue;
    var sauber = linkBereinigen_(href).slice(0, 500);
    if (links.indexOf(sauber) < 0) links.push(sauber);
  }
  return links;
}

function linkBereinigen_(href) {
  var ohneAnker = href.split('#')[0];
  var q = ohneAnker.indexOf('?');
  if (q < 0) return ohneAnker;
  var behalten = ohneAnker.slice(q + 1).split('&').filter(function (p) {
    return BEHALTEN.indexOf(p.split('=')[0]) >= 0;
  });
  return ohneAnker.slice(0, q) + (behalten.length ? '?' + behalten.join('&') : '');
}
