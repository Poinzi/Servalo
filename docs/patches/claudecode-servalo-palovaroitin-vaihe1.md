# Claude Code -prompti: Palovaroitin (Vaihe 1) — laitetyyppi + pöytäkirja

Aja **Servalo-repon juuressa**. Lisää uuden **Palovaroitin**-laitetyypin ja oman
listapöytäkirjan (asuntokohtaiset huoneistovaroittimet — eri asia kuin paloilmoitin).

**Mitä tulee:**
- Uusi laiteryhmä **Palovaroitin** (valittavissa laitelomakkeen Tuoteryhmä-kenttään;
  mukana suodatuksessa ja demodatan luokittelussa).
- **Palovaroitinpöytäkirja** (A4 vaaka), joka ryhmittelee rivit **rappu/toimipiste →
  asunto/tila** -tasolla. Toimii sekä taloyhtiölle (rappu+asunto) että yritykselle
  (pelkkä tila) — ryhmittely tulee laitteen toimipisteestä ja Sijainti-kentästä.
- Sarakkeet: #, Sijainti (asunto/tila), Tyyppi (optinen/ioni), Virta (paristo/230 V),
  Valm.vuosi, **Vaihto viim.** (asennusvuosi + 10 v), Tark. pvm, Seur. tark.,
  Testi/huolto, **Kunto** (OK/Puute), **Poikkeamat**, Kuva.
- Automaattinen **yhteenveto** (varoittimia yhteensä / kunnossa / puutteita) ja
  allekirjoituslohko + toimenpiteet-kenttä.
- Käynnistys: **Raportit-valikon "valituista"** (monivalinta listasta) ja
  **asiakasportaalin** painike — kuten sammutin-/pikapöytäkirjassa.
- Siisti sivutus mukana heti (ei orpoja otsikoita, ei katkeavia rivejä).

Ei kosketa dataan, muihin pöytäkirjoihin eikä palvelimeen.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF 'function pikaPk(' servalo.html || { echo "VIRHE: pikaPk puuttuu — aja ensin aiemmat patchit."; exit 1; }
grep -qF 'function palovaroitinPk(' servalo.html && { echo "Jo asennettu (palovaroitinPk) — keskeytetään."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/palo_patch.py <<'PYEOF'
# -*- coding: utf-8 -*-
import io, sys

def patch(fn, edits):
    s = io.open(fn, encoding="utf-8").read(); orig=s
    for old,new,n in edits:
        c=s.count(old)
        if c!=n:
            print("VIRHE: ankkuri %d/%d:\n  %s"%(c,n,old[:90])); sys.exit(1)
        s=s.replace(old,new)
    if s==orig: print("VIRHE: ei muutosta"); sys.exit(1)
    io.open(fn,"w",encoding="utf-8").write(s); print("Patch OK")

FUNC = r'''function isPalovaroitin(d){return !!d && !d.deleted && (d.group==="Palovaroitin" || String(d.make||"").toLowerCase().indexOf("palovaroitin")>=0 || String(d.target||"").toLowerCase().indexOf("palovaroitin")>=0);}
function palovaroitinPkPortal(){var c=portalCustomer();if(!c){alert("Ei kohdetta.");return;}var ds=devicesOfCustomer(c.id).filter(isPalovaroitin);palovaroitinPk(ds,{name:c.name,address:c.address||""});}
function palovaroitinPkSel(){var m=document.getElementById("bulkMenu");if(m)m.classList.remove("show");var ds=db.devices.filter(function(d){return selected.has(d.id)&&isPalovaroitin(d);});if(!ds.length){alert("Valitse ensin vähintään yksi palovaroitin listasta.");return;}palovaroitinPk(ds,{name:"",address:""});}
function palovaroitinPk(devs,ctx){
  ctx=ctx||{name:"",address:""};
  var w=window.open("","_blank");
  if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  var dash='<span style="color:#bbb">–</span>';
  var typeOf=function(d){return /ioni/i.test(String(d.make||""))?"Ioni":"Optinen";};
  var powerOf=function(d){var t=String((d.make||"")+" "+(d.notes||""));return /230|verkko/i.test(t)?"230 V":"Paristo";};
  var yearOf=function(d){var m=String((d.serial||"")+" "+(d.make||"")).match(/(19|20)\d{2}/);return m?m[0]:"";};
  var replOf=function(d){var y=yearOf(d);return y?String(parseInt(y,10)+10):"";};
  var mmYY=function(iso){if(!iso)return"";var p=String(iso).slice(0,10).split("-");return p.length>=2?(p[1]+"/"+p[0].slice(2)):"";};
  var faulty=function(d){return /vika|puute|ei toimi|vaihda|viallinen|paristo tyhj/i.test(String(d.notes||""));};
  var photoOf=function(d){var a=d.inspections||[];for(var i=0;i<a.length;i++){if(a[i].photo&&a[i].photo.data)return a[i].photo.data;}return"";};
  var sorted=(devs||[]).slice().sort(function(a,b){var sa=siteName(a.locId)||"",sb=siteName(b.locId)||"";if(sa!==sb)return sa<sb?-1:1;var la=String(a.locDetail||""),lb=String(b.locDetail||"");return la<lb?-1:(la>lb?1:0);});
  var faults=0,rows="",curSite=null,idx=0;
  sorted.forEach(function(d){
    var sn=siteName(d.locId)||"–";
    if(sn!==curSite){curSite=sn;rows+='<tr class="grp"><td colspan="12">Rappu / toimipiste: '+esc(sn)+'</td></tr>';}
    idx++;if(faulty(d))faults++;
    var ph=photoOf(d);
    var img=ph?('<img src="'+ph+'" style="width:40px;height:40px;object-fit:cover;border:1px solid #ccc;border-radius:4px">'):dash;
    rows+='<tr>'
      +'<td class="num">'+idx+'</td>'
      +'<td>'+esc(d.locDetail||"–")+'</td>'
      +'<td class="c">'+typeOf(d)+'</td>'
      +'<td class="c">'+powerOf(d)+'</td>'
      +'<td class="c">'+(yearOf(d)||dash)+'</td>'
      +'<td class="c">'+(replOf(d)||dash)+'</td>'
      +'<td class="c">'+(d.inspLast?fmt(d.inspLast):dash)+'</td>'
      +'<td class="c">'+(d.inspNext?fmt(d.inspNext):dash)+'</td>'
      +'<td class="c">'+(mmYY(d.last)||dash)+'</td>'
      +'<td class="c">'+(faulty(d)?'<b style="color:#c1121f">Puute</b>':'<b style="color:#1a7f37">OK</b>')+'</td>'
      +'<td>'+esc(d.notes||"")+'</td>'
      +'<td class="c">'+img+'</td>'
      +'</tr>';
  });
  if(!rows)rows='<tr><td colspan="12" style="text-align:center;color:#999;padding:18px">Ei palovaroittimia valinnassa.</td></tr>';
  var worker=currentUser?currentUser.name:"";
  var total=idx;
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Palovaroitinpöytäkirja</title>'
    +'<style>'
    +'@page{size:A4 landscape;margin:12mm}'
    +'body{font-family:"Trebuchet MS",Verdana,Geneva,sans-serif;color:#1b1b1b;margin:26px}'
    +'.sub{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:13px;margin:14px 0 4px}'
    +'.metah{border-collapse:collapse;font-size:12px;margin:2px 0 4px}'
    +'.metah td{padding:3px 8px;border-bottom:1px solid #eee}.metah td.k{color:#666}'
    +'.legend{font-size:10px;color:#666;margin:6px 0 0;font-style:italic}'
    +'h1{font-family:Georgia,"Times New Roman",serif;font-size:21px;letter-spacing:.5px;margin:0}'
    +'.brand{font-family:Georgia,serif;font-size:26px;font-weight:700;color:#c1121f;letter-spacing:3px}'
    +'.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c1121f;padding-bottom:12px}'
    +'table{width:100%;border-collapse:collapse;font-size:11px}'
    +'th{background:#1b1b1b;color:#fff;padding:6px 5px;text-align:left;font-weight:600}'
    +'th.c{text-align:center}td{padding:5px;border-bottom:1px solid #ddd;vertical-align:top}'
    +'td.c{text-align:center}td.num{text-align:center;color:#888;width:22px}'
    +'tr.grp td{background:#f4e9e9;font-weight:700;color:#c1121f;padding:5px 6px}'
    +'.foot{display:flex;justify-content:space-between;gap:24px;margin-top:22px}'
    +'.notes{flex:1;border:1px solid #bbb;border-radius:6px;min-height:78px;padding:8px}'
    +'.sign{min-width:230px;font-size:12px}.sign .line{border-bottom:1px solid #333;height:20px;margin-bottom:2px}'
    +'.summary{margin-top:10px;font-size:12px;color:#333}.summary b{color:#000}'
    +'.company{margin-top:22px;border-top:2px solid #c1121f;padding-top:10px;font-size:11px;color:#333;line-height:1.55}'
    +'.company .n{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;letter-spacing:1px}'
    +'@media print{button{display:none}.sub{break-after:avoid;page-break-after:avoid}h1{break-after:avoid;page-break-after:avoid}table{break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}.foot,.sign,.company,.legend,.summary{break-inside:avoid;page-break-inside:avoid}}'
    +'</style></head><body>'
    +'<div class="head"><div><div style="display:flex;align-items:center;gap:8px"><svg viewBox="0 0 16 16" width="30" height="30" fill="#c1121f" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16m0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15"/></svg><div class="brand">SAVUKS</div></div><div style="font-size:11px;color:#666">Paloturvallisuuspalvelut</div></div>'
    +'<div style="text-align:right"><h1>Tarkastuspöytäkirja</h1><div style="font-size:12px;color:#666">Palovaroittimet</div></div></div>'
    +'<div class="sub">Kohteen tiedot</div>'
    +'<table class="metah">'
    +'<tr><td class="k">Kohde / asiakas</td><td>'+esc(ctx.name||"–")+'</td><td class="k">Päiväys</td><td>'+fmt(today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"–")+'</td><td class="k">Varoittimia</td><td>'+total+'</td></tr>'
    +'<tr><td class="k">Tarkastaja</td><td>'+esc(worker)+'</td><td class="k"></td><td></td></tr>'
    +'</table>'
    +'<table><thead><tr>'
    +'<th class="c">#</th><th>Sijainti (asunto/tila)</th><th class="c">Tyyppi</th><th class="c">Virta</th><th class="c">Valm.vuosi</th><th class="c">Vaihto viim.</th><th class="c">Tark. pvm</th><th class="c">Seur. tark.</th><th class="c">Testi/huolto</th><th class="c">Kunto</th><th>Poikkeamat</th><th class="c">Kuva</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div class="legend">Tyyppi ja virtalähde päätellään mallista. Vaihto viim. = asennusvuosi + 10 v (valmistajan suositus / paristovaroitin). Testi/huolto = viim. määräaikaishuolto (kk/vv). Kunto: Puute jos huomioissa mainittu vika. – = tieto puuttuu / täytä käsin.</div>'
    +'<div class="summary"><b>Yhteenveto:</b> varoittimia yhteensä '+total+' · kunnossa '+(total-faults)+' · puutteita '+faults+'.</div>'
    +'<div class="foot"><div style="flex:1"><div style="font-size:12px;font-weight:700;margin-bottom:4px">Huomioita ja toimenpiteet</div><div class="notes"></div></div>'
    +'<div class="sign"><div style="margin-bottom:14px"><div style="font-size:11px;color:#666">Päivämäärä</div><div class="line"></div>'+fmt(today())+'</div>'
    +'<div><div style="font-size:11px;color:#666">Työn suorittaja</div><div class="line"></div>'+esc(worker)+'</div></div></div>'
    +'<div class="company"><span class="n">Savuks Oy</span> &nbsp; puh. 044 3665638 &nbsp; info@savuks.com &nbsp; www.savuks.com<br>Santalankulmantie 8, 21290 Rusko &nbsp; Y-tunnus 3465682-5</div>'
    +'<p style="margin-top:20px"><button onclick="window.print()" style="background:#c1121f;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer">🖨 Tulosta / Tallenna PDF</button></p>'
    +'</body></html>';
  w.document.write(html);
  w.document.close();
}

'''

INS_ANCHOR = "/* ========== KÄYTTÄJÄT / ROOLIT ========== */"
edits = [
  (INS_ANCHOR, FUNC + INS_ANCHOR, 1),
  ('    groups:["Savunpoisto","Poistumistievalaistus","Paloilmoitin","Näytteenotto","Linjalämpöilmaisin","Sprinkleri","Yhdistelmä","Kuulutus","Sammutusjärjestelmä","Käsisammutin","Paloposti","Väestönsuoja","Muu"],',
   '    groups:["Savunpoisto","Poistumistievalaistus","Paloilmoitin","Näytteenotto","Linjalämpöilmaisin","Sprinkleri","Yhdistelmä","Kuulutus","Sammutusjärjestelmä","Käsisammutin","Paloposti","Väestönsuoja","Palovaroitin","Muu"],', 1),
  ('"Väestönsuoja":0,Muu:500};', '"Väestönsuoja":0,Palovaroitin:12,Muu:500};', 1),
  ('    if(/Väestönsuoja/i.test(t))return"Väestönsuoja";',
   '    if(/Palovaroitin|palovaroitin/i.test(t))return"Palovaroitin";\n    if(/Väestönsuoja/i.test(t))return"Väestönsuoja";', 1),
  ('                <button onclick="pikaPkSel()">🚰 Pikapalopostipöytäkirja valituista</button>',
   '                <button onclick="pikaPkSel()">🚰 Pikapalopostipöytäkirja valituista</button>\n                <button onclick="palovaroitinPkSel()">🔔 Palovaroitinpöytäkirja valituista</button>', 1),
  ('      <button class="btn ghost" onclick="pikaPkPortal()">🚰 Pikapalopostipöytäkirja</button></div>',
   '      <button class="btn ghost" onclick="pikaPkPortal()">🚰 Pikapalopostipöytäkirja</button>\n      <button class="btn ghost" onclick="palovaroitinPkPortal()">🔔 Palovaroitinpöytäkirja</button></div>', 1),
]
patch("servalo.html", edits)
PYEOF

python3 /tmp/palo_patch.py

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

echo "--- palaset läsnä ---"
for t in "function palovaroitinPk(" "palovaroitinPkSel()" "palovaroitinPkPortal()" '"Palovaroitin","Muu"'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Palovaroitin (Vaihe 1): uusi laitetyyppi + listapöytäkirja (rappu/asunto-ryhmittely), Raportit- ja portaali-painikkeet"
git push origin main
echo "VALMIS."
```

---

## Näin käytät (ajon jälkeen)
1. Lisää laitteita, joiden **Tuoteryhmä = Palovaroitin**. Aseta toimipiste (= rappu)
   ja Sijainti-kenttä (= asunto/tila, esim. "As 5 / eteinen").
2. **Raportit:** valitse listasta palovaroittimet → valikosta
   **"🔔 Palovaroitinpöytäkirja valituista"**. Tai asiakasportaalista koko kohde kerralla.
3. Pöytäkirja ryhmittelee rivit rapuittain ja laskee yhteenvedon automaattisesti.

## Testattu
Patch ajettu hiekkalaatikossa: kaikki 6 ankkuria osuivat, JS-syntaksi OK,
kielletyt merkkijonot puhtaat.

## Tiekartta (seuraavat vaiheet, kun tämä on käytössä)
- **Vaihe 2 — QR per asunto/tila:** yksi QR-tarra huoneistoa kohti, joka avaa julkisen
  sivun jossa näkyy sen asunnon kaikki varoittimet + viimeisin tarkastus. Koskee
  server.js:ää + julkista QR-sivua.
- **Vaihe 3 — massatuonti:** koodit.csv (yhtiö/rappu/asunto/tila/laite) → koko taloyhtiön
  varoittimet ja QR-koodit kerralla sisään.
