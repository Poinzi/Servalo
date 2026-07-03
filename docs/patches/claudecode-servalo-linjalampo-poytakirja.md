# Claude Code -prompti: optisen linjalämpöilmaisimen huoltopöytäkirja (pystymalli + puhelinsyöttö)

Aja **Servalo-repon juuressa**. Prompti lisää uuden laiteryhmän **Linjalämpöilmaisin**,
tekee muutokset, validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

> **Riippuvuus:** aja **ensin** `claudecode-servalo-luo-poytakirja.md` ja
> `claudecode-servalo-paloilmoitin-poytakirja.md`. Skripti pysähtyy, jos
> `function openPaloilmPk` ei löydy. Reititys ankkuroidaan Paloilmoitin-riviin, joten
> toimii riippumatta muista laitepatcheista.

## Mitä tämä tekee

Optinen linjalämpöilmaisinjärjestelmä (DTS, kuituilmaisin) on tarkastuslista, joten
pöytäkirja on **pystymalli** — samaa syöttötyyliä kuin muut pöytäkirjat.

- **Lisää uuden laiteryhmän `Linjalämpöilmaisin`** laiteryhmävalikkoon (Näytteenoton perään),
  jotta linjalämpöilmaisimet voi kirjata omalle ryhmälleen.
- **Laitekortin `📋 Luo pöytäkirja` -nappi** avaa linjalämpöilmaisimelle (kun laitteen
  ryhmä on **Linjalämpöilmaisin**) oman **tarkastuslistan** — täytettävissä puhelimella
  (Kyllä / Ei / Ei koske, laitetiedot, huomiot, kuva).
- **Tallenna + luo pöytäkirja** kirjaa tarkastuksen laitteelle **ja** avaa heti
  Savuks-tyylisen **pystymallin pöytäkirjan** (tulosta / tallenna PDF / jaa).
- **Liitä tai luo:** voit joko liittää valmiin raportin (tiedosto) tai luoda pöytäkirjan
  suoraan täytetyistä kentistä.
- **Jatkuva automaattitallennus** (localStorage).

Laitetiedot: ohjelmoidut paloryhmät/osoitteet, akkujen tyyppi, akkujen käyttöönotto.
Tarkastuskohdat: 1. liitäntä paloilmoitinkeskukseen, 2. silmämääräinen tarkastus
(sis. näyttö- ja LED-tilat), 3. akut, 4. ohjelmisto (PC DTS), 5. releet, 6. testaus.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function openPaloilmPk" servalo.html || { echo "VIRHE: openPaloilmPk puuttuu — aja ensin paloilmoitin-patch."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/linja_patch.py <<'PYEOF'
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

# 0) Uusi laiteryhmä ryhmävalikkoon (Näytteenoton perään)
rep('"Näytteenotto","Yhdistelmä"', '"Näytteenotto","Linjalämpöilmaisin","Yhdistelmä"', 1)

# 1) Uusi overlay ennen laitetiedostomodaalia
overlay = '''<div class="overlay" id="linjaOverlay">
  <div class="modal" style="max-width:640px">
    <div class="modal-h"><span>Linjalämpöilmaisimen huolto</span><span class="x" onclick="closeOverlay('linjaOverlay')">×</span></div>
    <div class="modal-b" oninput="saveLlDraft()" onchange="saveLlDraft()">
      <input type="hidden" id="enLlDevId">
      <div class="field"><label>Tapahtumapäivä</label><input class="f" id="enLlDate" type="date"></div>
      <div style="font-weight:700;margin:14px 0 4px;color:#c1121f">Laitetiedot</div>
      <div class="field"><label>Ohjelmoidut paloryhmät/osoitteet</label><input class="f" id="enLlRyhmat" placeholder="esim. 101-112"></div>
      <div class="field"><label>Akkujen tyyppi</label><input class="f" id="enLlAkku" placeholder="esim. 12V 7Ah"></div>
      <div class="field"><label>Akkujen käyttöönottopäivä</label><input class="f" id="enLlAkkuPvm" type="date"></div>
      <div id="llItems"></div>
      <p class="hint" style="margin-top:6px">Valinnat: <b>Kyllä</b> = kunnossa, <b>Ei</b> = puute, <b>Ei koske</b> = ei tarkastettu / ei koske kohdetta.</p>
      <div class="field"><label>Huomiot</label><textarea class="f" id="enLlHuomiot" rows="3" placeholder="Havaitut puutteet / huomiot…"></textarea></div>
      <div class="field"><label>\U0001F4F7 Kuva <span class="hint" style="font-weight:400">(sisäinen – asiakas ei näe)</span></label><input class="f" id="enLlPhoto" type="file" accept="image/*" capture="environment" onchange="previewLlPhoto()"><div id="enLlPhotoPrev" style="margin-top:8px"></div></div>
      <div class="field"><label>Liite (valmis raportti, valinnainen)</label><input class="f" id="enLlFile" type="file"></div>
      <p class="hint">Voit joko liittää valmiin raportin tai luoda pöytäkirjan täytetyistä kentistä.</p>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeOverlay('linjaOverlay')">Peruuta</button>
      <button class="btn orange" onclick="saveLinjaPk()">Tallenna + luo pöytäkirja</button>
    </div>
  </div>
</div>

<!-- DEVICE FILE MODAL -->'''
rep('<!-- DEVICE FILE MODAL -->', overlay, 1)

# 2) Reititys: lisää haara Paloilmoitin-rivin jälkeen
rep('if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}',
'''if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}
  if(_d&&_d.group==="Linjal\\u00e4mp\\u00f6ilmaisin"){openLinjaPk(devId);return;}''', 1)

# 3) Linjalämpö-toiminnot ennen luonnosmuuttujia
ll = '''const LL_DRAFT_KEY="servalo_linja_drafts";
let _llPhoto=null;
const LL_ITEMS=[
 {s:"1. Liit\\u00e4nt\\u00e4 paloilmoitinkeskukseen"},
 {id:"l11",l:"1.1 Irtikytkett\\u00e4viss\\u00e4 paloilmoitinkeskukselta",t:"yn"},
 {id:"l12",l:"1.2 Kuitattavissa paloh\\u00e4lytyksest\\u00e4 palokeskukselta",t:"yn"},
 {id:"l13",l:"1.3 Kuitattavissa vikah\\u00e4lytyksest\\u00e4 palokeskukselta",t:"yn"},
 {s:"2. Silm\\u00e4m\\u00e4\\u00e4r\\u00e4inen tarkastus"},
 {id:"l21",l:"2.1 Silm\\u00e4m\\u00e4\\u00e4r\\u00e4inen tarkastus",t:"yn"},
 {id:"l211",l:"2.1.1 N\\u00e4yt\\u00f6n taustavalo valkoinen tai sininen",t:"yn"},
 {id:"l212",l:"2.1.2 N\\u00e4yt\\u00f6ss\\u00e4 kanavien m\\u00e4\\u00e4r\\u00e4 oikein (yksi-/monikanavainen)",t:"yn"},
 {id:"l213",l:"2.1.3 Rdy LED on (vihre\\u00e4), Fault LED off (keltainen), Alarm LED off (punainen)",t:"yn"},
 {id:"l22",l:"2.2 Keskus, kaapelointi PI:lle, ilmaisinkaapeli ja kiinnikkeet ilman n\\u00e4kyvi\\u00e4 vaurioita",t:"yn"},
 {s:"3. Akut"},
 {id:"l31",l:"3.1 Akut kunnossa",t:"yn"},
 {s:"4. Ohjelmisto (PC DTS)"},
 {id:"l41",l:"4.1 PC DTS yhdistetty, mittaus p\\u00e4\\u00e4ll\\u00e4 ja l\\u00e4mp\\u00f6tilak\\u00e4yr\\u00e4 n\\u00e4kyy",t:"yn"},
 {id:"l42",l:"4.2 Ohjelmaversio tarkastettu / p\\u00e4ivitetty tarvittaessa",t:"yn"},
 {s:"5. Releet"},
 {id:"l51",l:"5.1 Sis\\u00e4isten releiden testaus (DTS configurator) PI:lle",t:"yn"},
 {id:"l52",l:"5.2 Ulkoisten releiden testaus (Vago-relemoduulit)",t:"yn"},
 {id:"l521",l:"5.2.1 Ulkoisten releiden vian testaus PI:lle",t:"yn"},
 {s:"6. Testaus"},
 {id:"l61",l:"6.1 Testattu optisen kuidun l\\u00e4mp\\u00f6testilaitteella",t:"yn"}
];
function llItemsHtml(){
  return LL_ITEMS.map(function(it){
    if(it.s)return '<div style="font-weight:700;margin:14px 0 4px;color:#c1121f">'+esc(it.s)+'</div>';
    var inp='<select class="f" id="ll_'+it.id+'"><option value=""></option><option>Kyll\\u00e4</option><option>Ei</option><option>Ei koske</option></select>';
    return '<div class="field" style="display:flex;align-items:center;gap:10px"><label style="flex:1;margin:0">'+esc(it.l)+'</label><div style="width:160px">'+inp+'</div></div>';
  }).join("");
}
function readLlDrafts(){try{return JSON.parse(localStorage.getItem(LL_DRAFT_KEY)||"{}");}catch(e){return {};}}
function collectLl(){
  var items={};LL_ITEMS.forEach(function(it){if(it.id){var el=document.getElementById("ll_"+it.id);items[it.id]=el?el.value:"";}});
  return {
    date:document.getElementById("enLlDate").value||today(),
    ryhmat:document.getElementById("enLlRyhmat").value,
    akku:document.getElementById("enLlAkku").value,
    akkuPvm:document.getElementById("enLlAkkuPvm").value,
    huomiot:document.getElementById("enLlHuomiot").value,
    items:items,
    photo:_llPhoto
  };
}
function saveLlDraft(){
  var id=document.getElementById("enLlDevId").value;if(!id)return;
  var all=readLlDrafts();var a=collectLl();a.ts=Date.now();all[id]=a;
  try{localStorage.setItem(LL_DRAFT_KEY,JSON.stringify(all));}catch(e){}
}
function clearLlDraft(id){var all=readLlDrafts();delete all[id];try{localStorage.setItem(LL_DRAFT_KEY,JSON.stringify(all));}catch(e){}}
function previewLlPhoto(){
  var pi=document.getElementById("enLlPhoto"),pp=document.getElementById("enLlPhotoPrev");
  if(!pi||!pp)return;pp.innerHTML="";
  var fl=pi.files&&pi.files[0];if(!fl)return;
  if(fl.size>4*1024*1024){alert("Kuva on liian suuri (max ~4 MB).");pi.value="";return;}
  var r=new FileReader();
  r.onload=function(){pp.innerHTML='<img src="'+r.result+'" alt="Esikatselu" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px">';_llPhoto={name:fl.name,type:fl.type,data:r.result};saveLlDraft();};
  r.readAsDataURL(fl);
}
function openLinjaPk(devId){
  if(!can("devices_edit"))return;
  document.getElementById("enLlDevId").value=devId;
  document.getElementById("llItems").innerHTML=llItemsHtml();
  ["enLlDate","enLlRyhmat","enLlAkku","enLlAkkuPvm","enLlHuomiot"].forEach(function(id){var el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("enLlDate").value=today();
  var pf=document.getElementById("enLlPhoto"),pp=document.getElementById("enLlPhotoPrev"),ff=document.getElementById("enLlFile");
  if(pf)pf.value="";if(pp)pp.innerHTML="";if(ff)ff.value="";_llPhoto=null;
  var dr=readLlDrafts()[devId];
  if(dr){
    if(dr.date)document.getElementById("enLlDate").value=dr.date;
    if(dr.ryhmat)document.getElementById("enLlRyhmat").value=dr.ryhmat;
    if(dr.akku)document.getElementById("enLlAkku").value=dr.akku;
    if(dr.akkuPvm)document.getElementById("enLlAkkuPvm").value=dr.akkuPvm;
    if(dr.huomiot)document.getElementById("enLlHuomiot").value=dr.huomiot;
    if(dr.items)LL_ITEMS.forEach(function(it){if(it.id&&dr.items[it.id]!=null){var el=document.getElementById("ll_"+it.id);if(el)el.value=dr.items[it.id];}});
    if(dr.photo){_llPhoto=dr.photo;if(pp)pp.innerHTML='<img src="'+dr.photo.data+'" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px"><div class="hint">Palautettu tallentamaton kuva</div>';}
  }
  show("linjaOverlay");
}
function saveLinjaPk(){
  var devId=document.getElementById("enLlDevId").value;
  var d=db.devices.find(function(x){return x.id===devId;});if(!d)return;
  var ans=collectLl();
  var entry={date:ans.date,pohja:"Linjal\\u00e4mp\\u00f6ilmaisimen m\\u00e4\\u00e4r\\u00e4aikaishuolto",comment:(ans.huomiot||"").trim(),checklist:ans};
  if(_llPhoto)entry.photo=_llPhoto;
  var finalize=function(){
    d.inspections=d.inspections||[];
    d.inspections.unshift(entry);
    d.inspInterval=d.inspInterval||d.interval;
    d.inspLast=entry.date;d.inspNext=addInterval(entry.date,d.inspInterval||d.interval);
    d.updated=today();save();clearLlDraft(devId);closeOverlay("linjaOverlay");renderDevTab();
    linjaPk(d,pkCtxFor(d),ans);
  };
  var ff=document.getElementById("enLlFile");
  if(ff&&ff.files&&ff.files[0]){
    var fl=ff.files[0];
    if(fl.size>4*1024*1024){alert("Tiedosto on liian suuri (max ~4 MB).");return;}
    var r=new FileReader();
    r.onload=function(){entry.file={name:fl.name,type:fl.type,data:r.result};finalize();};
    r.onerror=function(){alert("Tiedoston luku ep\\u00e4onnistui.");};
    r.readAsDataURL(fl);
  } else finalize();
}
function linjaPk(dev,ctx,ans){
  ctx=ctx||{name:"",address:""};ans=ans||{items:{}};
  var w=window.open("","_blank");
  if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  var val=function(v){
    if(v==="Kyll\\u00e4")return '<span style="color:#1a7f37;font-weight:700">Kyll\\u00e4</span>';
    if(v==="Ei")return '<span style="color:#c1121f;font-weight:700">Ei</span>';
    if(v==="Ei koske")return '<span style="color:#888">Ei koske</span>';
    if(v)return esc(v);
    return '<span style="color:#bbb">\\u2013</span>';
  };
  var rows=LL_ITEMS.map(function(it){
    if(it.s)return '<tr><td colspan="2" class="sec">'+esc(it.s)+'</td></tr>';
    var v=(ans.items&&ans.items[it.id])||"";
    return '<tr><td>'+esc(it.l)+'</td><td class="v">'+val(v)+'</td></tr>';
  }).join("");
  var ph=(dev.inspections&&dev.inspections[0]&&dev.inspections[0].photo&&dev.inspections[0].photo.data)||(ans.photo&&ans.photo.data)||"";
  var photoHtml=ph?('<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">Kuva</div><img src="'+ph+'" style="max-width:300px;max-height:300px;border:1px solid #ccc;border-radius:6px"></div>'):"";
  var worker=currentUser?currentUser.name:"";
  var site=esc(dev.locDetail||siteName(dev.locId)||"");
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Linjal\\u00e4mp\\u00f6ilmaisimen huoltop\\u00f6yt\\u00e4kirja</title>'
    +'<style>'
    +'body{font-family:"Trebuchet MS",Verdana,Geneva,sans-serif;color:#1b1b1b;margin:26px;max-width:740px}'
    +'h1{font-family:Georgia,"Times New Roman",serif;font-size:20px;letter-spacing:.4px;margin:0}'
    +'.brand{font-family:Georgia,serif;font-size:26px;font-weight:700;color:#c1121f;letter-spacing:3px}'
    +'.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c1121f;padding-bottom:12px}'
    +'.meta{width:100%;border-collapse:collapse;font-size:12px;margin:14px 0}'
    +'.meta td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top}.meta td.k{color:#666;width:150px}'
    +'table.chk{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}'
    +'table.chk td{padding:6px 8px;border-bottom:1px solid #e6e6e6;vertical-align:top}'
    +'table.chk td.v{width:160px;text-align:right}'
    +'table.chk td.sec{background:#f4f4f4;font-family:Georgia,serif;font-weight:700;color:#c1121f;border-bottom:1px solid #ddd}'
    +'.huom{margin-top:16px;border:1px solid #bbb;border-radius:6px;min-height:60px;padding:10px;font-size:12px}'
    +'.foot{display:flex;justify-content:space-between;gap:24px;margin-top:22px}'
    +'.sign{min-width:230px;font-size:12px}.sign .line{border-bottom:1px solid #333;height:20px;margin-bottom:2px}'
    +'.company{margin-top:22px;border-top:2px solid #c1121f;padding-top:10px;font-size:11px;color:#333;line-height:1.55}'
    +'.company .n{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;letter-spacing:1px}'
    +'@media print{button{display:none}}'
    +'</style></head><body>'
    +'<div class="head"><div><div class="brand">SAVUKS</div><div style="font-size:11px;color:#666">Paloturvallisuuspalvelut</div></div>'
    +'<div style="text-align:right"><h1>Huoltop\\u00f6yt\\u00e4kirja</h1><div style="font-size:12px;color:#666">Optinen linjal\\u00e4mp\\u00f6ilmaisin (DTS)</div></div></div>'
    +'<table class="meta">'
    +'<tr><td class="k">Asiakas</td><td>'+esc(ctx.name||"\\u2013")+'</td><td class="k">P\\u00e4iv\\u00e4ys</td><td>'+fmt(ans.date||today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"\\u2013")+'</td><td class="k">Sijainti</td><td>'+site+'</td></tr>'
    +'<tr><td class="k">Laitetunnus</td><td>'+esc(dev.tag||"\\u2013")+'</td><td class="k">Ohjelmoidut paloryhm\\u00e4t/osoitteet</td><td>'+esc(ans.ryhmat||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Akkujen tyyppi</td><td>'+esc(ans.akku||"\\u2013")+'</td><td class="k">Akkujen k\\u00e4ytt\\u00f6\\u00f6notto</td><td>'+(ans.akkuPvm?fmt(ans.akkuPvm):"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Tarkastusv\\u00e4li</td><td>'+esc(dev.inspInterval||dev.interval||"\\u2013")+'</td><td class="k"></td><td></td></tr>'
    +'</table>'
    +'<table class="chk"><tbody>'+rows+'</tbody></table>'
    +'<div style="margin-top:16px;font-size:12px;font-weight:700">Huomiot</div><div class="huom">'+esc(ans.huomiot||"")+'</div>'
    +photoHtml
    +'<div class="foot"><div class="sign"><div style="margin-bottom:14px"><div style="font-size:11px;color:#666">P\\u00e4iv\\u00e4m\\u00e4\\u00e4r\\u00e4</div><div class="line"></div>'+fmt(ans.date||today())+'</div>'
    +'<div><div style="font-size:11px;color:#666">Ty\\u00f6n suorittaja</div><div class="line"></div>'+esc(worker)+'</div></div></div>'
    +'<div class="company"><span class="n">SAVUKS</span> &nbsp; puh. 044 3665638 &nbsp; info@savuks.com &nbsp; www.savuks.com<br>Santalankulmantie 8, 21290 Rusko &nbsp; Y-tunnus 3465682-5</div>'
    +'<p style="margin-top:20px"><button onclick="window.print()" style="background:#c1121f;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer">\\U0001f5a8 Tulosta / Tallenna PDF</button></p>'
    +'</body></html>';
  w.document.write(html);
  w.document.close();
}
const DRAFT_KEY="servalo_entry_drafts";'''
rep('const DRAFT_KEY="servalo_entry_drafts";', ll, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/linja_patch.py

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
for t in "function openLinjaPk" "function saveLinjaPk" "function linjaPk" "function llItemsHtml" "function saveLlDraft" "id=\"linjaOverlay\"" "servalo_linja_drafts" "{openLinjaPk(devId);return;}" '"Linjalämpöilmaisin"'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Mallidokumentin tunnisteet EIVÄT ole vuotaneet ---"
if grep -niE "184604|184564|601506|Nokia Areena|Monitoimiareena|2792951|100908|sami\.sevon|aleksi\.kivela|184939|Areenahotelli|2867838|100906|175529|175528|FINNTEK|Kurkelanhovi|Palvelukodit|3504419|15575|100569|150217|lassi\.laitinen" servalo.html; then
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
git commit -m "Linjalampoilmaisimen huoltopoytakirja + uusi laiteryhma: pystymalli + puhelinsyotto"
git push origin main
echo "VALMIS."
```

---

## Huom
- Prompti lisää laiteryhmän **Linjalämpöilmaisin**. Aseta linjalämpöilmaisin-laitteille tämä
  ryhmä, niin `Luo pöytäkirja` avaa tämän tarkastuslistan.
- Pöytäkirja on **pystymalli** (A4). Kyllä = vihreä, Ei = punainen, Ei koske = harmaa.
- Voit **liittää** valmiin raportin tai **luoda** pöytäkirjan kentistä.
- Tarkastuskohdat ovat `LL_ITEMS`-taulukossa — kerro, jos haluat lisätä/muokata kohtia.
- Puhelinnumero kirjoitetaan välilyönnillä (`044 3665638`).
