-- Firmengrenze der Recherche (Migration 23): Franchise-Marken zählen je Standort (03.11.2026, Vincent: „ja, bau das so ein“ auf
-- den Vorschlag, enerix und 1Komma5 je Standort zu zählen – die Standorte sind eigenständige Betriebe mit eigener Geschäftsführung).
-- „enerix Musterstadt“ und „enerix Beispielhausen“ sind damit zwei Unternehmen mit je höchstens 2 Personen; alle anderen Firmen bleiben gruppiert.
-- Gleiche Liste in src/features/recherche/logik.ts (FRANCHISE).

create or replace function crm.firma_gruppe(p text) returns text
language sql immutable set search_path = '' as $$
  with k as (
    select btrim(regexp_replace(regexp_replace(regexp_replace(
             translate(lower(coalesce(p, '')), 'ÄÖÜÉÈÁÀ', 'äöüéèáà'),
             '&\s*co\.?(\s*(kg|ohg))?', ' ', 'g'),
             '\m(gmbh|mbh|ag|kg|ug|ohg|gbr|se|ltd|inc|haftungsbeschränkt|holding|gruppe|group)\M', ' ', 'g'),
             '[^a-z0-9äöüßéèáà]+', ' ', 'g')) as kern
  )
  select nullif(case
           when char_length(split_part(kern, ' ', 1)) >= 4
            and split_part(kern, ' ', 1) <> all (array[
              'solar', 'solare', 'solaranlagen', 'solartechnik', 'solarenergie', 'solarsysteme', 'solarservice', 'solarstrom',
              'photovoltaik', 'energie', 'energy', 'energien', 'energietechnik', 'energiesysteme', 'elektro', 'elektrotechnik',
              'elektrik', 'elektroinstallation', 'haustechnik', 'gebäudetechnik', 'gebaeudetechnik', 'sonnen', 'sonne', 'green',
              'grün', 'gruen', 'neue', 'deutsche', 'deutschland', 'german', 'dach', 'dachtechnik', 'strom', 'power', 'smart',
              'stadtwerke', 'nord', 'north', 'süd', 'sued', 'south', 'west', 'east', 'team', 'service', 'technik', 'tech', 'home',
              'haus', 'zukunft', 'future'])
            -- Franchise-Marken: jeder Standort ist ein eigener Betrieb („enerix Musterstadt“ ≠ „enerix Beispielhausen“)
            and split_part(kern, ' ', 1) <> all (array['enerix', '1komma5'])
           then split_part(kern, ' ', 1)
           else kern
         end, '')
    from k;
$$;
comment on function crm.firma_gruppe(text) is
  'Firmengruppe für die Grenze je Unternehmen: erstes Wort ohne Rechtsform, bei Gattungswörtern und Franchise-Marken (enerix, 1Komma5) der ganze Name (gleiche Regel wie logik.ts firmaGruppe).';
