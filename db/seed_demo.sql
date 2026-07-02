-- Demo-data ohje24.html:n nykyisiin CODES/COMPANY/BUILDING-arvoihin perustuen.
-- Idempotentti: turvallinen ajaa uudestaan (ON CONFLICT DO NOTHING).
-- Aja: psql "$DATABASE_URL" -f db/seed_demo.sql

BEGIN;

-- Kiinteä UUID demokohteelle (helpottaa uudelleenajoa ja ristiviittauksia)
WITH kohde AS (
  INSERT INTO kohteet (id, nimi, osoite, building, status, docs)
  VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Asunto Oy Esimerkkitie 4',
    'Esimerkkitie 4, 00100 Helsinki',
    '{
      "kokoontuminen": "Piha, lipputangon vieressä",
      "reitit": "Poistu lähintä porrasta pitkin ulos. Älä käytä hissiä.",
      "avaukset": [
        {"ikoni":"🛡️","otsikko":"Väestönsuoja (VSS)","sijainti":"Kellari, A-rappu — opaste ''VSS''"},
        {"ikoni":"🔑","otsikko":"Pelastuslaitoksen avainsäilö","sijainti":"Pääoven vieressä oikealla (putkilukko)"},
        {"ikoni":"⚡","otsikko":"Sähköpääkeskus / pääkytkin","sijainti":"Tekninen tila, kellari, A-rappu"},
        {"ikoni":"🚰","otsikko":"Päävesisulku","sijainti":"Lämmönjakohuone, kellari"},
        {"ikoni":"💨","otsikko":"Savunpoiston laukaisu","sijainti":"Porrashuone, 1. krs, aulan seinä"}
      ],
      "aula_contacts": [
        {"ikoni":"🚨","ala":"Yleinen hätänumero","yritys":"Hätäkeskus","puhelin":"112"},
        {"ikoni":"🏢","ala":"Isännöinti","yritys":"Isännöinti Demo Oy","puhelin":"09 000 0000"},
        {"ikoni":"🔧","ala":"Huoltopäivystys 24 h","yritys":"Huoltoyhtiö Demo Oy","puhelin":"040 222 2222"}
      ],
      "tarvikkeet_note": "Yhtiössä käytetään vain isännöitsijän hyväksymiä tarvikkeita. Tarkista ennen asennusta."
    }'::jsonb,
    '[
      {"name":"Käsisammuttimet","state":"ok","meta":"Tarkastettu 3/2026 · voimassa 3/2027"},
      {"name":"Väestönsuoja (VSS)","state":"ok","meta":"Tarkastettu 9/2025 · voimassa 9/2035"},
      {"name":"Savunpoisto","state":"ok","meta":"Tarkastettu 5/2026 · voimassa 5/2027"},
      {"name":"Hissit","state":"ok","meta":"Tarkastettu 2/2026 · voimassa 2/2027"},
      {"name":"Palovaroittimet","state":"warn","meta":"Asukkaan omalla vastuulla — muista testata"}
    ]'::jsonb,
    '{
      "pelastus":  {"ikoni":"📄","otsikko":"Pelastussuunnitelma","kuvaus":"PDF · päivitetty 1/2026"},
      "toiminta":  {"ikoni":"🧯","otsikko":"Toimintaohje tulipalossa","kuvaus":"Näin toimit hätätilanteessa"},
      "poistu":    {"ikoni":"🚪","otsikko":"Poistumisreitit","kuvaus":"A-rapun pohjakuva"},
      "huoltodocs": [
        {"ikoni":"🏗️","otsikko":"Rakennekuvat","kuvaus":"PDF · rajattu"},
        {"ikoni":"🚰","otsikko":"Viemäri- ja vesikuvat","kuvaus":"PDF · rajattu"},
        {"ikoni":"⚡","otsikko":"Sähkökuvat","kuvaus":"PDF · rajattu"}
      ]
    }'::jsonb
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT 1;

-- Huolto-kontaktit
INSERT INTO huolto_kontaktit (kohde_id, ala, ikoni, yritys, puhelin)
SELECT '11111111-1111-1111-1111-111111111111'::uuid, ala, ikoni, yritys, puhelin
FROM (VALUES
  ('Putkityöt',   '🚰', 'Putkiliike Malli Oy',        '040 000 0000'),
  ('Sähkötyöt',   '⚡', 'Sähköasennus Esimerkki Oy',  '040 111 1111'),
  ('Yleishuolto', '🔧', 'Huoltoyhtiö Demo Oy',        '040 222 2222')
) AS v(ala, ikoni, yritys, puhelin)
WHERE NOT EXISTS (
  SELECT 1 FROM huolto_kontaktit
  WHERE kohde_id='11111111-1111-1111-1111-111111111111'::uuid AND ala=v.ala AND yritys=v.yritys
);

-- Demo-koodit
INSERT INTO koodit (koodi, kohde_id, nakymatyyppi, data, kohdistettu_pvm, kohdistaja)
VALUES
  ('10AULA', '11111111-1111-1111-1111-111111111111'::uuid, 'aula',   '{}'::jsonb, now(), 'seed'),
  ('82FA66', '11111111-1111-1111-1111-111111111111'::uuid, 'asukas',
    '{"apt":"A12","floor":"1. krs"}'::jsonb, now(), 'seed'),
  ('82CF54', '11111111-1111-1111-1111-111111111111'::uuid, 'laite',
    '{"device":"Käsisammutin","loc":"A-rappu, 2. krs","kind":"sammutin","last":"3/2026","next":"3/2027","state":"ok"}'::jsonb,
    now(), 'seed'),
  ('7HK220', '11111111-1111-1111-1111-111111111111'::uuid, 'huolto',
    '{"room":"Lämmönjakohuone","loc":"Kellari, A-rappu","pin":"2468"}'::jsonb, now(), 'seed'),
  ('90ZZ00', NULL, NULL, '{}'::jsonb, NULL, NULL)
ON CONFLICT (koodi) DO NOTHING;

COMMIT;
