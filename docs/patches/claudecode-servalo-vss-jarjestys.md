# Claude Code -prompti: VSS-pöytäkirjan järjestyksen selkeytys

Aja **Servalo-repon juuressa**. Tämä on **korjaava patch** jo asennettuun väestönsuojan
pöytäkirjaan — se **järjestää tiedot uudelleen** selkeämmäksi. Ei uusia kenttiä, ei
tietojen poistoa; vain ryhmittely ja järjestys.

## Mitä tämä muuttaa

**Näkyvä pöytäkirja** — yksi sekava 9-rivinen taulukko puretaan kolmeen selkeään,
otsikoituun lohkoon oikeassa järjestyksessä:

1. **Kohteen tiedot** (ensin): kohde/asiakas, laitetunnus, osoite, sijainti, suojaluokka,
   henkilömäärä, pinta-ala, tarkastusväli.
2. **Tarkastuksen tiedot:** päiväys, tarkastuslaji, tarkastusnro, edellinen pöytäkirja,
   tarkastaja/tekijä.
3. **Vastuuhenkilöt ja suojeluorganisaatio:** omistaja, isännöitsijä, huoltomies,
   suojelulohko, suojeluyksikkö.

**Lomake:** ensimmäisten kenttien päälle lisätään otsikko **"Tarkastuksen tiedot"**, jotta
lomakkeen rakenne vastaa pöytäkirjaa.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function vssPk" servalo.html || { echo "VIRHE: vssPk puuttuu — aja ensin VSS-patch."; exit 1; }
grep -qF '<div class="sub">Kohteen tiedot</div>' servalo.html && { echo "Järjestys on jo korjattu — keskeytetään."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/vss_jarj_patch.py <<'PYEOF'
import io, sys

f = "servalo.html"
s = io.open(f, encoding="utf-8").read()
orig = s

def rep(old, new, n):
    global s
    c = s.count(old)
    if c != n:
        print("VIRHE: ankkuria loytyi %d kpl (odotettu %d):\n  %s" % (c, n, old[:90]))
        sys.exit(1)
    s = s.replace(old, new)

# 1) Pöytäkirjan meta: pura yksi taulukko kolmeen otsikoituun lohkoon
old_meta = '''    +'<table class="meta">'
    +'<tr><td class="k">Kohde / asiakas</td><td>'+esc(ctx.name||"–")+'</td><td class="k">Päiväys</td><td>'+fmt(ans.date||today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"–")+'</td><td class="k">Tarkastuslaji</td><td>'+esc(ans.laji||"–")+'</td></tr>'
    +'<tr><td class="k">Laitetunnus</td><td>'+esc(dev.tag||"–")+'</td><td class="k">Sijainti</td><td>'+site+'</td></tr>'
    +'<tr><td class="k">Tarkastusnro</td><td>'+esc(ans.nro||"–")+'</td><td class="k">Edellinen pöytäkirja</td><td>'+esc(ans.prev||"–")+'</td></tr>'
    +'<tr><td class="k">Omistaja</td><td>'+esc(ans.omistaja||"–")+'</td><td class="k">Isännöitsijä</td><td>'+esc(ans.isannoitsija||"–")+'</td></tr>'
    +'<tr><td class="k">Huoltomies</td><td>'+esc(ans.huoltomies||"–")+'</td><td class="k">Suojaluokka</td><td>'+esc(ans.luokka||"–")+'</td></tr>'
    +'<tr><td class="k">Suojelulohko</td><td>'+esc(ans.lohko||"–")+'</td><td class="k">Suojeluyksikkö</td><td>'+esc(ans.yksikko||"–")+'</td></tr>'
    +'<tr><td class="k">Henkilömäärä</td><td>'+esc(ans.henkilot||"–")+'</td><td class="k">Pinta-ala</td><td>'+esc(ans.pinta||"–")+'</td></tr>'
    +'<tr><td class="k">Tarkastusväli</td><td>'+esc(dev.inspInterval||dev.interval||"–")+'</td><td class="k"></td><td></td></tr>'
    +'</table>'
    +'<div class="sub">Tarkastuskohteet</div>\''''

new_meta = '''    +'<div class="sub">Kohteen tiedot</div>'
    +'<table class="meta">'
    +'<tr><td class="k">Kohde / asiakas</td><td>'+esc(ctx.name||"–")+'</td><td class="k">Laitetunnus</td><td>'+esc(dev.tag||"–")+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"–")+'</td><td class="k">Sijainti</td><td>'+site+'</td></tr>'
    +'<tr><td class="k">Suojaluokka</td><td>'+esc(ans.luokka||"–")+'</td><td class="k">Henkilömäärä</td><td>'+esc(ans.henkilot||"–")+'</td></tr>'
    +'<tr><td class="k">Pinta-ala</td><td>'+esc(ans.pinta||"–")+'</td><td class="k">Tarkastusväli</td><td>'+esc(dev.inspInterval||dev.interval||"–")+'</td></tr>'
    +'</table>'
    +'<div class="sub">Tarkastuksen tiedot</div>'
    +'<table class="meta">'
    +'<tr><td class="k">Päiväys</td><td>'+fmt(ans.date||today())+'</td><td class="k">Tarkastuslaji</td><td>'+esc(ans.laji||"–")+'</td></tr>'
    +'<tr><td class="k">Tarkastusnro</td><td>'+esc(ans.nro||"–")+'</td><td class="k">Edellinen pöytäkirja</td><td>'+esc(ans.prev||"–")+'</td></tr>'
    +'<tr><td class="k">Tarkastaja / tekijä</td><td>'+esc(worker)+'</td><td class="k"></td><td></td></tr>'
    +'</table>'
    +'<div class="sub">Vastuuhenkilöt ja suojeluorganisaatio</div>'
    +'<table class="meta">'
    +'<tr><td class="k">Kiinteistön omistaja</td><td>'+esc(ans.omistaja||"–")+'</td><td class="k">Isännöitsijä</td><td>'+esc(ans.isannoitsija||"–")+'</td></tr>'
    +'<tr><td class="k">Huoltomies</td><td>'+esc(ans.huoltomies||"–")+'</td><td class="k">Suojelulohko</td><td>'+esc(ans.lohko||"–")+'</td></tr>'
    +'<tr><td class="k">Suojeluyksikkö</td><td>'+esc(ans.yksikko||"–")+'</td><td class="k"></td><td></td></tr>'
    +'</table>'
    +'<div class="sub">Tarkastuskohteet</div>\''''

rep(old_meta, new_meta, 1)

# 2) Lomakkeeseen otsikko ensimmäisen lohkon päälle
rep('<input type="hidden" id="enVsDevId">',
    '<input type="hidden" id="enVsDevId">\n      <div style="font-weight:700;margin:2px 0 6px;color:#c1121f">Tarkastuksen tiedot</div>', 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/vss_jarj_patch.py

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

echo "--- Uudet lohko-otsikot läsnä ---"
for t in '<div class="sub">Kohteen tiedot</div>' '<div class="sub">Tarkastuksen tiedot</div>' '<div class="sub">Vastuuhenkilöt ja suojeluorganisaatio</div>' '<div class="sub">Tarkastuskohteet</div>'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "VSS-poytakirja: jarjesta tiedot kolmeen lohkoon (kohde ensin)"
git push origin main
echo "VALMIS."
```

---

## Huom
- Vain järjestys ja ryhmittely muuttuvat — kaikki kentät ja tiedot säilyvät.
- **Kohteen tiedot** näkyvät nyt ensimmäisenä, kuten pyysit.
- Jos haluat vielä siirtää **Kokonaisarvion** ylös (heti kohteen tietojen jälkeen
  "yhteenveto edellä" -tyyliin), kerro — teen siitä oman pikkupätsin.
