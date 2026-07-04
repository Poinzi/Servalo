# Claude Code -prompti: Savuks-logo (liekki-ikoni) raporttien otsikkoon

Aja **Servalo-repon juuressa**. Lisää **liekki-ikoni "SAVUKS"-tekstin viereen** kaikkien
pöytäkirjojen/raporttien otsikkoon (12 kpl). Liekki on **inline-SVG** brändin punaisella
(`#c1121f`) — toimii raportin omassa `window.open`-ikkunassa, skaalautuu ja tulostuu terävänä
(ei riippuvuutta erillisestä kuvatiedostosta). Teksti "SAVUKS" ja "Paloturvallisuuspalvelut"
säilyvät ennallaan.

> Miksi SVG eikä `assets/savuks-logo.png`: raportit avautuvat uuteen `about:blank`-ikkunaan,
> jossa suhteellinen kuvapolku ei lataudu. Lisäksi nykyinen PNG on valkoisella tekstillä →
> näkymätön valkoisella raporttipohjalla. Inline-SVG korjaa molemmat.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF '<div class="brand">SAVUKS</div>' servalo.html || { echo "VIRHE: raporttien brand-otsikkoa ei löytynyt."; exit 1; }
grep -qF 'M8 16c3.314' servalo.html && { echo "Jo asennettu (liekki-ikoni) — keskeytetään."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/logo_patch.py <<'PYEOF'
import io, sys

f = "servalo.html"
s = io.open(f, encoding="utf-8").read()
orig = s

FLAME = ('<svg viewBox="0 0 16 16" width="30" height="30" fill="#c1121f" '
         'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
         '<path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0'
         'c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16m0-1c-1.657 0-3-1-3-2.75 0-.75'
         '.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 '
         '1.364 1 2.25C11 14 9.657 15 8 15"/></svg>')

old = '<div class="brand">SAVUKS</div>'
new = '<div style="display:flex;align-items:center;gap:8px">' + FLAME + '<div class="brand">SAVUKS</div></div>'

n = s.count(old)
if n != 12:
    print("VIRHE: brand-ankkuria loytyi %d kpl (odotettu 12)." % n); sys.exit(1)
s = s.replace(old, new)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK. Korvattu 12 otsikkoa.")
PYEOF

python3 /tmp/logo_patch.py

echo "--- JS-syntaksin validointi ---"
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
for t in 'M8 16c3.314' 'display:flex;align-items:center;gap:8px' 'aria-hidden="true"'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done
echo -n "Liekki-ikonien määrä: "; grep -oF 'M8 16c3.314' servalo.html | wc -l

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Raporttien otsikko: liekki-ikoni SAVUKS-tekstin viereen (inline SVG)"
git push origin main
echo "VALMIS."
```

---

## Miten näyttää
- Jokaisen raportin ylävasemmalla lukee nyt: **🔥 SAVUKS** (punainen liekki + punainen teksti)
  ja alla "Paloturvallisuuspalvelut" — kuten lataamassasi logossa.

## Huom
- Liekki on brändin punainen `#c1121f` (sama kuin otsikkoteksti ja alaviiva). Jos haluat
  mustan liekin (kuten latauksessasi), vaihda patchissa `fill="#c1121f"` → `fill="#141414"`.
- Koskee vain raporttien otsikoita. Sovelluksen oma ylätunniste (`assets/savuks-logo.png`)
  säilyy ennallaan — tehdään erikseen jos halutaan.
- Ei kosketa dataan eikä pöytäkirjojen sisältöön.
