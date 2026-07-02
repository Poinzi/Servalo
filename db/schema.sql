-- Servalo QR-palvelun tietokantaskeema.
-- Idempotentti: server.js ajaa taman kaynnistyksessa (initSchema).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS kohteet (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nimi                text NOT NULL,
  osoite              text,
  y_tunnus            text,
  servalo_customer_id text,
  building            jsonb NOT NULL DEFAULT '{}'::jsonb,
  status              jsonb NOT NULL DEFAULT '[]'::jsonb,
  docs                jsonb NOT NULL DEFAULT '{}'::jsonb,
  qr_kaytossa         boolean NOT NULL DEFAULT true,
  luotu               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koodit (
  koodi           text PRIMARY KEY,
  kohde_id        uuid REFERENCES kohteet(id) ON DELETE SET NULL,
  nakymatyyppi    text CHECK (nakymatyyppi IN ('aula','asukas','laite','huolto')),
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  luotu           timestamptz NOT NULL DEFAULT now(),
  kohdistettu_pvm timestamptz,
  kohdistaja      text
);

CREATE INDEX IF NOT EXISTS koodit_kohde_id_idx ON koodit(kohde_id);

CREATE TABLE IF NOT EXISTS kuittaukset (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koodi     text REFERENCES koodit(koodi) ON DELETE CASCADE,
  tyyppi    text NOT NULL CHECK (tyyppi IN ('palovaroitin','tarkastus','kaynti')),
  aikaleima timestamptz NOT NULL DEFAULT now(),
  meta      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS kuittaukset_koodi_idx ON kuittaukset(koodi);

CREATE TABLE IF NOT EXISTS huolto_kontaktit (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kohde_id   uuid NOT NULL REFERENCES kohteet(id) ON DELETE CASCADE,
  ala        text NOT NULL,
  ikoni      text,
  yritys     text NOT NULL,
  puhelin    text,
  hyvaksytty boolean NOT NULL DEFAULT true,
  luotu      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS huolto_kontaktit_kohde_id_idx ON huolto_kontaktit(kohde_id);

CREATE TABLE IF NOT EXISTS liitteet (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koodi    text REFERENCES koodit(koodi) ON DELETE CASCADE,
  kohde_id uuid REFERENCES kohteet(id) ON DELETE CASCADE,
  tyyppi   text NOT NULL CHECK (tyyppi IN ('piirustus','kuva','dokumentti')),
  nimi     text NOT NULL,
  mime     text,
  data     bytea,
  luotu    timestamptz NOT NULL DEFAULT now()
);
