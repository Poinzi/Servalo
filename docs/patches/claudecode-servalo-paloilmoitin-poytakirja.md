# Claude Code -prompti: paloilmoittimen tarkastuspöytäkirja (pystymalli + puhelinsyöttö)

Aja **Servalo-repon juuressa**. Prompti tekee muutokset, validoi, tarkistaa kielletyt
merkkijonot ja pushaa `main`-haaraan.

> **Riippuvuus:** aja **ensin** `claudecode-servalo-luo-poytakirja.md` (siitä tulee
> `Luo pöytäkirja` -nappi ja reititys). Skripti pysähtyy, jos `function openInspectionPk`
> ei löydy.

## Mitä tämä tekee

Paloilmoitin on tarkastuslista (Kyllä/Ei per kohta), joten pöytäkirja on **pystymalli**
(yksi järjestelmä / sivu) — ei taulukko kuten käsisammuttimissa.

- **Laitekortin `📋 Luo pöytäkirja` -nappi** avaa paloilmoittimelle (kun laitteen ryhmä on
  **Paloilmoitin**) oman **tarkastuslistan** — täytettävissä puhelimella samaan tapaan kuin
  sammuttimet (Kyllä / Ei / Ei koske -valinnat, tekstikentät, päivämäärät, huomiot, kuva).
- **Tallenna + luo pöytäkirja** kirjaa tarkastuksen laitteelle **ja** avaa heti
  Savuks-tyylisen **pystymallin pöytäkirjan** (tulosta / tallenna PDF / jaa).
- **Liitä tai luo:** voit joko liittää valmiin raportin (tiedosto) tai luoda pöytäkirjan
  suoraan täytetyistä kentistä.
- **Jatkuva automaattitallennus** (localStorage) kuten sammuttimissa — kentät ja kuva
  palautuvat, jos ikkuna sulkeutuu tai kenttä pätkii kesken kohteen.

Tarkastuslistan kohdat (muokattavissa myöhemmin):
`1.1–1.4` dokumentit ja määräaikaistarkastus, `2.1–2.5` keskuslaite ja akut,
`3.1–3.4` ilmaisimet ja painikkeet, `4.1–4.4` muut laitteet ja testaukset,
`5.1` kaapelointi, sekä keskustunnus, keskusten määrä ja huomiot.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function openInspectionPk" servalo.html || { echo "VIRHE: openInspectionPk puuttuu — aja ensin claudecode-servalo-luo-poytakirja.md"; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/paloilm_patch.py <<'PYEOF'
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

# 1) Uusi overlay ennen laitetiedostomodaalia
overlay = '''<div class="overlay" id="paloilmOverlay">
  <div class="modal" style="max-width:640px">
    <div class="modal-h"><span>Paloilmoittimen tarkastus</span><span class="x" onclick="closeOverlay('paloilmOverlay')">×</span></div>
    <div class="modal-b" oninput="savePlDraft()" onchange="savePlDraft()">
      <input type="hidden" id="enPlDevId">
      <div class="field"><label>Tapahtumapäivä</label><input class="f" id="enPlDate" type="date"></div>
      <div class="field"><label>Keskustunnus</label><input class="f" id="enPlKeskus" placeholder="esim. TK / keskus 1.1"></div>
      <div class="field"><label>Keskusten määrä</label><input class="f" id="enPlKeskukset" placeholder="esim. 1"></div>
      <div id="plItems"></div>
      <p class="hint" style="margin-top:6px">Valinnat: <b>Kyllä</b> = kunnossa, <b>Ei</b> = puute, <b>Ei koske</b> = ei tarkastettu / ei koske kohdetta.</p>
      <div class="field"><label>Huomiot</label><textarea class="f" id="enPlHuomiot" rows="3" placeholder="Havaitut puutteet / huomiot…"></textarea></div>
      <div class="field"><label>\U0001F4F7 Kuva <span class="hint" style="font-weight:400">(sisäinen – asiakas ei näe)</span></label><input class="f" id="enPlPhoto" type="file" accept="image/*" capture="environment" onchange="previewPlPhoto()"><div id="enPlPhotoPrev" style="margin-top:8px"></div></div>
      <div class="field"><label>Liite (valmis raportti, valinnainen)</label><input class="f" id="enPlFile" type="file"></div>
      <p class="hint">Voit joko liittää valmiin raportin tai luoda pöytäkirjan täytetyistä kentistä.</p>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeOverlay('paloilmOverlay')">Peruuta</button>
      <button class="btn orange" onclick="savePaloilmPk()">Tallenna + luo pöytäkirja</button>
    </div>
  </div>
</div>

<!-- DEVICE FILE MODAL -->'''
rep('<!-- DEVICE FILE MODAL -->', overlay, 1)

# 2) Reititys: paloilmoitin avaa oman lomakkeen
rep('function openInspectionPk(devId){\n  openEntry(devId,"inspections");\n  _pkAfterSave=devId;\n}',
'''function openInspectionPk(devId){
  var _d=db.devices.find(function(x){return x.id===devId;});
  if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}
  openEntry(devId,"inspections");
  _pkAfterSave=devId;
}''', 1)

# 3) Paloilmoitin-toiminnot ennen luonnosmuuttujia
pl = '''const PL_DRAFT_KEY="servalo_paloilm_drafts";
let _plPhoto=null;
const PL_ITEMS=[
 {s:"1. Dokumentit"},
 {id:"c11",l:"1.1 Kohteen dokumentit kunnossa",t:"yn"},
 {id:"c12",l:"1.2 Kuukausikokeet suoritettu ajallaan",t:"yn"},
 {id:"c13",l:"1.3 Tarkastuslaitoksen m\\u00e4\\u00e4r\\u00e4aikaistarkastus voimassa",t:"yn"},
 {id:"c131",l:"1.3.1 M\\u00e4\\u00e4r\\u00e4aikaistarkastus suoritettu",t:"date"},
 {id:"c14",l:"1.4 Paikannuskaaviot kunnossa",t:"yn"},
 {s:"2. Keskuslaite ja akut"},
 {id:"c21",l:"2.1 J\\u00e4rjestelm\\u00e4n silm\\u00e4m\\u00e4\\u00e4r\\u00e4inen tarkistus",t:"yn"},
 {id:"c22",l:"2.2 Keskuslaite kunnossa",t:"yn"},
 {id:"c23",l:"2.3 Akut kunnossa",t:"yn"},
 {id:"c24",l:"2.4 Akkujen tyyppi ja m\\u00e4\\u00e4r\\u00e4",t:"text"},
 {id:"c25",l:"2.5 Akkujen k\\u00e4ytt\\u00f6\\u00f6nottop\\u00e4iv\\u00e4",t:"date"},
 {s:"3. Ilmaisimet ja painikkeet"},
 {id:"c31",l:"3.1 Ilmaisimien huoltoarvojen tarkistus",t:"yn"},
 {id:"c32",l:"3.2 Ilmaisimien tarkastaminen",t:"yn"},
 {id:"c33",l:"3.3 Palopainikkeiden tarkastaminen",t:"yn"},
 {id:"c34",l:"3.4 H\\u00e4lyttimien tarkastaminen",t:"yn"},
 {s:"4. Muut laitteet ja testaukset"},
 {id:"c41",l:"4.1 Muut laitteet tarkastettu",t:"yn"},
 {id:"c42",l:"4.2 Ulkoiset tehol\\u00e4hteet ja akustot",t:"yn"},
 {id:"c43",l:"4.3 Ohjausten ja j\\u00e4lleenantojen testaus",t:"yn"},
 {id:"c44",l:"4.4 H\\u00e4t\\u00e4keskuksen yhteystesti",t:"yn"},
 {s:"5. Kaapelointi"},
 {id:"c51",l:"5.1 Kaapeloinnit kunnossa ja kiinnitetty",t:"yn"}
];
function plItemsHtml(){
  return PL_ITEMS.map(function(it){
    if(it.s)return '<div style="font-weight:700;margin:14px 0 4px;color:#c1121f">'+esc(it.s)+'</div>';
    var inp;
    if(it.t==="yn"){inp='<select class="f" id="pl_'+it.id+'"><option value=""></option><option>Kyll\\u00e4</option><option>Ei</option><option>Ei koske</option></select>';}
    else if(it.t==="date"){inp='<input class="f" id="pl_'+it.id+'" type="date">';}
    else{inp='<input class="f" id="pl_'+it.id+'">';}
    return '<div class="field" style="display:flex;align-items:center;gap:10px"><label style="flex:1;margin:0">'+esc(it.l)+'</label><div style="width:160px">'+inp+'</div></div>';
  }).join("");
}
function readPlDrafts(){try{return JSON.parse(localStorage.getItem(PL_DRAFT_KEY)||"{}");}catch(e){return {};}}
function collectPl(){
  var items={};PL_ITEMS.forEach(function(it){if(it.id){var el=document.getElementById("pl_"+it.id);items[it.id]=el?el.value:"";}});
  return {
    date:document.getElementById("enPlDate").value||today(),
    keskus:document.getElementById("enPlKeskus").value,
    keskukset:document.getElementById("enPlKeskukset").value,
    huomiot:document.getElementById("enPlHuomiot").value,
    items:items,
    photo:_plPhoto
  };
}
function savePlDraft(){
  var id=document.getElementById("enPlDevId").value;if(!id)return;
  var all=readPlDrafts();var a=collectPl();a.ts=Date.now();all[id]=a;
  try{localStorage.setItem(PL_DRAFT_KEY,JSON.stringify(all));}catch(e){}
}
function clearPlDraft(id){var all=readPlDrafts();delete all[id];try{localStorage.setItem(PL_DRAFT_KEY,JSON.stringify(all));}catch(e){}}
function previewPlPhoto(){
  var pi=document.getElementById("enPlPhoto"),pp=document.getElementById("enPlPhotoPrev");
  if(!pi||!pp)return;pp.innerHTML="";
  var fl=pi.files&&pi.files[0];if(!fl)return;
  if(fl.size>4*1024*1024){alert("Kuva on liian suuri (max ~4 MB).");pi.value="";return;}
  var r=new FileReader();
  r.onload=function(){pp.innerHTML='<img src="'+r.result+'" alt="Esikatselu" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px">';_plPhoto={name:fl.name,type:fl.type,data:r.result};savePlDraft();};
  r.readAsDataURL(fl);
}
function openPaloilmPk(devId){
  if(!can("devices_edit"))return;
  document.getElementById("enPlDevId").value=devId;
  document.getElementById("plItems").innerHTML=plItemsHtml();
  document.getElementById("enPlDate").value=today();
  document.getElementById("enPlKeskus").value="";
  document.getElementById("enPlKeskukset").value="";
  document.getElementById("enPlHuomiot").value="";
  var pf=document.getElementById("enPlPhoto"),pp=document.getElementById("enPlPhotoPrev"),ff=document.getElementById("enPlFile");
  if(pf)pf.value="";if(pp)pp.innerHTML="";if(ff)ff.value="";_plPhoto=null;
  var dr=readPlDrafts()[devId];
  if(dr){
    if(dr.date)document.getElementById("enPlDate").value=dr.date;
    if(dr.keskus)document.getElementById("enPlKeskus").value=dr.keskus;
    if(dr.keskukset)document.getElementById("enPlKeskukset").value=dr.keskukset;
    if(dr.huomiot)document.getElementById("enPlHuomiot").value=dr.huomiot;
    if(dr.items)PL_ITEMS.forEach(function(it){if(it.id&&dr.items[it.id]!=null){var el=document.getElementById("pl_"+it.id);if(el)el.value=dr.items[it.id];}});
    if(dr.photo){_plPhoto=dr.photo;if(pp)pp.innerHTML='<img src="'+dr.photo.data+'" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px"><div class="hint">Palautettu tallentamaton kuva</div>';}
  }
  show("paloilmOverlay");
}
function savePaloilmPk(){
  var devId=document.getElementById("enPlDevId").value;
  var d=db.devices.find(function(x){return x.id===devId;});if(!d)return;
  var ans=collectPl();
  var entry={date:ans.date,pohja:"Paloilmoittimen m\\u00e4\\u00e4r\\u00e4aikaishuolto",comment:(ans.huomiot||"").trim(),checklist:ans};
  if(_plPhoto)entry.photo=_plPhoto;
  var finalize=function(){
    d.inspections=d.inspections||[];
    d.inspections.unshift(entry);
    d.inspInterval=d.inspInterval||d.interval;
    d.inspLast=entry.date;d.inspNext=addInterval(entry.date,d.inspInterval||d.interval);
    d.updated=today();save();clearPlDraft(devId);closeOverlay("paloilmOverlay");renderDevTab();
    paloilmoitinPk(d,pkCtxFor(d),ans);
  };
  var ff=document.getElementById("enPlFile");
  if(ff&&ff.files&&ff.files[0]){
    var fl=ff.files[0];
    if(fl.size>4*1024*1024){alert("Tiedosto on liian suuri (max ~4 MB).");return;}
    var r=new FileReader();
    r.onload=function(){entry.file={name:fl.name,type:fl.type,data:r.result};finalize();};
    r.onerror=function(){alert("Tiedoston luku ep\\u00e4onnistui.");};
    r.readAsDataURL(fl);
  } else finalize();
}
function paloilmoitinPk(dev,ctx,ans){
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
  var rows=PL_ITEMS.map(function(it){
    if(it.s)return '<tr><td colspan="2" class="sec">'+esc(it.s)+'</td></tr>';
    var v=(ans.items&&ans.items[it.id])||"";
    var disp=(it.t==="date"&&v)?fmt(v):val(v);
    return '<tr><td>'+esc(it.l)+'</td><td class="v">'+disp+'</td></tr>';
  }).join("");
  var ph=(dev.inspections&&dev.inspections[0]&&dev.inspections[0].photo&&dev.inspections[0].photo.data)||(ans.photo&&ans.photo.data)||"";
  var photoHtml=ph?('<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">Kuva</div><img src="'+ph+'" style="max-width:300px;max-height:300px;border:1px solid #ccc;border-radius:6px"></div>'):"";
  var worker=currentUser?currentUser.name:"";
  var site=esc(dev.locDetail||siteName(dev.locId)||"");
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Paloilmoittimen tarkastusp\\u00f6yt\\u00e4kirja</title>'
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
    +'<div style="text-align:right"><h1>Tarkastusp\\u00f6yt\\u00e4kirja</h1><div style="font-size:12px;color:#666">Paloilmoitinj\\u00e4rjestelm\\u00e4</div></div></div>'
    +'<table class="meta">'
    +'<tr><td class="k">Asiakas</td><td>'+esc(ctx.name||"\\u2013")+'</td><td class="k">P\\u00e4iv\\u00e4ys</td><td>'+fmt(ans.date||today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"\\u2013")+'</td><td class="k">Sijainti</td><td>'+site+'</td></tr>'
    +'<tr><td class="k">Laitetunnus</td><td>'+esc(dev.tag||"\\u2013")+'</td><td class="k">Keskustunnus</td><td>'+esc(ans.keskus||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Keskusten m\\u00e4\\u00e4r\\u00e4</td><td>'+esc(ans.keskukset||"\\u2013")+'</td><td class="k">Tarkastusv\\u00e4li</td><td>'+esc(dev.inspInterval||dev.interval||"\\u2013")+'</td></tr>'
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
rep('const DRAFT_KEY="servalo_entry_drafts";', pl, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/paloilm_patch.py

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
for t in "function openPaloilmPk" "function savePaloilmPk" "function paloilmoitinPk" "function plItemsHtml" "function savePlDraft" "id=\"paloilmOverlay\"" "servalo_paloilm_drafts" "Paloilmoitinj"; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Malliyhtiön (IKASET/PAP/IDR ym.) tunnisteet EIVÄT ole vuotaneet ---"
if grep -niE "IKASET|Tamrex|Autismis|Turunen|Airiainen|Lintuhyt|Vatialantie|Kultavuoren|sami\.sevon|153124|100804|180041|1569797" servalo.html; then
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
git commit -m "Paloilmoittimen tarkastuspoytakirja: pystymalli + puhelinsyotto + automaattitallennus"
git push origin main
echo "VALMIS."
```

---

## Huom
- Nappi reitittää automaattisesti: **Paloilmoitin**-ryhmän laitteella `Luo pöytäkirja`
  avaa tämän tarkastuslistan; käsisammuttimet ja muut säilyvät ennallaan.
- Pöytäkirja on **pystymalli** (A4), yksi järjestelmä. Kyllä = vihreä, Ei = punainen,
  Ei koske = harmaa.
- Voit **liittää** valmiin raportin (tiedostokenttä) tai **luoda** pöytäkirjan kentistä.
- Tarkastuslistan kohdat ovat `PL_ITEMS`-taulukossa — kerro, jos haluat lisätä/muokata
  kohtia tai järjestystä.
- Puhelinnumero kirjoitetaan välilyönnillä (`044 3665638`), joten kiellettyjen vahti ei
  laukea.
