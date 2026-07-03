# Claude Code -prompti: nimeä sisäinen `idr`-kenttä uudelleen → `tag` (+ localStorage-migraatio)

Aja **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

## Miksi
Laitteen sisäinen ohjelmakenttä oli nimeltään `idr` — sama tunnus kuin lähdejärjestelmässä.
Se **ei näy käyttäjälle** (käyttöliittymässä lukee "Laitetunnus" / "QR-koodi"), mutta se
näkyy lähdekoodissa ja selaimen localStoragessa. Tämä patch vaihtaa sen neutraaliksi
nimeksi **`tag`** kaikkialla koodissa:

- `dIdr` → `dTag` (lomakekentän id, 3 kpl)
- `byIdr` → `byTag` (apufunktio + kutsut, 16 kpl)
- kaikki erilliset `idr`-tokenit (`d.idr`, `idr:`, parametrit, destrukturointi, HIST_FIELDS-avain) → `tag` (78 kpl → 0)

Lisäksi mukana **kertamigraatio**: kun sovellus avataan ja localStoragessa on vanhoja
laitteita/historiaa joissa on vielä `idr`-avain, se siirretään `tag`-avaimeksi
automaattisesti (ei tietojen menetystä). Migraatio lukee vanhan avaimen
hakasulkunotaatiolla `x["idr"]`, joten se on ainoa paikka johon "idr"-merkkijono jää
tarkoituksella.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/idr_rename_patch.py <<'PYEOF'
import io, re, sys

f = "servalo.html"
s = io.open(f, encoding="utf-8").read()
orig = s

def rep_literal(old, new, n):
    global s
    c = s.count(old)
    if c != n:
        print("VIRHE: '%s' loytyi %d kpl (odotettu %d)" % (old, c, n))
        sys.exit(1)
    s = s.replace(old, new)

# 1) camelCase-tunnisteet ENSIN (eivat sisalla pienta 'idr'-substringia)
rep_literal("dIdr", "dTag", 3)
rep_literal("byIdr", "byTag", 16)

# 2) kaikki erilliset pieni-idr-tokenit -> tag (regex, sananraja)
before = len(re.findall(r"\bidr\b", s))
if before != 78:
    print("VIRHE: erillisia idr-tokeneita %d (odotettu 78)" % before)
    sys.exit(1)
s = re.sub(r"\bidr\b", "tag", s)
after = len(re.findall(r"\bidr\b", s))
if after != 0:
    print("VIRHE: idr-tokeneita jai %d kpl regex-vaiheen jalkeen" % after)
    sys.exit(1)

# 3) loadDB -> lisaa kertamigraatio (teksti lisataan regex-vaiheen JALKEEN,
#    joten hakasulku-idr jaa tarkoituksella -> ainoa "idr" tiedostossa)
old_load = 'function loadDB(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.devices)return d;}catch(e){}return null;}'
new_load = ('function loadDB(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.devices)return migrateTag(d);}catch(e){}return null;}\n'
            'function migrateTag(d){\n'
            '  (d.devices||[]).forEach(function(x){if(x&&x["idr"]!==undefined&&x.tag===undefined){x.tag=x["idr"];delete x["idr"];}});\n'
            '  (d.history||[]).forEach(function(h){if(h&&h["idr"]!==undefined&&h.tag===undefined){h.tag=h["idr"];delete h["idr"];}});\n'
            '  return d;\n'
            '}')
rep_literal(old_load, new_load, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/idr_rename_patch.py

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

echo "--- Uudet tunnisteet läsnä ---"
for t in "dTag" "byTag" 'tag:"Laitetunnus"' "migrateTag"; do
  grep -q "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Vanha idr poistettu (paitsi migraation hakasulku-avain) ---"
# ainoat sallitut idr-esiintymat ovat migrateTag-funktion ["idr"]-avaimet
# (rivipohjainen: nayta idr-rivit jotka EIVAT sisalla ["idr"]-avainta)
bad=$(grep -nE '\bidr\b' servalo.html | grep -vE '\["idr"\]' || true)
if [ -n "$bad" ]; then
  echo "VIRHE: idr jäi seuraaviin kohtiin:"; echo "$bad"; exit 1
else
  echo "idr poistettu (vain migraation avaimet jäljellä)."
fi

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Nimea sisainen idr-kentta uudelleen tag:ksi + localStorage-migraatio"
git push origin main
echo "VALMIS."
```

---

## Huom
- Muutos on **puhtaasti sisäinen** — käyttöliittymä näyttää edelleen "Laitetunnus" ja
  "QR-koodi". QR-koodin sisältö (laitteen tunnusarvo, esim. "601678") ei muutu, koska
  taustapalvelu käyttää **arvoa**, ei kentän nimeä.
- Vanhat selaimeen tallennetut laitteet ja historia migratoidaan automaattisesti
  ensimmäisellä avaamisella (`idr` → `tag`), joten olemassa olevat tunnukset säilyvät.
- Validointi varmistaa, ettei koodiin jää yhtään `idr`-tokenia paitsi migraatiofunktion
  `["idr"]`-avaimet, jotka lukevat vanhan datan.
