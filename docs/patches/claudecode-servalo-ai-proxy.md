# Claude Code -prompti: AI-avain palvelimelle (proxy) — koko yritykselle automaattisesti

Aja **Servalo-repon juuressa**. Siirtää Anthropic-avaimen **selaimesta palvelimelle**:
avain elää vain Railwayssa ympäristömuuttujana `ANTHROPIC_API_KEY`. Sovellus kutsuu
**omaa `/api/analyze`-reittiä**, joka välittää kuvat Anthropicille palvelimen puolelta.
Käyttäjät **eivät koskaan syötä eivätkä näe avainta** — sama avain toimii kaikilla
yrityksen kirjautuneilla käyttäjillä. Oletusmalli **Haiku** (halvin), server pakottaa.

> Tekee saman kuvion kuin olemassa oleva YTJ-proxy: palvelin hoitaa ulkoisen kutsun,
> jolloin selaimen ei tarvitse tuntea avainta. Toimii sekä ennen että jälkeen
> Haiku/mallivalinta-patchin (jos mallivalinta on jo lisätty, se säilyy).

---

## ENNEN AJOA: aseta avain Railwayhin

1. Railway → projekti **servalo** → service **servalo** → välilehti **Variables**
2. **New Variable** → nimi `ANTHROPIC_API_KEY`, arvo `sk-ant-api03-...` (uusi avaimesi)
3. Tallenna. Railway deployaa uudelleen automaattisesti.

> Käytä **uutta** avainta. Aiemmin chattiin liimattu avain on paljastunut — poista se
> console.anthropic.com → API keys → Delete, ja luo tilalle uusi.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
test -f server.js   || { echo "VIRHE: server.js ei löydy."; exit 1; }
grep -qF 'return api.handle(req, res);' server.js || { echo "VIRHE: server.js:n api-reititystä ei löytynyt."; exit 1; }
grep -qF 'api.anthropic.com/v1/messages' servalo.html || { echo "VIRHE: aiFillFromPhoto-fetchiä ei löytynyt — aja ensin AI-autofill-patch."; exit 1; }
grep -qF '/api/analyze' server.js && { echo "Jo asennettu (/api/analyze) — keskeytetään."; exit 1; }
cp server.js server.js.bak
cp servalo.html servalo.html.bak

cat > /tmp/ai_proxy_patch.py <<'PYEOF'
import io, sys

def patch(fn, edits):
    s = io.open(fn, encoding="utf-8").read()
    orig = s
    for old, new, n, opt in edits:
        c = s.count(old)
        if opt and c == 0:
            continue
        if c != n:
            print("VIRHE (%s): ankkuria loytyi %d kpl (odotettu %d):\n  %s" % (fn, c, n, old[:90]))
            sys.exit(1)
        s = s.replace(old, new)
    if s == orig:
        print("VIRHE: %s ei muuttunut." % fn); sys.exit(1)
    io.open(fn, "w", encoding="utf-8").write(s)
    print("Patch OK: %s" % fn)

# ---------- server.js: lisaa /api/analyze -proxy ennen QR-API-reititysta ----------
ANALYZE = (
'  // Anthropic-proxy: AI-kuva-analyysi. Avain vain palvelimella (ANTHROPIC_API_KEY),\n'
'  // oletusmalli Haiku. Kevyt suoja: vaatii X-User-Id-otsakkeen (sovellus lahettaa sen).\n'
'  if (req.url.startsWith("/api/analyze")) {\n'
'    const jt = { "Content-Type": "application/json; charset=utf-8" };\n'
'    if (req.method !== "POST") { res.writeHead(405, jt); return res.end(JSON.stringify({ error: "POST vaaditaan" })); }\n'
'    if (!String(req.headers["x-user-id"] || "").trim()) { res.writeHead(401, jt); return res.end(JSON.stringify({ error: "kirjautuminen vaaditaan" })); }\n'
'    const aiKey = process.env.ANTHROPIC_API_KEY;\n'
'    if (!aiKey) { res.writeHead(503, jt); return res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY puuttuu palvelimelta" })); }\n'
'    let raw = "";\n'
'    req.on("data", (c) => { raw += c; if (raw.length > 8 * 1024 * 1024) req.destroy(); });\n'
'    req.on("end", () => {\n'
'      let body;\n'
'      try { body = JSON.parse(raw || "{}"); } catch (e) { res.writeHead(400, jt); return res.end(JSON.stringify({ error: "virheellinen JSON" })); }\n'
'      const ALLOWED = new Set(["claude-haiku-4-5", "claude-sonnet-4-6"]);\n'
'      const model = ALLOWED.has(body.model) ? body.model : "claude-haiku-4-5";\n'
'      const content = Array.isArray(body.content) ? body.content : null;\n'
'      if (!content) { res.writeHead(400, jt); return res.end(JSON.stringify({ error: "content vaaditaan" })); }\n'
'      fetch("https://api.anthropic.com/v1/messages", {\n'
'        method: "POST",\n'
'        headers: { "content-type": "application/json", "x-api-key": aiKey, "anthropic-version": "2023-06-01" },\n'
'        body: JSON.stringify({ model: model, max_tokens: 400, messages: [{ role: "user", content: content }] }),\n'
'      })\n'
'        .then((r) => r.text().then((t) => { res.writeHead(r.status, jt); res.end(t); }))\n'
'        .catch((err) => { res.writeHead(502, jt); res.end(JSON.stringify({ error: "AI-kutsu epaonnistui", detail: String(err) })); });\n'
'    });\n'
'    return;\n'
'  }\n'
'\n'
)
SRV_OLD = ('  // Servalon oma QR-API (kaikki muu /api/* paitsi YTJ-proxy).\n'
           '  if (req.url.startsWith("/api/") && !req.url.startsWith("/api/ytj")) {\n'
           '    return api.handle(req, res);\n'
           '  }')
patch("server.js", [(SRV_OLD, ANALYZE + SRV_OLD, 1, False)])

# ---------- servalo.html: rewire selain kutsumaan proxya, poista avainkentta ----------
KEY_FIELD_OLD = ('        <div class="field" style="margin-bottom:6px"><label>Anthropic API-avain '
                 '<span class="hint">(tallentuu vain tähän selaimeen)</span></label>'
                 '<input class="f" id="aiKey" type="password" placeholder="sk-ant-..."></div>')
KEY_FIELD_NEW = ('        <div class="hint" id="aiKeyInfo" style="margin-bottom:6px;color:#1a7f37">'
                 '✓ Tekoäly käytössä koko yritykselle (avain palvelimella).</div>')

KEYBLOCK_OLD = ('  var keyEl=document.getElementById("aiKey");\n'
                '  var key=((keyEl&&keyEl.value)||"").trim();\n'
                '  if(!key){aiSetStatus("Anna API-avain.","#c1121f");return;}\n'
                '  localStorage.setItem(AI_KEY_LS,key);')
KEYBLOCK_NEW = '  // AI-avain on palvelimella (proxy /api/analyze) - ei syotetta selaimessa.'

FETCH_OLD = ('    var resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",'
             'headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01",'
             '"anthropic-dangerous-direct-browser-access":"true"},'
             'body:JSON.stringify({model:aiModel(),max_tokens:400,messages:[{role:"user",content:content}]})});')
FETCH_NEW = ('    var resp=await fetch("/api/analyze",{method:"POST",'
             'headers:{"Content-Type":"application/json","X-User-Id":(currentUser&&currentUser.id)||"kentta"},'
             'body:JSON.stringify({model:aiModel(),content:content})});')

MODEL_OLD = 'function aiModel(){return localStorage.getItem(AI_MODEL_LS)||"claude-sonnet-4-6";}'
MODEL_NEW = 'function aiModel(){return localStorage.getItem(AI_MODEL_LS)||"claude-haiku-4-5";}'

patch("servalo.html", [
    (KEY_FIELD_OLD, KEY_FIELD_NEW, 1, False),
    (KEYBLOCK_OLD,  KEYBLOCK_NEW,  1, False),
    (FETCH_OLD,     FETCH_NEW,     1, False),
    (MODEL_OLD,     MODEL_NEW,     1, True),   # ohitetaan jos malli jo Haiku
])
PYEOF

python3 /tmp/ai_proxy_patch.py

echo "--- server.js syntaksin validointi ---"
node --check server.js && echo "server.js OK"

echo "--- servalo.html JS-syntaksin validointi ---"
node -e '
const fs=require("fs");
const h=fs.readFileSync("servalo.html","utf8");
const re=/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g;
let m,i=0,ok=true;
while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){ok=false;console.log("Script-lohko "+i+" FAIL: "+e.message);}}
console.log(ok?("JS OK ("+i+" lohkoa)"):"JS FAILED");
process.exit(ok?0:1);
'

echo "--- Uudet palaset läsnä ---"
for t in '/api/analyze' 'ANTHROPIC_API_KEY' 'claude-haiku-4-5'; do
  grep -qF "$t" server.js && echo "OK server.js: $t" || true
done
grep -qF '"/api/analyze"' servalo.html && echo "OK servalo.html: proxy-fetch" || { echo "PUUTTUU: proxy-fetch"; exit 1; }
grep -qF 'id="aiKey"' servalo.html && { echo "VIRHE: avainkenttä jäi jäljelle."; exit 1; } || echo "OK: avainkenttä poistettu"

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html server.js; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f server.js.bak servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "AI: siirrä Anthropic-avain palvelimelle (/api/analyze -proxy), Haiku oletus"
git push origin main
echo "VALMIS."
```

---

## Miten toimii
- Avain on **vain Railwayssa** (`ANTHROPIC_API_KEY`). Kukaan käyttäjä ei syötä sitä.
- AI-paneelista poistuu API-avain-kenttä; tilalla lukee "✓ Tekoäly käytössä koko yritykselle".
- Kuvat menevät sovelluksen omaan `/api/analyze`-reittiin → palvelin lisää avaimen ja
  välittää Anthropicille. Oletusmalli **Haiku**; palvelin sallii vain Haiku/Sonnet.
- Kevyt suoja: reitti vaatii `X-User-Id`-otsakkeen, jonka sovellus lähettää kirjautuneena.

## Huom
- **Aseta `ANTHROPIC_API_KEY` Railwayhin ennen ajoa**, muuten `/api/analyze` palauttaa 503.
- Jos ajoit aiemmin mallivalinta-patchin (Haiku/Sonnet-pudotusvalikko), se säilyy — voit
  yhä valita Sonnetin vaikeaa kuvaa varten. Muuten oletus on Haiku.
- Ei kosketa dataan eikä pöytäkirjoihin.
