# QR-palvelu — tehtävälista Cloud Codelle

Anna tämä koodauskeskustelulle. Kuvaa mitä on jo tehty, mitä puuttuu ja missä järjestyksessä. Ydinperiaate: **yksi koodi = yksi näkymä**, kohdistus kentällä, moduuli Servalon sisällä joka ei häiritse pöytäkirjaraportointia (prio 1).

## Nykytila (jo tehty — älä tee uudelleen)
- `ohje24.html`: julkinen QR-sivu, näkymät aula / asukas / laite / huolto + "ei käytössä". PIN-portti huollolle. Palovaroitin-kuittaus (markSmoke) demona.
- `server.js`: host-pohjainen reititys (ohje24-domain → julkinen sivu, muuten Servalo). `/k/<koodi>` ohjautuu oikein. YTJ-proxy `/api/ytj`.
- `servalo.html`: "Koodit & kohteet" -välilehti kohdekortille — skannaus, CSV-tuonti, kuvaliitteet.
- QR-generointi (api.qrserver.com) ja kameraskannaus (BarcodeDetector) valmiina.

## Kriittinen puute
Data on selaimen **localStoragessa**. Asukkaan "palovaroitin testattu" -kuittaus ei säily eikä näy henkilöstölle. Tämä estää oikean käytön. **Tietokanta (Postgres) on tehtävä ensin.**

---

## VAIHE 0 — Tietokanta (tee ensin, ennen muuta)
1. Lisää Postgres Railwayhin (Railway → Add → Database → PostgreSQL). Yhteys `DATABASE_URL`-ympäristömuuttujasta.
2. Lisää `pg`-kirjasto (`npm install pg`) tai käytä Railwayn valmista clientia.
3. Luo taulut:
   - `koodit` (koodi PK, kohde_id, nakymatyyppi [aula|asukas|laite|huolto], nimi, sijainti, nakyvyys, lisatieto, kohdistettu_pvm, kohdistaja)
   - `kohteet` (id PK, yhtio, y_tunnus, osoite, nimi)
   - `kuittaukset` (id PK, koodi, tyyppi [palovaroitin|tarkastus], aikaleima, ei henkilötietoja)
   - `huolto_kontaktit` (id PK, kohde_id, ala [putki|sähkö|...], nimi, puhelin, hyvaksytty)
4. Luo API-reitit `server.js`:ään (kevyt, ei framework-riippuvuutta):
   - `GET /api/koodi/:koodi` → palauttaa näkymän tiedot julkiselle sivulle
   - `POST /api/kuittaus` → tallentaa palovaroitin/tarkastuskuittauksen
   - `POST /api/kohdista` → kentällä: liittää koodin kohteeseen + näkymään (vaatii kirjautumisen)
   - `GET /api/koodit/:kohde_id` → listaa kohteen koodit henkilöstölle
5. Muuta `ohje24.html` lukemaan/kirjoittamaan API:n kautta localStoragen sijaan.

## VAIHE 1 — Kohdistus kentällä
6. Skannaa koodi → jos kohdistamaton, näytä kirjautuneelle henkilöstölle lomake: valitse yhtiö/kohde + näkymätyyppi + asunto/tila → `POST /api/kohdista`.
7. Kohdistamaton koodi näyttää asukkaalle "ei vielä käytössä".
8. Näkymätyyppi lukittuu kohdistuksessa — samaa koodia ei voi käyttää muuhun.

## VAIHE 2 — Näkymien sisältö
9. Asukas: pelastussuunnitelma + ohjeet + palovaroitin-nappi (resetointi 1–2×/v). Kuittaus tietokantaan.
10. Huolto (PIN-suojattu, piilossa asukkailta): piirustukset (rakenne/julkisivu/viemäri/sähkö) + hyväksytyt urakoitsijat.
11. Laite/tarkastus: laitetiedot, merkitse tarkastetuksi, valokuva, vikailmoitus. Muistuta että virallinen tarkastus tehdään pöytäkirjalla, ei pelkällä napilla.
12. Aula: rakennustason tiedot.

## VAIHE 3 — Moduulin eriytys Servalossa
13. Pidä QR-koodi omana JS-osiona, omana valikkokohtana, omina tauluina. Linkitys vain `kohde_id`:llä.
14. Ominaisuuskytkin `qr_kaytossa` per kohde/firma.
15. Varmista ettei QR vie huomiota pöytäkirjaraportoinnista (prio 1).

## VAIHE 4 — ohje24.fi-kytkentä (viimeisenä)
16. Osoita ohje24.fi Railwayn palveluun (DNS). Host-reititys on jo valmis.
17. Testaa: `ohje24.fi/<koodi>` → oikea yksittäinen näkymä.

---

**Tärkeä järjestys:** Vaihe 0 (tietokanta) ensin. Ilman sitä muut vaiheet eivät toimi oikeasti. ohje24.fi kytketään vasta lopuksi.
