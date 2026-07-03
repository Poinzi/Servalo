# Claude Code -prompti: raporttivalikon nimet omiksi (erilaisiksi kuin IDR)

Aja **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

## Mitä tämä tekee
Vaihtaa kiinteiden raporttien **näkyvät nimet** neutraaleiksi/omiksi. Sisäiset avaimet
(`data-report="huollot"` ym., slug-nimet `name:"tulevat-..."`) **eivät muutu**, joten
reititys ja CSV-tiedostonimet toimivat ennallaan. Vain käyttäjälle näkyvät otsikot
vaihtuvat — ja ne vaihtuvat **johdonmukaisesti** kaikkialla (valikko, työpöydän
tunnusluku, raportin otsikko, asiakasportaali, laitekortin paneeli).

| Vanha (IDR-tyylinen) | Uusi |
|---|---|
| Tulevat määräaikaishuollot | Erääntyvät huollot |
| Tulevat tarkastukset | Erääntyvät tarkastukset |
| Käyttökoulutetut henkilöt | Koulutetut käyttäjät |
| Eniten korjatut laitteet | Toistuvasti korjatut laitteet |
| Poistetut laitteet | Käytöstä poistetut laitteet |
| Vuokralaitteet | Vuokrakalusto |
| Pätevyydet / kortit | Pätevyydet ja kortit |

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/raportit_nimet_patch.py <<'PYEOF'
import io, sys

f = "servalo.html"
s = io.open(f, encoding="utf-8").read()
orig = s

def rep_all(old, new, n):
    global s
    c = s.count(old)
    if c != n:
        print("VIRHE: '%s' loytyi %d kpl (odotettu %d)" % (old, c, n))
        sys.exit(1)
    s = s.replace(old, new)

# (vanha, uusi, odotettu esiintymamaara)
changes = [
    ("Tulevat määräaikaishuollot", "Erääntyvät huollot", 6),
    ("Tulevat tarkastukset",                     "Erääntyvät tarkastukset", 5),
    ("Käyttökoulutetut henkilöt",  "Koulutetut käyttäjät", 6),
    ("Eniten korjatut laitteet",                 "Toistuvasti korjatut laitteet", 3),
    ("Poistetut laitteet",                       "Käytöstä poistetut laitteet", 3),
    ("Vuokralaitteet",                           "Vuokrakalusto", 3),
    ("Pätevyydet / kortit",                 "Pätevyydet ja kortit", 2),
]
for old, new, n in changes:
    rep_all(old, new, n)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/raportit_nimet_patch.py

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

echo "--- Uudet nimet läsnä ---"
for t in "Erääntyvät huollot" "Erääntyvät tarkastukset" "Koulutetut käyttäjät" "Toistuvasti korjatut laitteet" "Käytöstä poistetut laitteet" "Vuokrakalusto" "Pätevyydet ja kortit"; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Sisäiset avaimet ennallaan ---"
for t in 'data-report="huollot"' 'data-report="tarkastukset"' 'data-report="koulutetut"' 'data-report="vuokralaitteet"' 'name:"tulevat-maaraaikaishuollot"'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Vanhat näkyvät nimet poistettu ---"
for t in "Tulevat määräaikaishuollot" "Tulevat tarkastukset" "Käyttökoulutetut henkilöt" "Eniten korjatut laitteet"; do
  if grep -qF "$t" servalo.html; then echo "VIRHE: vanha nimi jäi: $t"; exit 1; else echo "poistettu: $t"; fi
done

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Raporttivalikon nimet omiksi (nakyvat otsikot, sisaiset avaimet ennallaan)"
git push origin main
echo "VALMIS."
```

---

## Huom
- Sisäiset avaimet ja slug-nimet (CSV-tiedostonimet) eivät muutu — vain käyttäjälle
  näkyvät otsikot. Kaikki näkyvät esiintymät päivittyvät johdonmukaisesti.
- Jos haluat eri sanamuodot, kerro niin muutan taulukon uusia arvoja.
