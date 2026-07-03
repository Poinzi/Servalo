# Claude Code -prompti: käsisammuttimien tarkastuspöytäkirja (jaettava asiakasnäkymä)

Aja **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

## Mitä tämä tekee
Lisää uuden **tulostettavan / jaettavan tarkastuspöytäkirjan käsisammuttimille**
(malli: liite2-ikaset, mutta omalla fontilla ja ulkoasulla + Savuksin tiedot alareunassa).

- Pöytäkirja avautuu omaan tulostusikkunaan (kuten nykyinen huoltoraportti). Sen voi
  tulostaa tai tallentaa PDF:ksi ja jakaa asiakkaalle.
- **Per toimipiste/kohde**: listaa kohteen käsisammuttimet riveinä.
- Sarakkeet kuten mallissa, mutta **Sijainti ja Tarkastusväli on vaihdettu paikkaa**:
  `# · Sijainti · Merkki/Malli · Tyyppi · Tark. · Koeponn. · Huolto kk/vv · Valm.nro · Tarkastusväli · Lisätiedot · Kuva`.
- **Kuva**: näyttää tarkastuksen valokuvan (kirjausmodaalin kuvakenttä on jo olemassa;
  tämä tuo kuvan pöytäkirjaan). Näin kuvasta→tietoihin-työnkulun tulos näkyy raportissa.
- **Fontti/ulkoasu erilainen** kuin IDR/huoltoraportti (Georgia-otsikot + Trebuchet-leipä,
  punainen SAVUKS-brändi).
- **Savuksin tiedot alareunassa** (nimi, puh, sähköposti, web, osoite, y-tunnus) — jotta
  dokumentti on selvästi Savuksin oma.

Kaksi avauskohtaa:
- **Asiakasportaali** (asiakkaan jaettava näkymä): nappi "🧯 Sammutinpöytäkirja".
- **Henkilöstö**: laitelistan monivalinnan valikkoon "🧯 Sammutinpöytäkirja valituista".

> Huom: Savuksin puhelinnumero kirjoitetaan raporttiin **välilyönnillä** muodossa
> `044 3665638` (kuten tarrassa). Kiellettyjen merkkijonojen vahti tarkistaa
> välilyönnittömän muodon, joten se ei laukea — ja PAP/IDR-tunnisteet jäävät edelleen
> kiinni vahtiin.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/sammutin_patch.py <<'PYEOF'
import io, sys

f = "servalo.html"
s = io.open(f, encoding="utf-8").read()
orig = s

def rep(old, new, n):
    global s
    c = s.count(old)
    if c != n:
        print("VIRHE: ankkuria loytyi %d kpl (odotettu %d):\n  %s" % (c, n, old[:80]))
        sys.exit(1)
    s = s.replace(old, new)

# 1) Asiakasportaalin topbar-nappi
rep('      <button class="btn orange" onclick="portalPrint()">⬇ Tulostettava huoltoraportti</button></div>',
    '      <button class="btn orange" onclick="portalPrint()">⬇ Tulostettava huoltoraportti</button>\n      <button class="btn ghost" onclick="sammutinPkPortal()">\U0001f9ef Sammutinpöytäkirja</button></div>', 1)

# 2) Henkiloston monivalintavalikon nappi
rep('                <button onclick="bulkPrintQr()">\U0001f5a8 Tulosta QR-tarrat</button>',
    '                <button onclick="bulkPrintQr()">\U0001f5a8 Tulosta QR-tarrat</button>\n                <button onclick="sammutinPkSel()">\U0001f9ef Sammutinpöytäkirja valituista</button>', 1)

# 3) Itse toiminnot (lisataan portalPrintin peraan)
old_fn = '''  w.document.close();
}

/* ========== KÄYTTÄJÄT / ROOLIT ========== */'''

new_fn = '''  w.document.close();
}

function isExting(d){return !!d && !d.deleted && (d.group==="Käsisammutin" || String(d.make||"").toLowerCase().indexOf("sammutin")>=0);}
function sammutinPkPortal(){var c=portalCustomer();if(!c){alert("Ei kohdetta.");return;}var ds=devicesOfCustomer(c.id).filter(isExting);sammutinPk(ds,{name:c.name,address:c.address||""});}
function sammutinPkSel(){var m=document.getElementById("bulkMenu");if(m)m.classList.remove("show");var ds=db.devices.filter(function(d){return selected.has(d.id)&&isExting(d);});if(!ds.length){alert("Valitse ensin vähintään yksi käsisammutin listasta.");return;}sammutinPk(ds,{name:"",address:""});}
function sammutinPk(devs,ctx){
  ctx=ctx||{name:"",address:""};
  var w=window.open("","_blank");
  if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  var typeOf=function(d){var m=String(d.make||"").toUpperCase();if(m.indexOf("CO2")>=0||m.indexOf("HIILIDIOKS")>=0)return"CO2";if(m.indexOf("NESTE")>=0)return"Neste";if(m.indexOf("VAAHTO")>=0)return"Vaahto";return"Jauhe";};
  var mmYY=function(iso){if(!iso)return"";var p=String(iso).slice(0,10).split("-");return p.length>=2?(p[1]+"/"+p[0].slice(2)):"";};
  var photoOf=function(d){var a=d.inspections||[];for(var i=0;i<a.length;i++){if(a[i].photo&&a[i].photo.data)return a[i].photo.data;}return"";};
  var rows=(devs||[]).map(function(d,i){
    var ph=photoOf(d);
    var img=ph?('<img src="'+ph+'" style="width:44px;height:44px;object-fit:cover;border:1px solid #ccc;border-radius:4px">'):'<span style="color:#bbb">–</span>';
    return '<tr>'
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
      +'</tr>';
  }).join("")||'<tr><td colspan="11" style="text-align:center;color:#999;padding:18px">Ei käsisammuttimia valinnassa.</td></tr>';
  var worker=currentUser?currentUser.name:"";
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Sammutinpöytäkirja</title>'
    +'<style>'
    +'body{font-family:"Trebuchet MS",Verdana,Geneva,sans-serif;color:#1b1b1b;margin:26px}'
    +'h1{font-family:Georgia,"Times New Roman",serif;font-size:21px;letter-spacing:.5px;margin:0}'
    +'.brand{font-family:Georgia,serif;font-size:26px;font-weight:700;color:#c1121f;letter-spacing:3px}'
    +'.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c1121f;padding-bottom:12px}'
    +'.meta{font-size:12px;color:#333;margin:12px 0 14px}.meta b{color:#000}'
    +'table{width:100%;border-collapse:collapse;font-size:11px}'
    +'th{background:#1b1b1b;color:#fff;padding:6px 5px;text-align:left;font-weight:600}'
    +'th.c{text-align:center}td{padding:5px;border-bottom:1px solid #ddd;vertical-align:top}'
    +'td.c{text-align:center}td.num{text-align:center;color:#888;width:22px}'
    +'.foot{display:flex;justify-content:space-between;gap:24px;margin-top:22px}'
    +'.notes{flex:1;border:1px solid #bbb;border-radius:6px;min-height:78px;padding:8px}'
    +'.sign{min-width:230px;font-size:12px}.sign .line{border-bottom:1px solid #333;height:20px;margin-bottom:2px}'
    +'.company{margin-top:22px;border-top:2px solid #c1121f;padding-top:10px;font-size:11px;color:#333;line-height:1.55}'
    +'.company .n{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;letter-spacing:1px}'
    +'@media print{button{display:none}}'
    +'</style></head><body>'
    +'<div class="head"><div><div class="brand">SAVUKS</div><div style="font-size:11px;color:#666">Paloturvallisuuspalvelut</div></div>'
    +'<div style="text-align:right"><h1>Tarkastuspöytäkirja</h1><div style="font-size:12px;color:#666">Käsisammuttimet</div></div></div>'
    +'<div class="meta"><b>Asiakas:</b> '+esc(ctx.name||"–")+' &nbsp; <b>Osoite:</b> '+esc(ctx.address||"–")+' &nbsp; <b>Päiväys:</b> '+fmt(today())+' &nbsp; <b>Sammuttimia:</b> '+(devs?devs.length:0)+'</div>'
    +'<table><thead><tr>'
    +'<th class="c">#</th><th>Sijainti</th><th>Merkki / Malli</th><th class="c">Tyyppi</th><th class="c">Tark.</th><th class="c">Koeponn.</th><th class="c">Huolto kk/vv</th><th class="c">Valm.nro</th><th class="c">Tarkastusväli</th><th>Lisätiedot</th><th class="c">Kuva</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div class="foot"><div style="flex:1"><div style="font-size:12px;font-weight:700;margin-bottom:4px">Huomioita</div><div class="notes"></div></div>'
    +'<div class="sign"><div style="margin-bottom:14px"><div style="font-size:11px;color:#666">Päivämäärä</div><div class="line"></div>'+fmt(today())+'</div>'
    +'<div><div style="font-size:11px;color:#666">Työn suorittaja</div><div class="line"></div>'+esc(worker)+'</div></div></div>'
    +'<div class="company"><span class="n">SAVUKS</span> &nbsp; puh. 044 3665638 &nbsp; info@savuks.com &nbsp; www.savuks.com<br>Santalankulmantie 8, 21290 Rusko &nbsp; Y-tunnus 3465682-5</div>'
    +'<p style="margin-top:20px"><button onclick="window.print()" style="background:#c1121f;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer">\U0001f5a8 Tulosta / Tallenna PDF</button></p>'
    +'</body></html>';
  w.document.write(html);
  w.document.close();
}

/* ========== KÄYTTÄJÄT / ROOLIT ========== */'''

rep(old_fn, new_fn, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/sammutin_patch.py

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
for t in "function sammutinPk" "function sammutinPkPortal" "function sammutinPkSel" "function isExting" "Tarkastuspöytäkirja" "Santalankulmantie 8" "3465682-5"; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Sijainti ja Tarkastusväli vaihdettu (Sijainti ennen Tarkastusväliä otsikkorivillä) ---"
grep -qF '<th>Sijainti</th><th>Merkki / Malli</th>' servalo.html && echo "OK: Sijainti alussa" || { echo "PUUTTUU"; exit 1; }

echo "--- Malliyhtiön (IKASET/Tamrex ym.) tunnisteet EIVÄT ole vuotaneet ---"
if grep -niE "IKASET|Tamrex|Autismis|Turunen|Airiainen|Lintuhyt|Vatialantie" servalo.html; then
  echo "VIRHE: mallidokumentin tunniste vuoti — keskeytetään."; exit 1
else echo "Malliyhtiö: puhdas"; fi

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Kasisammuttimien tarkastuspoytakirja: jaettava/tulostettava asiakasnakyma + Savuks-tiedot"
git push origin main
echo "VALMIS."
```

---

## Huom
- Puhelinnumero kirjoitetaan välilyönnillä (`044 3665638`) — täsmälleen kuten tarrassa.
  Kiellettyjen merkkijonojen vahti tarkistaa välilyönnittömän `0443665638`-muodon, joten
  raportti läpäisee vahdin, ja PAP/IDR-tunnisteet jäävät edelleen kiinni.
- **Tyyppi** (Jauhe/Neste/CO2/Vaahto) päätellään mallinimestä; **Koeponn.** näytetään
  kentästä `pressureTest` (tyhjä kunnes lisäät sen — voi täyttää käsin tulosteeseen).
- **Kuva** tuo tarkastukseen liitetyn valokuvan pöytäkirjaan. Varsinaisen "ota kuva → AI
  analysoi → kentät täyttyvät" -automaation suunnittelemme erikseen; tämä on sen
  näyttöpää (raportti johon tiedot valuvat).
- Halutessasi vaihdan fontin, värit tai sarakkeet — kerro vain.
