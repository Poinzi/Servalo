# Claude Code -prompti: suodatin- ja kamerakuvakkeet uusiksi (kaikki työkalurivit)

Aja **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

Mitä tämä tekee (poistaa IDR:n kanssa identtisen suppilokuvakkeen):
1. **Suodata-napit** (Laitteet + Raportit): vanha suppilo → oma **liukusäädin-kuvake**.
2. **Tallennetut näkymät -napit**: käyttivät samaa suppiloa (harhaanjohtava) → oma **kirjanmerkki-kuvake**.
3. **Skannaa-napit** (työkalurivi + kirjautumisen QR-syöttö): 📷-emoji → oma **QR-tähtäin-kuvake**.

Kaikki ovat inline-SVG (valkoinen kuvake, currentColor), eivät vaadi kuvatiedostoa.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/ikonit_patch.py <<'PYEOF'
import io, sys

f = "servalo.html"
s = io.open(f, encoding="utf-8").read()
orig = s

def rep(old, new, n):
    global s
    c = s.count(old)
    if c != n:
        print("VIRHE: ankkuria loytyi %d kpl (odotettu %d):\n  %s" % (c, n, old[:110]))
        sys.exit(1)
    s = s.replace(old, new)

FUN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4.5h18a1 1 0 0 1 .8 1.6L15 14v5.2a1 1 0 0 1-1.45.9l-3-1.5A1 1 0 0 1 10 17.7V14L2.2 6.1A1 1 0 0 1 3 4.5z"/></svg>'

# liukusaadin (suodata)
SLID = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2.3" fill="currentColor"/><circle cx="15" cy="12" r="2.3" fill="currentColor"/><circle cx="8" cy="17" r="2.3" fill="currentColor"/></svg>'

# kirjanmerkki (tallennetut nakymat)
BOOK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z"/></svg>'

# QR-tahtain (skannaa)
QR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5.5a1.5 1.5 0 0 1 1.5-1.5H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>'

pre = '\n              '  # rivinvaihto + 14 valia svg:n edessa

# ---- Laitteet: Suodata ----
rep('id="btnFilter" title="Suodata" onclick="openFilter()">' + pre + FUN,
    'id="btnFilter" title="Suodata" onclick="openFilter()">' + pre + SLID, 1)

# ---- Laitteet: Tallennetut nakymat ----
rep('id="btnViews" title="Tallennetut näkymät" onclick="openViews()">' + pre + FUN,
    'id="btnViews" title="Tallennetut näkymät" onclick="openViews()">' + pre + BOOK, 1)

# ---- Raportit: Suodata ----
rep('id="btnRepFilter" title="Suodata" onclick="openRepFilter()">' + pre + FUN,
    'id="btnRepFilter" title="Suodata" onclick="openRepFilter()">' + pre + SLID, 1)

# ---- Raportit: Tallennetut nakymat ----
rep('id="btnRepViews" title="Tallennetut näkymät" onclick="openViews()">' + pre + FUN,
    'id="btnRepViews" title="Tallennetut näkymät" onclick="openViews()">' + pre + BOOK, 1)

# ---- Laitteet: Skannaa (kamera) ----
rep('id="btnScan" title="Skannaa QR-koodi kameralla" onclick="openScan()">\U0001F4F7</button>',
    'id="btnScan" title="Skannaa QR-koodi kameralla" onclick="openScan()">' + QR + '</button>', 1)

# ---- Kirjautuminen / koodisyotto: Skannaa ----
rep('onclick="scanCode()">\U0001F4F7 Skannaa</button>',
    'onclick="scanCode()">' + QR + ' Skannaa</button>', 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/ikonit_patch.py

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

echo "--- Vanha suppilo poistettu kokonaan ---"
if grep -q "M3 4.5h18a1 1 0 0 1 .8 1.6L15 14" servalo.html; then
  echo "VIRHE: vanha suppilo jäi."; exit 1
else echo "Suppilo poistettu."; fi

echo "--- Uudet kuvakkeet läsnä ---"
for t in "M4 7h16M4 12h16M4 17h16" "M6 3h12a1 1 0 0 1 1 1v17" "M4 8V5.5a1.5"; do
  grep -q "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Skannauskamera-emoji poistettu napeista ---"
if grep -qE 'openScan\(\)">📷|scanCode\(\)">📷'  servalo.html; then
  echo "VIRHE: kamera-emoji jäi nappiin."; exit 1
else echo "Skannausnapit vaihdettu."; fi

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Kuvakkeet uusiksi: suodatin (liukusaadin), nakymat (kirjanmerkki), skannaus (QR-tahtain)"
git push origin main
echo "VALMIS."
```

---

## Huom
- Vanha suppilokuvake oli tavuilleen sama kuin IDR:ssä — se on nyt poistettu **kaikkialta**
  (Laitteet- ja Raportit-työkalurivit, molemmat Suodata- ja Näkymät-napit).
- Skannauspainikkeen 📷-emoji vaihtui **QR-tähtäimeksi**, joka kuvaa toimintoa paremmin.
- Sisäiset "tarkastuspöytäkirjan kuva" -kohdat (valokuvan liite) jätettiin ennalleen — ne
  ovat aitoa valokuvatoimintoa, eivät suodatin/skannaus-kuvakkeita.
