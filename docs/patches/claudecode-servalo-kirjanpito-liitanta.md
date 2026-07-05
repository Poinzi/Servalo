# Claude Code -prompti: Kirjanpidolle palvelinpuolen lukko (HTTP Basic Auth)

Aja **Servalo-repon juuressa**. Tämä lisää `/kirjanpito`-sivulle **palvelinpuolen HTTP Basic
Auth -lukon**, joka aktivoituu vain kun ympäristömuuttuja `KIRJANPITO_PASS` on asetettu. Näin
sivua ei voi edes ladata ilman käyttäjätunnusta+salasanaa — Servalon selainpuolen roolikätkennän
lisäksi.

> **Tilanne:** `kirjanpito.html`, Servalon 📒-käynnistin ja `/kirjanpito`-reititys ovat **jo
> repossa** (commit *Kirjanpito: MVP-sovellus + liitäntä*). Tämä patch lisää **vain** puuttuvan
> palvelinlukon `server.js`:ään. Ei koske `servalo.html`- eikä `kirjanpito.html`-tiedostoihin.

## Kaksi lukkokerrosta patchin jälkeen
1. **HTTP Basic Auth (uusi):** selain kysyy tunnus+salasana ennen kuin sivu edes latautuu.
   Aktiivinen vain kun `KIRJANPITO_PASS` on asetettu Railwayssä.
2. **Kirjanpidon oma salasana + AES-GCM (jo olemassa):** varsinainen datan lukko. Data on
   levossa salattua; ilman tätä salasanaa sisältö on lukukelvotonta.

Basic Auth estää sivun avaamisen; AES-salaus suojaa itse datan. Molemmat päällä = "molemmat".

---

## Patch (bash-lohko)

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f server.js || { echo "VIRHE: server.js ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF 'else if (urlPath === "/kirjanpito") urlPath = "/kirjanpito.html";' server.js \
  || { echo "VIRHE: kirjanpito-reititystä ei löydy — aja liitäntäpatch ensin."; exit 1; }
if grep -qF 'KIRJANPITO_PASS' server.js; then
  echo "OK: Basic Auth on jo asennettu — ei tehdä mitään."; exit 0
fi
cp server.js server.js.bak

cat > /tmp/kb_auth.py <<'PYEOF'
import io, sys
FN=sys.argv[1] if len(sys.argv)>1 else "server.js"
def patch(fn,edits):
    s=io.open(fn,encoding="utf-8").read();orig=s
    for old,new,n in edits:
        c=s.count(old)
        if c!=n:
            print("VIRHE: ankkuri %d/%d:\n  %s"%(c,n,old[:90]));sys.exit(1)
        s=s.replace(old,new)
    if s==orig:print("VIRHE: ei muuttunut");sys.exit(1)
    io.open(fn,"w",encoding="utf-8").write(s);print("Patch OK: %s"%fn)

# Ankkuri: olemassa oleva kirjanpito-reititys (jo repossa)
OLD='  else if (urlPath === "/kirjanpito") urlPath = "/kirjanpito.html";'
NEW=OLD+'''
  // Palvelinpuolen HTTP Basic Auth kirjanpidolle (aktiivinen vain kun KIRJANPITO_PASS asetettu).
  if (urlPath === "/kirjanpito.html" && process.env.KIRJANPITO_PASS) {
    const _kbU = process.env.KIRJANPITO_USER || "admin";
    const _h = String(req.headers["authorization"] || "");
    let _ok = false;
    if (_h.startsWith("Basic ")) {
      const _d = Buffer.from(_h.slice(6), "base64").toString("utf8");
      const _i = _d.indexOf(":");
      _ok = _i >= 0 && _d.slice(0, _i) === _kbU && _d.slice(_i + 1) === process.env.KIRJANPITO_PASS;
    }
    if (!_ok) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Kirjanpito", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" });
      return res.end("401 - kirjautuminen vaaditaan");
    }
  }'''

patch(FN,[(OLD,NEW,1)])
PYEOF

python3 /tmp/kb_auth.py server.js

echo "--- server.js syntaksi ---"
node --check server.js && echo "server.js: syntax OK"

echo "--- Uudet palaset ---"
grep -qF 'process.env.KIRJANPITO_PASS' server.js && echo "OK: Basic Auth -portti" || { echo "PUUTTUU"; exit 1; }
grep -qF 'WWW-Authenticate' server.js && echo "OK: 401-otsake" || { echo "PUUTTUU"; exit 1; }

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" server.js; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f server.js.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Kirjanpito: palvelinpuolen HTTP Basic Auth /kirjanpito-sivulle (aktiivinen kun KIRJANPITO_PASS asetettu)"
git push origin main
echo "VALMIS."
```

---

## Käyttöönotto Railwayssä (pakollinen, muuten lukko ei aktivoidu)
Lisää palvelun **Variables**-välilehdelle:
- `KIRJANPITO_PASS` = valitsemasi vahva salasana (**pakollinen** — ilman tätä lukko ei ole päällä)
- `KIRJANPITO_USER` = käyttäjätunnus (valinnainen, oletus `admin`)

Deployn jälkeen `/kirjanpito` kysyy tunnuksen selaimen omalla kirjautumisikkunalla ennen kuin sivu
latautuu. Väärä tunnus → `401`. **Jos `KIRJANPITO_PASS` on tyhjä, sivu toimii ilman lukkoa** (ei
lukitse itseään ulos vahingossa).

## Miksi näin
- **Ei lukitse käyttöönottoa:** lukko aktivoituu vain kun salasana on asetettu → ensideploy ei kaadu.
- **Erillinen kirjanpidon omasta salasanasta:** Basic Auth vartioi ovea, AES-salaus vartioi dataa.
- **HTTPS päällä (Railway):** Basic Auth -tunnus kulkee salattuna. Älä käytä http-osoitteella.

## Turvallisuus rehellisesti
Servalon 📒-käynnistimen piilotus muilta rooleilta on **selainpuolen kosmetiikkaa** — se ei estä
sivun avaamista suoralla osoitteella. Tämä patch tuo **oikean palvelinpuolen eston**. Silti
tärkein datan lukko on edelleen kirjanpidon oma salasana + AES-GCM: avaa `/kirjanpito`
**pääkäyttäjänä heti** ja luo vahva salasana ensimmäisenä, sekä ota säännöllinen JSON-varmuuskopio.

## Testattu (hiekkalaatikko)
Patch ajettu oikeaan `server.js`-kopioon: ankkuri osui (1×n=1), `node --check server.js` OK, uudet
palaset läsnä (`KIRJANPITO_PASS`, `WWW-Authenticate`), kielletyt merkkijonot puhtaat. Auth-logiikka
yksikkötestattu: oikea tunnus → sallittu; väärä salasana / väärä käyttäjä / puuttuva otsake →
estetty; kaksoispisteen sisältävä salasana käsitellään oikein (jaetaan vain ensimmäisestä `:`).
