# Claude Code -prompti: käsisammutinpöytäkirjan siistiminen

Aja **Servalo-repon juuressa**. Tämä on **korjaava patch** jo asennettuun
käsisammutinpöytäkirjaan. Ei uutta mekaniikkaa — parannetaan olemassa olevaa raporttia.

## Mitä tämä korjaa

- **Poistaa harhaanjohtavat sarakkeet:** "Tark. ✓" → oikea **tarkastuspäivä**, ja tyhjä
  `pressureTest`-pohjainen **Koeponn.** → laskettu **seuraava koeponnistus** (valm.vuosi + 10 v).
- **Lisää sarakkeet:** **Teholuokka** (päätellään mallista), **Valm.vuosi** (luetaan
  sarja-/mallitiedoista), **Seur. tark.** (laitteen seuraava tarkastuspäivä).
- **Ryhmittää kohteen tiedot** omaan otsikoituun lohkoon ("Kohteen tiedot") pöytäkirjan
  alkuun, mukaan **Tarkastaja**.
- **Vaakasuunta (landscape)** + selite (–  = puuttuva tieto / täytä käsin), jotta
  taulukko on luettava.

Sarakkeet: `# · Sijainti · Merkki/Malli · Tyyppi · Teholuokka · Valm.vuosi · Tark. pvm ·
Seur. tark. · Huolto · Koeponn. · Valm.nro · Lisätiedot · Kuva`.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function sammutinPk" servalo.html || { echo "VIRHE: sammutinPk puuttuu — aja ensin käsisammutin-patch."; exit 1; }
grep -qF 'class="metah"' servalo.html && { echo "Siistintä on jo tehty — keskeytetään."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/sammutin_siisti_patch.py <<'PYEOF'
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

# 1) Uudet apufunktiot typeOf:n perään (ankkuri on uniikki sammutinPk:lle)
rep('  var typeOf=function(d){var m=String(d.make||"").toUpperCase();if(m.indexOf("CO2")>=0||m.indexOf("HIILIDIOKS")>=0)return"CO2";if(m.indexOf("NESTE")>=0)return"Neste";if(m.indexOf("VAAHTO")>=0)return"Vaahto";return"Jauhe";};',
    '''  var typeOf=function(d){var m=String(d.make||"").toUpperCase();if(m.indexOf("CO2")>=0||m.indexOf("HIILIDIOKS")>=0)return"CO2";if(m.indexOf("NESTE")>=0)return"Neste";if(m.indexOf("VAAHTO")>=0)return"Vaahto";return"Jauhe";};
  var dash='<span style="color:#bbb">–</span>';
  var tehoOf=function(d){var t=String(d.make||"").toUpperCase().replace(/\\s+/g,"");var o=[];var a=t.match(/\\d+A/);if(a)o.push(a[0]);var b=t.match(/\\d+B/);if(b)o.push(b[0]);if(/[AB0-9]C/.test(t))o.push("C");return o.join(" ");};
  var yearOf=function(d){var m=String((d.serial||"")+" "+(d.make||"")).match(/(19|20)\\d{2}/);return m?m[0]:"";};
  var koeOf=function(d){var y=yearOf(d);return y?String(parseInt(y,10)+10):"";};''', 1)

# 2) Rivien solut: uudet sarakkeet
rep('''    return '<tr>'
      +'<td class="num">'+(i+1)+'</td>'
      +'<td>'+esc(d.locDetail||siteName(d.locId)||"")+'</td>'
      +'<td>'+esc(d.make||"")+'</td>'
      +'<td class="c">'+typeOf(d)+'</td>'
      +'<td class="c">'+(d.inspLast?"✓":"")+'</td>'
      +'<td class="c">'+esc(d.pressureTest||"")+'</td>'
      +'<td class="c">'+esc(mmYY(d.last))+'</td>'
      +'<td class="c">'+esc(d.serial||valmOf(d.make)||"")+'</td>'
      +'<td class="c">'+esc(d.inspInterval||d.interval||"")+'</td>'
      +'<td>'+esc(d.notes||"")+'</td>'
      +'<td class="c">'+img+'</td>'
      +'</tr>';''',
    '''    return '<tr>'
      +'<td class="num">'+(i+1)+'</td>'
      +'<td>'+esc(d.locDetail||siteName(d.locId)||"")+'</td>'
      +'<td>'+esc(d.make||"")+'</td>'
      +'<td class="c">'+typeOf(d)+'</td>'
      +'<td class="c">'+(tehoOf(d)||dash)+'</td>'
      +'<td class="c">'+(yearOf(d)||dash)+'</td>'
      +'<td class="c">'+(d.inspLast?fmt(d.inspLast):dash)+'</td>'
      +'<td class="c">'+(d.inspNext?fmt(d.inspNext):dash)+'</td>'
      +'<td class="c">'+(mmYY(d.last)||dash)+'</td>'
      +'<td class="c">'+(koeOf(d)||dash)+'</td>'
      +'<td class="c">'+esc(d.serial||valmOf(d.make)||"")+'</td>'
      +'<td>'+esc(d.notes||"")+'</td>'
      +'<td class="c">'+img+'</td>'
      +'</tr>';''', 1)

# 3) Tyhjä rivi: colspan 11 -> 13
rep('<tr><td colspan="11" style="text-align:center;color:#999;padding:18px">Ei käsisammuttimia valinnassa.</td></tr>',
    '<tr><td colspan="13" style="text-align:center;color:#999;padding:18px">Ei käsisammuttimia valinnassa.</td></tr>', 1)

# 4) Tyylit: landscape + lohko-otsikko + meta + selite (ankkuri sammutin-title uniikki)
rep('''  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Sammutinpöytäkirja</title>'
    +'<style>'
    +'body{font-family:"Trebuchet MS",Verdana,Geneva,sans-serif;color:#1b1b1b;margin:26px}\'''',
    '''  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Sammutinpöytäkirja</title>'
    +'<style>'
    +'@page{size:A4 landscape;margin:12mm}'
    +'body{font-family:"Trebuchet MS",Verdana,Geneva,sans-serif;color:#1b1b1b;margin:26px}'
    +'.sub{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:13px;margin:14px 0 4px}'
    +'.metah{border-collapse:collapse;font-size:12px;margin:2px 0 4px}'
    +'.metah td{padding:3px 8px;border-bottom:1px solid #eee}.metah td.k{color:#666}'
    +'.legend{font-size:10px;color:#666;margin:6px 0 0;font-style:italic}\'''', 1)

# 5) Meta-lohko + otsikkorivi + selite
rep('''    +'<div class="meta"><b>Asiakas:</b> '+esc(ctx.name||"–")+' &nbsp; <b>Osoite:</b> '+esc(ctx.address||"–")+' &nbsp; <b>Päiväys:</b> '+fmt(today())+' &nbsp; <b>Sammuttimia:</b> '+(devs?devs.length:0)+'</div>'
    +'<table><thead><tr>'
    +'<th class="c">#</th><th>Sijainti</th><th>Merkki / Malli</th><th class="c">Tyyppi</th><th class="c">Tark.</th><th class="c">Koeponn.</th><th class="c">Huolto kk/vv</th><th class="c">Valm.nro</th><th class="c">Tarkastusväli</th><th>Lisätiedot</th><th class="c">Kuva</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>\'''',
    '''    +'<div class="sub">Kohteen tiedot</div>'
    +'<table class="metah">'
    +'<tr><td class="k">Kohde / asiakas</td><td>'+esc(ctx.name||"–")+'</td><td class="k">Päiväys</td><td>'+fmt(today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"–")+'</td><td class="k">Sammuttimia</td><td>'+(devs?devs.length:0)+'</td></tr>'
    +'<tr><td class="k">Tarkastaja</td><td>'+esc(worker)+'</td><td class="k"></td><td></td></tr>'
    +'</table>'
    +'<table><thead><tr>'
    +'<th class="c">#</th><th>Sijainti</th><th>Merkki / Malli</th><th class="c">Tyyppi</th><th class="c">Teholuokka</th><th class="c">Valm.vuosi</th><th class="c">Tark. pvm</th><th class="c">Seur. tark.</th><th class="c">Huolto</th><th class="c">Koeponn.</th><th class="c">Valm.nro</th><th>Lisätiedot</th><th class="c">Kuva</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div class="legend">Tyyppi ja teholuokka päätellään mallista. Valm.vuosi luetaan sarja-/mallitiedoista jos saatavilla. Koeponn. = seuraava koeponnistus (valm.vuosi + 10 v). – = tieto puuttuu / täytä käsin.</div>\'''', 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/sammutin_siisti_patch.py

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

echo "--- Uudet rakenteet läsnä ---"
for t in 'class="metah"' 'var tehoOf=function' 'var yearOf=function' '>Teholuokka<' '>Valm.vuosi<' '>Seur. tark.<' 'A4 landscape'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Vanhat harhaanjohtavat sarakkeet poistettu ---"
grep -qF 'esc(d.pressureTest||"")' servalo.html && { echo "VIRHE: pressureTest-sarake yhä sammutinPk:ssa?"; } || echo "OK: pressureTest ei enää sammutinPk-riveissä"

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Kasisammutinpoytakirja: siisti sarakkeet, teholuokka/valm.vuosi/seur.tark, kohde-lohko, landscape"
git push origin main
echo "VALMIS."
```

---

## Huom
- **Koeponn.** näyttää nyt lasketun seuraavan koeponnistuksen (valm.vuosi + 10 v). Jos
  valmistusvuotta ei löydy sarja-/mallitiedoista, kenttä jää viivaksi ja voit täyttää sen
  käsin. Jos haluat oikean koeponnistuspäivän kentäksi (tallennettavaksi), teen siitä
  erillisen patchin.
- **Pikapalopostipöytäkirja** käyttää samaa pohjaa — kerro, jos haluat saman siistinnän
  myös siihen.
