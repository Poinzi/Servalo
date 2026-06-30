# Servalo – Railway-deploy

Tämä kansio sisältää valmiin paketin, jolla Servalo-sovelluksen saa Railwayhin.
Palvelin on nolla-riippuvuus Node-staattispalvelin – ei `npm install` -vaihetta, build on nopea ja varma.

## Mitä kansiossa on
- `servalo.html` – itse sovellus
- `server.js` – kevyt Node-palvelin (tarjoilee servalo.html:n)
- `package.json` – start-komento (`node server.js`)
- `railway.json` – Railwayn build/deploy-asetukset
- `.gitignore`

---

## Vaihtoehto A: GitHub-repo (suositeltu)

Automaattinen deploy: aina kun pushaat muutoksen, Railway päivittää sovelluksen.

1. Luo uusi tyhjä repo GitHubissa (esim. `servalo`).
2. Vie tämän kansion sisältö repoon:
   ```bash
   cd servalo-railway
   git init
   git add .
   git commit -m "Servalo ensimmäinen versio"
   git branch -M main
   git remote add origin https://github.com/KAYTTAJA/servalo.git
   git push -u origin main
   ```
3. Mene Railwayhin → **New Project** → **Deploy from GitHub repo** → valitse `servalo`-repo.
4. Railway tunnistaa Node-projektin ja käynnistää automaattisesti. Odota että build valmistuu.
5. **Settings → Networking → Generate Domain** → saat julkisen osoitteen (esim. `servalo-production.up.railway.app`).

Valmista. Poinzi pysyy omana projektinaan – tämä on erillinen projekti samalla tilillä.

---

## Vaihtoehto B: Railway CLI (ei GitHubia)

1. Asenna CLI ja kirjaudu:
   ```bash
   npm i -g @railway/cli
   railway login
   ```
2. Tässä kansiossa:
   ```bash
   cd servalo-railway
   railway init        # luo uuden projektin
   railway up          # deploy
   railway domain      # luo julkinen osoite
   ```

---

## Paikallinen testaus ennen deployta
```bash
cd servalo-railway
node server.js
# avaa selaimessa http://localhost:3000
```

---

## TÄRKEÄÄ: datan tallennus

Tämä versio tallentaa kaiken **käyttäjän oman selaimen localStorageen**. Se tarkoittaa:
- Data ei jaakaannu laitteiden tai käyttäjien välillä.
- Kuvat ja raportit eivät säily palvelimella.
- Selaimen tyhjennys poistaa datan.

Tämä riittää demoon ja esittelyyn. Jos haluat oikeasti **kerätä kuvia ja raportteja**
useammalta käyttäjältä, tarvitaan tietokanta + tiedostotallennus (vaihe 2).
Suositus: Postgres (Railwayssa napilla) tai Supabase. Kysy minulta kun olet valmis siihen.
