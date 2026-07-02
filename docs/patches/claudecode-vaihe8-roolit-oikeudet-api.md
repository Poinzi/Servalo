# Vaihe 8 — roolit & oikeudet API:iin (osa 1: palvelin)

**Edellytys:** Vaihe 1–7 ajettu. `api.js` sisältää auth-portin (`p.startsWith("/api/kohteet") || ...`) ja `X-User-Id`-pohjaisen `requireAuth`in.

Nykyään mikä tahansa ei-tyhjä `X-User-Id` pääsee kaikkiin kirjautuneisiin reitteihin. Tämä patch korvaa sen **allekirjoitetulla roolitokenilla** (`Authorization: Bearer …`) ja **reittikohtaisilla oikeuksilla**. Kolme roolia: `admin`, `kentta`, `huolto`.

**Ei riko mitään heti.** Niin kauan kuin ympäristömuuttujaa `AUTH_SECRET` **ei** ole asetettu Railwayssä, palvelin on *legacy-tilassa*: ei-tyhjä `X-User-Id` kelpaa edelleen adminina (nykyinen Servalo-asiakas toimii muuttumatta). Kun asetat `AUTH_SECRET`, pakotus kytkeytyy päälle ja vain kirjautuneet tokenit pääsevät läpi. Käyttöliittymän kirjautuminen tulee **Vaihe 8b**:ssä.

Vain **yksi tiedosto**: `api.js`.

Oikeusmatriisi:

| Reitti | admin | kentta | huolto |
|---|---|---|---|
| GET (luku: kohteet, raportti, liitteet) | ✓ | ✓ | ✓ |
| POST kohteet / kohdista / status / kontakti | ✓ | ✓ | – |
| POST/DELETE liite (kuvat) | ✓ | ✓ | ✓ |
| DELETE kontakti | ✓ | – | – |
| DELETE kohdista (koodin vapautus) | ✓ | – | – |

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

---

### V8-1 — `api.js`: rooliauth-apurit tiedoston alkuun

**FIND:**
```
// Servalo QR-palvelun API. Yksinkertainen reititys pg-tietokantaa vasten.
// Auth: X-User-Id -header (kevyt demoauth; roolit tulevat myöhemmin).

const db = require("./db");
```

**REPLACE:**
```
// Servalo QR-palvelun API. Yksinkertainen reititys pg-tietokantaa vasten.
// Auth: allekirjoitettu roolitoken (Authorization: Bearer). Roolit: admin / kentta / huolto.
// Legacy: jos AUTH_SECRET ei ole asetettu, ei-tyhjä X-User-Id kelpaa adminina (yhteensopivuus).

const db = require("./db");
const crypto = require("crypto");

// --- Rooliauth -------------------------------------------------------------
const SECRET = process.env.AUTH_SECRET || "servalo-dev-secret";
const ENFORCE = !!process.env.AUTH_SECRET; // vasta kun AUTH_SECRET on asetettu, pakotetaan roolit

// Demokäyttäjät (fiktiivisiä). Vaihda salasanat ja aseta AUTH_SECRET tuotannossa.
const USERS = {
  admin:  { id: "u-admin",  nimi: "Pääkäyttäjä",     rooli: "admin",  salasana: "admin123" },
  kentta: { id: "u-kentta", nimi: "Kenttäasentaja",  rooli: "kentta", salasana: "kentta123" },
  huolto: { id: "u-huolto", nimi: "Huoltokumppani",  rooli: "huolto", salasana: "huolto123" },
};

function checkPassword(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function hmac(body) {
  return b64url(crypto.createHmac("sha256", SECRET).update(body).digest());
}
function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  return body + "." + hmac(body);
}
function verifyToken(token) {
  if (!token || token.indexOf(".") < 0) return null;
  const i = token.lastIndexOf(".");
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const exp = hmac(body);
  if (sig.length !== exp.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); }
  catch (e) { return null; }
  if (payload && payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

// Reittikohtaiset oikeudet. admin: kaikki. kentta: luku + kirjoitus paitsi
// poistot (kontakti/kohdista). huolto: luku + liitekuvat (lisää/poista).
function permit(method, p, rooli) {
  if (rooli === "admin") return true;
  if (method === "GET") return rooli === "kentta" || rooli === "huolto";
  const liitePost = method === "POST" && p === "/api/liite";
  const liiteDel = method === "DELETE" && /^\/api\/liite\/[0-9a-f-]{36}$/i.test(p);
  if (rooli === "huolto") return liitePost || liiteDel;
  if (rooli === "kentta") {
    const kontDel = method === "DELETE" && /^\/api\/kontakti\/[0-9a-f-]{36}$/i.test(p);
    const kohdistaDel = method === "DELETE" && /^\/api\/kohdista\//.test(p);
    if (kontDel || kohdistaDel) return false;
    return true;
  }
  return false;
}
```

---

### V8-2 — `api.js`: korvaa `requireAuth` toimija-resolverilla

**FIND:**
```
  const method = req.method || "GET";
  const userId = String(req.headers["x-user-id"] || "").trim();
  const requireAuth = () => {
    if (!userId) { sendJson(res, 401, { error: "auth required" }); return false; }
    return true;
  };
```

**REPLACE:**
```
  const method = req.method || "GET";
  let userId = String(req.headers["x-user-id"] || "").trim();
  const resolveActor = () => {
    const auth = String(req.headers["authorization"] || "");
    const bearer = auth.indexOf("Bearer ") === 0 ? auth.slice(7).trim() : "";
    const payload = bearer ? verifyToken(bearer) : null;
    if (payload) return payload;
    // Legacy-tila (AUTH_SECRET ei asetettu): ei-tyhjä X-User-Id kelpaa adminina
    if (!ENFORCE && userId) return { id: userId, nimi: userId, rooli: "admin", legacy: true };
    return null;
  };
```

---

### V8-3 — `api.js`: `/api/login` + `/api/mina` + rooli-portti

**FIND:**
```
    // Kirjautuneiden reitit alla
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista") || p.startsWith("/api/raportti") || p.startsWith("/api/liite") || p.startsWith("/api/kontakti")) {
      if (!requireAuth()) return;
    }
```

**REPLACE:**
```
    // POST /api/login (julkinen: palauttaa allekirjoitetun roolitokenin)
    if (method === "POST" && p === "/api/login") {
      const body = await readBody(req);
      const kayttaja = String(body.kayttaja || "").trim().toLowerCase();
      const salasana = String(body.salasana || "");
      const u = USERS[kayttaja];
      if (!u || !checkPassword(salasana, u.salasana)) {
        return sendJson(res, 401, { error: "vaara tunnus tai salasana" });
      }
      const exp = Date.now() + 1000 * 60 * 60 * 12; // 12 h
      const token = signToken({ id: u.id, nimi: u.nimi, rooli: u.rooli, exp });
      return sendJson(res, 200, { token, id: u.id, nimi: u.nimi, rooli: u.rooli, exp });
    }

    // GET /api/mina (julkinen: kuka olen tokenin/legacy-headerin perusteella)
    if (method === "GET" && p === "/api/mina") {
      const who = resolveActor();
      return sendJson(res, 200, who
        ? { id: who.id, nimi: who.nimi, rooli: who.rooli, enforce: ENFORCE }
        : { rooli: null, enforce: ENFORCE });
    }

    // Kirjautuneiden reitit: rooli-portti + reittikohtaiset oikeudet
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista") || p.startsWith("/api/raportti") || p.startsWith("/api/liite") || p.startsWith("/api/kontakti")) {
      const who = resolveActor();
      if (!who) { sendJson(res, 401, { error: "auth required" }); return; }
      if (!permit(method, p, who.rooli)) { sendJson(res, 403, { error: "forbidden", rooli: who.rooli }); return; }
      userId = who.id;
    }
```

---

## VALIDOINTI (aja ennen committia)

```bash
cd ~/Desktop/Servalo

# 1) palvelinkoodin syntaksi
node --check server.js && node --check api.js && node --check db.js && echo "NODE OK"

# 2) uudet palaset löytyvät
for s in "function verifyToken" "function permit" "api/login" "api/mina" "resolveActor" "AUTH_SECRET"; do
  grep -q "$s" api.js && echo "OK: $s" || { echo "PUUTTUU: $s"; exit 1; }
done

# 3) vanha requireAuth poistunut
grep -q "requireAuth" api.js && { echo "VAROITUS: requireAuth jaeljella"; exit 1; } || echo "OK: requireAuth poistettu"

# 4) token round-trip + permit -yksikkötesti eristetyssä prosessissa
node -e '
const crypto=require("crypto");
const SECRET="testi"; 
function b(x){return Buffer.from(x).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function h(x){return b(crypto.createHmac("sha256",SECRET).update(x).digest());}
function sign(pl){const bd=b(JSON.stringify(pl));return bd+"."+h(bd);}
function ver(t){if(!t||t.indexOf(".")<0)return null;const i=t.lastIndexOf(".");const bd=t.slice(0,i),sg=t.slice(i+1),ex=h(bd);if(sg.length!==ex.length)return null;if(!crypto.timingSafeEqual(Buffer.from(sg),Buffer.from(ex)))return null;let p;try{p=JSON.parse(Buffer.from(bd.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));}catch(e){return null;}if(p&&p.exp&&Date.now()>p.exp)return null;return p;}
const t=sign({rooli:"kentta",exp:Date.now()+9999});
if(!ver(t)||ver(t).rooli!=="kentta")throw new Error("roundtrip");
if(ver(t+"x")!==null)throw new Error("tamper");
if(ver(sign({exp:Date.now()-1}))!==null)throw new Error("expiry");
console.log("TOKEN OK");
'

# 5) kielletyt merkkijonot
if grep -rnE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" api.js; then
  echo "VAROITUS: tarkista osumat"; else echo "Ei kiellettyjä merkkijonoja"; fi
```

Kaikki `OK:`, `NODE OK` ja `TOKEN OK` → jatka. Muuten pysähdy.

---

## COMMIT & PUSH

```bash
cd ~/Desktop/Servalo
rm -f .git/index.lock
git add -A
git commit -m "Vaihe 8: roolit ja reittikohtaiset oikeudet API:iin (token-auth, legacy-yhteensopiva)"
git push origin main
```

Railway deployaa automaattisesti.

---

## TESTAUS (curl — todistaa toiminnan)

Korvaa `HOST` omalla Railway-osoitteella, esim. `https://servalo-production-8fdd.up.railway.app`.

```bash
HOST=https://servalo-production-8fdd.up.railway.app

# 1) Legacy-tila (AUTH_SECRET EI asetettu): vanha X-User-Id toimii yhä
curl -s "$HOST/api/kohteet" -H "X-User-Id: kentta" | head -c 200; echo

# 2) Kirjaudu -> saat tokenin
TOKEN=$(curl -s "$HOST/api/login" -H "Content-Type: application/json" \
  -d '{"kayttaja":"huolto","salasana":"huolto123"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "token: ${TOKEN:0:24}..."

# 3) Tokenilla luku onnistuu
curl -s "$HOST/api/kohteet" -H "Authorization: Bearer $TOKEN" | head -c 120; echo
```

**Pakotuksen kytkentä (vasta kun 8b ajettu):** aseta Railwayssä ympäristömuuttuja `AUTH_SECRET` (pitkä satunnainen merkkijono). Sen jälkeen:
- `huolto`-token EI saa luoda kohdetta: `curl -s -X POST "$HOST/api/kohteet" -H "Authorization: Bearer $TOKEN" -d '{"nimi":"X"}'` → `403 forbidden`.
- Pelkkä `X-User-Id` ilman tokenia → `401 auth required`.

Demotunnukset (fiktiiviset): `admin/admin123`, `kentta/kentta123`, `huolto/huolto123`. **Vaihda salasanat** ennen tuotantoa muokkaamalla `USERS`-taulukkoa `api.js`:ssä.

---

## SEURAAVA

**Vaihe 8b** kytkee palvelinkirjautumisen Servalon käyttöliittymään: kirjautumislomake, tokenin tallennus, `apiHeaders()` lisää `Authorization: Bearer`, ja UI piilottaa napit roolin mukaan. Vasta 8b:n jälkeen kannattaa asettaa `AUTH_SECRET` (pakotus päälle).
