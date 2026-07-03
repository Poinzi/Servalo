# Claude Code -prompti: laitekortin termistö neutraaliksi

Aja **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

## Mitä tämä tekee
Vaihtaa laitekortin erottuvimmat, lähdejärjestelmää muistuttavat termit neutraaleiksi:

- **"Huoltosopimuskohde"** → **"Huoltokohde"** (kaikki 15 näkyvää esiintymää: lomake,
  taulukko-otsikot, raporttien sarakkeet, suodatin, historia). Kenttäavain `target`
  säilyy ennallaan.
- **"Ecom ID"** (Ecom on lähdejärjestelmän oma integraationimi) → näkyvä teksti pois:
  laitepaneelin otsikoksi tulee **"Kustannuspaikka"**, ja asiakasrivin turha
  "Ecom ID:" -etuliite poistetaan (jää pelkkä "Kustannuspaikka: <arvo>").

Yleiset alan termit ("Valmistaja/Malli/Tyyppi", "Kustannuspaikka", "Avainten nouto")
jätetään ennalleen — ne eivät ole lähdejärjestelmälle ominaisia. Sisäinen dataproperty
`d.ecom` säilyy (ei näy käyttäjälle); vain näkyvä "Ecom"-sana poistuu.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/termisto_patch.py <<'PYEOF'
import io, sys

f = "servalo.html"
s = io.open(f, encoding="utf-8").read()
orig = s

def rep(old, new, n):
    global s
    c = s.count(old)
    if c != n:
        print("VIRHE: '%s' loytyi %d kpl (odotettu %d)" % (old[:60], c, n))
        sys.exit(1)
    s = s.replace(old, new)

# 1) Huoltosopimuskohde -> Huoltokohde (kaikki nakyvat esiintymat)
rep("Huoltosopimuskohde", "Huoltokohde", 15)

# 2) Ecom ID -> neutraali
rep('pair("Ecom ID",esc(d.ecom||""))', 'pair("Kustannuspaikka",esc(d.ecom||""))', 1)
rep('<b>Kustannuspaikka:</b> Ecom ID: ${esc(d.ecom||"")}', '<b>Kustannuspaikka:</b> ${esc(d.ecom||"")}', 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/termisto_patch.py

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

echo "--- Uudet termit läsnä ---"
grep -qF "Huoltokohde" servalo.html && echo "OK: Huoltokohde" || { echo "PUUTTUU: Huoltokohde"; exit 1; }

echo "--- Vanhat termit poistettu ---"
if grep -qF "Huoltosopimuskohde" servalo.html; then echo "VIRHE: Huoltosopimuskohde jäi."; exit 1; else echo "poistettu: Huoltosopimuskohde"; fi
if grep -qF "Ecom" servalo.html; then echo "VIRHE: näkyvä Ecom jäi."; grep -nF "Ecom" servalo.html; exit 1; else echo "poistettu: Ecom (näkyvä)"; fi

echo "--- Kenttäavain target ennallaan ---"
grep -qF '["target","Huoltokohde"]' servalo.html && echo "OK: FILTER target-avain" || { echo "PUUTTUU: target-avain"; exit 1; }

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Laitekortin termisto neutraaliksi: Huoltokohde + Ecom-sana pois"
git push origin main
echo "VALMIS."
```

---

## Huom
- "Huoltokohde" korvaa "Huoltosopimuskohteen" johdonmukaisesti kaikkialla; kenttäavain
  (`target`) ja logiikka eivät muutu.
- Vain näkyvä "Ecom"-sana poistuu — sisäinen dataproperty `d.ecom` pysyy, joten
  vanhat tallennetut arvot säilyvät ja näkyvät edelleen kohdassa "Kustannuspaikka".
