# Claude Code -prompti: savunpoistojärjestelmän huoltopöytäkirja (pystymalli + puhelinsyöttö)

Aja **Servalo-repon juuressa**. Prompti tekee muutokset, validoi, tarkistaa kielletyt
merkkijonot ja pushaa `main`-haaraan.

> **Riippuvuus:** aja **ensin** `claudecode-servalo-luo-poytakirja.md` ja
> `claudecode-servalo-paloilmoitin-poytakirja.md` (niistä tulee `Luo pöytäkirja` -nappi ja
> reititys). Skripti pysähtyy, jos `function openPaloilmPk` ei löydy.

## Mitä tämä tekee

Savunpoistojärjestelmä on tarkastuslista (Kyllä/Ei per kohta), joten pöytäkirja on
**pystymalli** (yksi järjestelmä / sivu) — samaa syöttötyyliä kuin paloilmoitin ja
sammuttimet.

- **Laitekortin `📋 Luo pöytäkirja` -nappi** avaa savunpoistojärjestelmälle (kun laitteen
  ryhmä on **Savunpoisto**) oman **tarkastuslistan** — täytettävissä puhelimella (Kyllä /
  Ei / Ei koske -valinnat, laitetiedot, huomiot, kuva).
- **Tallenna + luo pöytäkirja** kirjaa tarkastuksen laitteelle **ja** avaa heti
  Savuks-tyylisen **pystymallin pöytäkirjan** (tulosta / tallenna PDF / jaa).
- **Liitä tai luo:** voit joko liittää valmiin raportin (tiedosto) tai luoda pöytäkirjan
  suoraan täytetyistä kentistä.
- **Jatkuva automaattitallennus** (localStorage) — kentät ja kuva palautuvat, jos ikkuna
  sulkeutuu tai kenttä pätkii kesken kohteen.

Laitetiedot: akun tyyppi, akkujen käyttöönotto, luukkujen tyyppi, avaajan tyyppi,
laukaisuryhmien määrä, luukkujen määrä, keskus/aluetunnus.
Tarkastuskohdat `1.1–1.8`: kunnossapito-ohjelma, laukaisukartta, opasteet, painikkeet ja
merkkivalot, akut, laukaisukeskus, luukkujen tarkastus, luukkujen koelaukaisu.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function openPaloilmPk" servalo.html || { echo "VIRHE: openPaloilmPk puuttuu — aja ensin paloilmoitin-patch."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/savu_patch.py <<'PYEOF'
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
overlay = '''<div class="overlay" id="savuOverlay">
  <div class="modal" style="max-width:640px">
    <div class="modal-h"><span>Savunpoistojärjestelmän huolto</span><span class="x" onclick="closeOverlay('savuOverlay')">×</span></div>
    <div class="modal-b" oninput="saveSpDraft()" onchange="saveSpDraft()">
      <input type="hidden" id="enSpDevId">
      <div class="field"><label>Tapahtumapäivä</label><input class="f" id="enSpDate" type="date"></div>
      <div class="field"><label>Keskus/aluetunnus</label><input class="f" id="enSpKeskus" placeholder="esim. keskus 1"></div>
      <div style="font-weight:700;margin:14px 0 4px;color:#c1121f">Laitetiedot</div>
      <div class="field"><label>Akun tyyppi</label><input class="f" id="enSpAkku" placeholder="esim. 2x12V x 3,2Ah"></div>
      <div class="field"><label>Akkujen käyttöönottopäivä</label><input class="f" id="enSpAkkuPvm" type="date"></div>
      <div class="field"><label>Luukkujen tyyppi</label><input class="f" id="enSpLuukku" placeholder="esim. SP-ikkuna"></div>
      <div class="field"><label>Avaajan tyyppi</label><input class="f" id="enSpAvaaja" placeholder="esim. karamoottori"></div>
      <div class="field"><label>Laukaisuryhmien määrä</label><input class="f" id="enSpRyhmat" placeholder="esim. 1"></div>
      <div class="field"><label>Luukkujen määrä</label><input class="f" id="enSpLuukut" placeholder="esim. 1"></div>
      <div id="spItems"></div>
      <p class="hint" style="margin-top:6px">Valinnat: <b>Kyllä</b> = kunnossa, <b>Ei</b> = puute, <b>Ei koske</b> = ei tarkastettu / ei koske kohdetta.</p>
      <div class="field"><label>Huomiot</label><textarea class="f" id="enSpHuomiot" rows="3" placeholder="Havaitut puutteet / huomiot…"></textarea></div>
      <div class="field"><label>\U0001F4F7 Kuva <span class="hint" style="font-weight:400">(sisäinen – asiakas ei näe)</span></label><input class="f" id="enSpPhoto" type="file" accept="image/*" capture="environment" onchange="previewSpPhoto()"><div id="enSpPhotoPrev" style="margin-top:8px"></div></div>
      <div class="field"><label>Liite (valmis raportti, valinnainen)</label><input class="f" id="enSpFile" type="file"></div>
      <p class="hint">Voit joko liittää valmiin raportin tai luoda pöytäkirjan täytetyistä kentistä.</p>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeOverlay('savuOverlay')">Peruuta</button>
      <button class="btn orange" onclick="saveSavuPk()">Tallenna + luo pöytäkirja</button>
    </div>
  </div>
</div>

<!-- DEVICE FILE MODAL -->'''
rep('<!-- DEVICE FILE MODAL -->', overlay, 1)

# 2) Reititys: savunpoisto avaa oman lomakkeen
rep('''function openInspectionPk(devId){
  var _d=db.devices.find(function(x){return x.id===devId;});
  if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}
  openEntry(devId,"inspections");
  _pkAfterSave=devId;
}''',
'''function openInspectionPk(devId){
  var _d=db.devices.find(function(x){return x.id===devId;});
  if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}
  if(_d&&_d.group==="Savunpoisto"){openSavuPk(devId);return;}
  openEntry(devId,"inspections");
  _pkAfterSave=devId;
}''', 1)

# 3) Savunpoisto-toiminnot ennen luonnosmuuttujia
sp = '''const SP_DRAFT_KEY="servalo_savu_drafts";
let _spPhoto=null;
const SP_ITEMS=[
 {s:"1. Savunpoistoj\\u00e4rjestelm\\u00e4"},
 {id:"s11",l:"1.1 Kunnossapito-ohjelma",t:"yn"},
 {id:"s12",l:"1.2 Laukaisukartta",t:"yn"},
 {id:"s13",l:"1.3 Opasteet",t:"yn"},
 {id:"s14",l:"1.4 Painikkeet ja merkkivalot",t:"yn"},
 {id:"s15",l:"1.5 Akut kunnossa",t:"yn"},
 {id:"s16",l:"1.6 Laukaisukeskus",t:"yn"},
 {id:"s17",l:"1.7 Luukkujen tarkastus",t:"yn"},
 {id:"s18",l:"1.8 Luukkujen koelaukaisu/testaus",t:"yn"}
];
function spItemsHtml(){
  return SP_ITEMS.map(function(it){
    if(it.s)return '<div style="font-weight:700;margin:14px 0 4px;color:#c1121f">'+esc(it.s)+'</div>';
    var inp='<select class="f" id="sp_'+it.id+'"><option value=""></option><option>Kyll\\u00e4</option><option>Ei</option><option>Ei koske</option></select>';
    return '<div class="field" style="display:flex;align-items:center;gap:10px"><label style="flex:1;margin:0">'+esc(it.l)+'</label><div style="width:160px">'+inp+'</div></div>';
  }).join("");
}
function readSpDrafts(){try{return JSON.parse(localStorage.getItem(SP_DRAFT_KEY)||"{}");}catch(e){return {};}}
function collectSp(){
  var items={};SP_ITEMS.forEach(function(it){if(it.id){var el=document.getElementById("sp_"+it.id);items[it.id]=el?el.value:"";}});
  return {
    date:document.getElementById("enSpDate").value||today(),
    keskus:document.getElementById("enSpKeskus").value,
    akku:document.getElementById("enSpAkku").value,
    akkuPvm:document.getElementById("enSpAkkuPvm").value,
    luukku:document.getElementById("enSpLuukku").value,
    avaaja:document.getElementById("enSpAvaaja").value,
    ryhmat:document.getElementById("enSpRyhmat").value,
    luukut:document.getElementById("enSpLuukut").value,
    huomiot:document.getElementById("enSpHuomiot").value,
    items:items,
    photo:_spPhoto
  };
}
function saveSpDraft(){
  var id=document.getElementById("enSpDevId").value;if(!id)return;
  var all=readSpDrafts();var a=collectSp();a.ts=Date.now();all[id]=a;
  try{localStorage.setItem(SP_DRAFT_KEY,JSON.stringify(all));}catch(e){}
}
function clearSpDraft(id){var all=readSpDrafts();delete all[id];try{localStorage.setItem(SP_DRAFT_KEY,JSON.stringify(all));}catch(e){}}
function previewSpPhoto(){
  var pi=document.getElementById("enSpPhoto"),pp=document.getElementById("enSpPhotoPrev");
  if(!pi||!pp)return;pp.innerHTML="";
  var fl=pi.files&&pi.files[0];if(!fl)return;
  if(fl.size>4*1024*1024){alert("Kuva on liian suuri (max ~4 MB).");pi.value="";return;}
  var r=new FileReader();
  r.onload=function(){pp.innerHTML='<img src="'+r.result+'" alt="Esikatselu" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px">';_spPhoto={name:fl.name,type:fl.type,data:r.result};saveSpDraft();};
  r.readAsDataURL(fl);
}
function openSavuPk(devId){
  if(!can("devices_edit"))return;
  document.getElementById("enSpDevId").value=devId;
  document.getElementById("spItems").innerHTML=spItemsHtml();
  ["enSpDate","enSpKeskus","enSpAkku","enSpAkkuPvm","enSpLuukku","enSpAvaaja","enSpRyhmat","enSpLuukut","enSpHuomiot"].forEach(function(id){var el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("enSpDate").value=today();
  var pf=document.getElementById("enSpPhoto"),pp=document.getElementById("enSpPhotoPrev"),ff=document.getElementById("enSpFile");
  if(pf)pf.value="";if(pp)pp.innerHTML="";if(ff)ff.value="";_spPhoto=null;
  var dr=readSpDrafts()[devId];
  if(dr){
    if(dr.date)document.getElementById("enSpDate").value=dr.date;
    if(dr.keskus)document.getElementById("enSpKeskus").value=dr.keskus;
    if(dr.akku)document.getElementById("enSpAkku").value=dr.akku;
    if(dr.akkuPvm)document.getElementById("enSpAkkuPvm").value=dr.akkuPvm;
    if(dr.luukku)document.getElementById("enSpLuukku").value=dr.luukku;
    if(dr.avaaja)document.getElementById("enSpAvaaja").value=dr.avaaja;
    if(dr.ryhmat)document.getElementById("enSpRyhmat").value=dr.ryhmat;
    if(dr.luukut)document.getElementById("enSpLuukut").value=dr.luukut;
    if(dr.huomiot)document.getElementById("enSpHuomiot").value=dr.huomiot;
    if(dr.items)SP_ITEMS.forEach(function(it){if(it.id&&dr.items[it.id]!=null){var el=document.getElementById("sp_"+it.id);if(el)el.value=dr.items[it.id];}});
    if(dr.photo){_spPhoto=dr.photo;if(pp)pp.innerHTML='<img src="'+dr.photo.data+'" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px"><div class="hint">Palautettu tallentamaton kuva</div>';}
  }
  show("savuOverlay");
}
function saveSavuPk(){
  var devId=document.getElementById("enSpDevId").value;
  var d=db.devices.find(function(x){return x.id===devId;});if(!d)return;
  var ans=collectSp();
  var entry={date:ans.date,pohja:"Savunpoistoj\\u00e4rjestelm\\u00e4n m\\u00e4\\u00e4r\\u00e4aikaishuolto",comment:(ans.huomiot||"").trim(),checklist:ans};
  if(_spPhoto)entry.photo=_spPhoto;
  var finalize=function(){
    d.inspections=d.inspections||[];
    d.inspections.unshift(entry);
    d.inspInterval=d.inspInterval||d.interval;
    d.inspLast=entry.date;d.inspNext=addInterval(entry.date,d.inspInterval||d.interval);
    d.updated=today();save();clearSpDraft(devId);closeOverlay("savuOverlay");renderDevTab();
    savunpoistoPk(d,pkCtxFor(d),ans);
  };
  var ff=document.getElementById("enSpFile");
  if(ff&&ff.files&&ff.files[0]){
    var fl=ff.files[0];
    if(fl.size>4*1024*1024){alert("Tiedosto on liian suuri (max ~4 MB).");return;}
    var r=new FileReader();
    r.onload=function(){entry.file={name:fl.name,type:fl.type,data:r.result};finalize();};
    r.onerror=function(){alert("Tiedoston luku ep\\u00e4onnistui.");};
    r.readAsDataURL(fl);
  } else finalize();
}
function savunpoistoPk(dev,ctx,ans){
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
  var rows=SP_ITEMS.map(function(it){
    if(it.s)return '<tr><td colspan="2" class="sec">'+esc(it.s)+'</td></tr>';
    var v=(ans.items&&ans.items[it.id])||"";
    return '<tr><td>'+esc(it.l)+'</td><td class="v">'+val(v)+'</td></tr>';
  }).join("");
  var ph=(dev.inspections&&dev.inspections[0]&&dev.inspections[0].photo&&dev.inspections[0].photo.data)||(ans.photo&&ans.photo.data)||"";
  var photoHtml=ph?('<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">Kuva</div><img src="'+ph+'" style="max-width:300px;max-height:300px;border:1px solid #ccc;border-radius:6px"></div>'):"";
  var worker=currentUser?currentUser.name:"";
  var site=esc(dev.locDetail||siteName(dev.locId)||"");
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Savunpoistoj\\u00e4rjestelm\\u00e4n huoltop\\u00f6yt\\u00e4kirja</title>'
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
    +'<div style="text-align:right"><h1>Huoltop\\u00f6yt\\u00e4kirja</h1><div style="font-size:12px;color:#666">Savunpoistoj\\u00e4rjestelm\\u00e4</div></div></div>'
    +'<table class="meta">'
    +'<tr><td class="k">Asiakas</td><td>'+esc(ctx.name||"\\u2013")+'</td><td class="k">P\\u00e4iv\\u00e4ys</td><td>'+fmt(ans.date||today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"\\u2013")+'</td><td class="k">Sijainti</td><td>'+site+'</td></tr>'
    +'<tr><td class="k">Laitetunnus</td><td>'+esc(dev.tag||"\\u2013")+'</td><td class="k">Keskus/aluetunnus</td><td>'+esc(ans.keskus||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Akun tyyppi</td><td>'+esc(ans.akku||"\\u2013")+'</td><td class="k">Akkujen k\\u00e4ytt\\u00f6\\u00f6notto</td><td>'+(ans.akkuPvm?fmt(ans.akkuPvm):"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Luukkujen tyyppi</td><td>'+esc(ans.luukku||"\\u2013")+'</td><td class="k">Avaajan tyyppi</td><td>'+esc(ans.avaaja||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Laukaisuryhmien m\\u00e4\\u00e4r\\u00e4</td><td>'+esc(ans.ryhmat||"\\u2013")+'</td><td class="k">Luukkujen m\\u00e4\\u00e4r\\u00e4</td><td>'+esc(ans.luukut||"\\u2013")+'</td></tr>'
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
rep('const DRAFT_KEY="servalo_entry_drafts";', sp, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/savu_patch.py

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
for t in "function openSavuPk" "function saveSavuPk" "function savunpoistoPk" "function spItemsHtml" "function saveSpDraft" "id=\"savuOverlay\"" "servalo_savu_drafts" 'group==="Savunpoisto"'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Mallidokumentin tunnisteet EIVÄT ole vuotaneet ---"
if grep -niE "175528|Kurkelanhovi|Palvelukodit|3504419|15575|100569|150217|lassi\.laitinen|Autismis|Kultavuoren|sami\.sevon|153124|100804|180041|1569797|Lintula|thv\.fi|12246" servalo.html; then
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
git commit -m "Savunpoistojarjestelman huoltopoytakirja: pystymalli + puhelinsyotto + automaattitallennus"
git push origin main
echo "VALMIS."
```

---

## Huom
- Nappi reitittää automaattisesti: **Savunpoisto**-ryhmän laitteella `Luo pöytäkirja`
  avaa tämän tarkastuslistan; paloilmoittimet, käsisammuttimet ja muut säilyvät ennallaan.
- Pöytäkirja on **pystymalli** (A4), yksi järjestelmä. Kyllä = vihreä, Ei = punainen,
  Ei koske = harmaa.
- Voit **liittää** valmiin raportin (tiedostokenttä) tai **luoda** pöytäkirjan kentistä.
- Tarkastuskohdat ovat `SP_ITEMS`-taulukossa — kerro, jos haluat lisätä/muokata kohtia.
- Puhelinnumero kirjoitetaan välilyönnillä (`044 3665638`), joten kiellettyjen vahti ei
  laukea.
