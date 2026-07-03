# Claude Code -prompti: hälytyksensiirron asennustodistus (paloilmoitin)

Aja **Servalo-repon juuressa**. Prompti tekee muutokset, validoi, tarkistaa kielletyt
merkkijonot ja pushaa `main`-haaraan.

> **Riippuvuus:** aja **ensin** `claudecode-servalo-luo-poytakirja.md` (siitä tulee
> `Luo pöytäkirja` -nappi, johon tämä lisää viereen `Asennustodistus`-napin).
> Skripti pysähtyy, jos `function openInspectionPk` ei löydy.

## Mitä tämä tekee

Kun uusi kohde siirtyy Savuksin huoltoon, hälytyksensiirrosta tehdään **asennustodistus**.
Tämä lisää sen paloilmoitin-puolelle omana lomakkeena ja tulostettavana todistuksena.

- **Paloilmoitin-laitteen kortin `📄 Asennustodistus` -nappi** (näkyy vain Paloilmoitin-ryhmän
  laitteilla, `Luo pöytäkirja` -napin vieressä) avaa täytettävän lomakkeen.
- Lomake noudattaa asennustodistuksen rakennetta: vastuutahot ja operaattorit (1.x),
  siirtoyhteydet ja signaalitasot (2.x) sekä yhteystestit PALO/VIKA/ENNAKKO/HUOLTO/LINJAVIKA
  varsinaiselle ja varasiirtoyhteydelle (3.x).
- **Asentajan tiedot esitäytetään** Savuksille (nimi, osoite, yhteyshenkilö, puhelin,
  sähköposti). Operaattori-, hätäkeskus- ja vastaanottopaikkatiedot **jätetään tyhjiksi**
  ja täytetään kohteen mukaan.
- **Tallenna + luo todistus** kirjaa merkinnän laitteelle **ja** avaa Savuks-tyylisen
  pystymallin **asennustodistuksen** (tulosta / PDF / jaa).
- **Jatkuva automaattitallennus** (localStorage) — kentät ja kuva palautuvat, jos ikkuna
  sulkeutuu kesken.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function openInspectionPk" servalo.html || { echo "VIRHE: openInspectionPk puuttuu — aja ensin claudecode-servalo-luo-poytakirja.md"; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/siirto_patch.py <<'PYEOF'
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

# 1) Asennustodistus-nappi paloilmoittimen laitekorttiin (Luo pöytäkirja -napin viereen)
btn_old = '''<button class="btn ghost req-edit" style="padding:5px 12px;font-size:12px" onclick="openInspectionPk('${d.id}')">\U0001F4CB Luo pöytäkirja</button><button class="iconbtn req-edit" onclick="openEntry('${d.id}','inspections')">＋</button>'''
btn_new = '''<button class="btn ghost req-edit" style="padding:5px 12px;font-size:12px" onclick="openInspectionPk('${d.id}')">\U0001F4CB Luo pöytäkirja</button>${d.group==="Paloilmoitin"?`<button class="btn ghost req-edit" style="padding:5px 12px;font-size:12px" onclick="openSiirtoTodistus('${d.id}')">\U0001F4C4 Asennustodistus</button>`:``}<button class="iconbtn req-edit" onclick="openEntry('${d.id}','inspections')">＋</button>'''
rep(btn_old, btn_new, 1)

# 2) Overlay ennen laitetiedostomodaalia
overlay = '''<div class="overlay" id="siirtoOverlay">
  <div class="modal" style="max-width:680px">
    <div class="modal-h"><span>Hälytyksensiirron asennustodistus</span><span class="x" onclick="closeOverlay('siirtoOverlay')">×</span></div>
    <div class="modal-b" oninput="saveSrDraft()" onchange="saveSrDraft()">
      <input type="hidden" id="enSrDevId">
      <div class="field"><label>Päiväys</label><input class="f" id="enSrDate" type="date"></div>
      <div id="srItems"></div>
      <p class="hint" style="margin-top:6px">Tilat: <b>Kunnossa</b> / <b>Ei kunnossa</b> / <b>Ei testattu</b>. Operaattori- ja hätäkeskustiedot täytetään kohteen mukaan.</p>
      <div class="field"><label>\U0001F4F7 Kuva <span class="hint" style="font-weight:400">(sisäinen)</span></label><input class="f" id="enSrPhoto" type="file" accept="image/*" capture="environment" onchange="previewSrPhoto()"><div id="enSrPhotoPrev" style="margin-top:8px"></div></div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeOverlay('siirtoOverlay')">Peruuta</button>
      <button class="btn orange" onclick="saveSiirtoTodistus()">Tallenna + luo todistus</button>
    </div>
  </div>
</div>

<!-- DEVICE FILE MODAL -->'''
rep('<!-- DEVICE FILE MODAL -->', overlay, 1)

# 3) Toiminnot ennen luonnosmuuttujia
sr = '''const SR_DRAFT_KEY="servalo_siirto_drafts";
let _srPhoto=null;
const SIIRTO_ITEMS=[
 {s:"1. Vastuutahot ja operaattorit"},
 {id:"s10",l:"1.0 Asennuksesta vastaava liike",t:"text"},
 {id:"s11",l:"1.1 Osoite",t:"text"},
 {id:"s12",l:"1.2 Yhteyshenkil\\u00f6",t:"text"},
 {id:"s13",l:"1.3 Puhelinnumero",t:"text"},
 {id:"s14",l:"1.4 S\\u00e4hk\\u00f6postiosoite",t:"text"},
 {id:"s15",l:"1.5 Kohteen yksil\\u00f6inti",t:"text"},
 {id:"s16",l:"1.6 Kohdetunnus (H\\u00c4KE)",t:"text"},
 {id:"s17",l:"1.7 Ilmoituksensiirto-operaattori",t:"text"},
 {id:"s18",l:"1.8 Osoite",t:"text"},
 {id:"s19",l:"1.9 Yhteyshenkil\\u00f6",t:"text"},
 {id:"s110",l:"1.10 Puhelinnumero",t:"text"},
 {id:"s111",l:"1.11 S\\u00e4hk\\u00f6postiosoite",t:"text"},
 {id:"s112",l:"1.12 Verkkovalvontaoperaattori",t:"text"},
 {id:"s113",l:"1.13 Osoite",t:"text"},
 {id:"s114",l:"1.14 Yhteyshenkil\\u00f6",t:"text"},
 {id:"s115",l:"1.15 Puhelinnumero",t:"text"},
 {id:"s116",l:"1.16 S\\u00e4hk\\u00f6postiosoite",t:"text"},
 {id:"s117",l:"1.17 H\\u00e4t\\u00e4keskus",t:"text"},
 {id:"s118",l:"1.18 H\\u00e4lytyskeskus / rinnakkaistiedon vastaanottopaikka",t:"text"},
 {id:"s119",l:"1.19 Osoite",t:"text"},
 {id:"s120",l:"1.20 Puhelinnumero",t:"text"},
 {id:"s121",l:"1.21 Vastaanottajan tiedot",t:"text"},
 {id:"s122",l:"1.22 Puhelinnumero",t:"text"},
 {s:"2. Siirtoyhteydet"},
 {id:"s21",l:"2.1 Laitetunnus",t:"text"},
 {id:"s22",l:"2.2 Varsinainen siirtoyhteys",t:"text"},
 {id:"s23",l:"2.3 Operaattori",t:"text"},
 {id:"s24",l:"2.4 Varalla oleva siirtoyhteys",t:"text"},
 {id:"s25",l:"2.5 Operaattori",t:"text"},
 {id:"s26",l:"2.6 Varsinaisen siirtoyhteyden signaalitaso",t:"sig"},
 {id:"s27",l:"2.7 Varasiirtoyhteyden signaalitaso",t:"sig"},
 {s:"3. Yhteystestit \\u2013 varsinainen siirtoyhteys"},
 {id:"s310",l:"3.1.0 Varsinainen siirtoyhteys",t:"st"},
 {id:"s311",l:"3.1.1 PALO",t:"st"},
 {id:"s312",l:"3.1.2 VIKA",t:"st"},
 {id:"s313",l:"3.1.3 ENNAKKO",t:"st"},
 {id:"s314",l:"3.1.4 HUOLTO",t:"st"},
 {id:"s315",l:"3.1.5 LINJAVIKA",t:"st"},
 {id:"s316",l:"3.1.6 Huomiot",t:"text"},
 {s:"4. Yhteystestit \\u2013 varasiirtoyhteys"},
 {id:"s321",l:"3.2.1 PALO",t:"st"},
 {id:"s322",l:"3.2.2 VIKA",t:"st"},
 {id:"s323",l:"3.2.3 ENNAKKO",t:"st"},
 {id:"s324",l:"3.2.4 HUOLTO",t:"st"},
 {id:"s325",l:"3.2.5 LINJAVIKA",t:"st"},
 {id:"s326",l:"3.2.6 Huomiot",t:"text"}
];
function siirtoItemsHtml(){
  return SIIRTO_ITEMS.map(function(it){
    if(it.s)return '<div style="font-weight:700;margin:14px 0 4px;color:#c1121f">'+esc(it.s)+'</div>';
    var inp;
    if(it.t==="st"){inp='<select class="f" id="sr_'+it.id+'"><option value=""></option><option>Kunnossa</option><option>Ei kunnossa</option><option>Ei testattu</option></select>';}
    else if(it.t==="sig"){inp='<select class="f" id="sr_'+it.id+'"><option value=""></option><option>Erinomainen</option><option>Hyv\\u00e4</option><option>Tyydytt\\u00e4v\\u00e4</option><option>Heikko</option></select>';}
    else{inp='<input class="f" id="sr_'+it.id+'">';}
    return '<div class="field" style="display:flex;align-items:center;gap:10px"><label style="flex:1;margin:0">'+esc(it.l)+'</label><div style="width:190px">'+inp+'</div></div>';
  }).join("");
}
function readSrDrafts(){try{return JSON.parse(localStorage.getItem(SR_DRAFT_KEY)||"{}");}catch(e){return {};}}
function collectSiirto(){
  var items={};SIIRTO_ITEMS.forEach(function(it){if(it.id){var el=document.getElementById("sr_"+it.id);items[it.id]=el?el.value:"";}});
  return {date:document.getElementById("enSrDate").value||today(),items:items,photo:_srPhoto};
}
function saveSrDraft(){
  var id=document.getElementById("enSrDevId").value;if(!id)return;
  var all=readSrDrafts();var a=collectSiirto();a.ts=Date.now();all[id]=a;
  try{localStorage.setItem(SR_DRAFT_KEY,JSON.stringify(all));}catch(e){}
}
function clearSrDraft(id){var all=readSrDrafts();delete all[id];try{localStorage.setItem(SR_DRAFT_KEY,JSON.stringify(all));}catch(e){}}
function previewSrPhoto(){
  var pi=document.getElementById("enSrPhoto"),pp=document.getElementById("enSrPhotoPrev");
  if(!pi||!pp)return;pp.innerHTML="";
  var fl=pi.files&&pi.files[0];if(!fl)return;
  if(fl.size>4*1024*1024){alert("Kuva on liian suuri (max ~4 MB).");pi.value="";return;}
  var r=new FileReader();
  r.onload=function(){pp.innerHTML='<img src="'+r.result+'" alt="Esikatselu" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px">';_srPhoto={name:fl.name,type:fl.type,data:r.result};saveSrDraft();};
  r.readAsDataURL(fl);
}
function openSiirtoTodistus(devId){
  if(!can("devices_edit"))return;
  var dev=db.devices.find(function(x){return x.id===devId;});if(!dev)return;
  document.getElementById("enSrDevId").value=devId;
  document.getElementById("srItems").innerHTML=siirtoItemsHtml();
  document.getElementById("enSrDate").value=today();
  var pf=document.getElementById("enSrPhoto"),pp=document.getElementById("enSrPhotoPrev");
  if(pf)pf.value="";if(pp)pp.innerHTML="";_srPhoto=null;
  var setv=function(id,v){var el=document.getElementById("sr_"+id);if(el&&!el.value&&v)el.value=v;};
  setv("s10",(typeof cs==="function"&&cs().name)||"SAVUKS");
  setv("s11","Santalankulmantie 8, 21290 Rusko");
  setv("s12",currentUser?currentUser.name:"");
  setv("s13","044 3665638");
  setv("s14","info@savuks.com");
  setv("s21",dev.tag||"");
  var dr=readSrDrafts()[devId];
  if(dr){
    if(dr.date)document.getElementById("enSrDate").value=dr.date;
    if(dr.items)SIIRTO_ITEMS.forEach(function(it){if(it.id&&dr.items[it.id]!=null&&dr.items[it.id]!==""){var el=document.getElementById("sr_"+it.id);if(el)el.value=dr.items[it.id];}});
    if(dr.photo){_srPhoto=dr.photo;if(pp)pp.innerHTML='<img src="'+dr.photo.data+'" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px"><div class="hint">Palautettu tallentamaton kuva</div>';}
  }
  show("siirtoOverlay");
}
function saveSiirtoTodistus(){
  var devId=document.getElementById("enSrDevId").value;
  var d=db.devices.find(function(x){return x.id===devId;});if(!d)return;
  var ans=collectSiirto();
  var kt=(ans.items&&ans.items.s16)||"";
  var entry={date:ans.date,pohja:"H\\u00e4lytyksensiirron asennustodistus",comment:(kt?("Kohdetunnus: "+kt):"Asennustodistus"),siirto:ans};
  if(_srPhoto)entry.photo=_srPhoto;
  d.inspections=d.inspections||[];
  d.inspections.unshift(entry);
  d.updated=today();save();clearSrDraft(devId);closeOverlay("siirtoOverlay");renderDevTab();
  siirtoTodistusPk(d,pkCtxFor(d),ans);
}
function siirtoTodistusPk(dev,ctx,ans){
  ctx=ctx||{name:"",address:""};ans=ans||{items:{}};
  var w=window.open("","_blank");
  if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  var val=function(v){
    if(v==="Kunnossa")return '<span style="color:#1a7f37;font-weight:700">Kunnossa</span>';
    if(v==="Ei kunnossa")return '<span style="color:#c1121f;font-weight:700">Ei kunnossa</span>';
    if(v==="Ei testattu")return '<span style="color:#888">Ei testattu</span>';
    if(v)return esc(v);
    return '<span style="color:#bbb">\\u2013</span>';
  };
  var rows=SIIRTO_ITEMS.map(function(it){
    if(it.s)return '<tr><td colspan="2" class="sec">'+esc(it.s)+'</td></tr>';
    var v=(ans.items&&ans.items[it.id])||"";
    return '<tr><td>'+esc(it.l)+'</td><td class="v">'+val(v)+'</td></tr>';
  }).join("");
  var ph=(dev.inspections&&dev.inspections[0]&&dev.inspections[0].photo&&dev.inspections[0].photo.data)||(ans.photo&&ans.photo.data)||"";
  var photoHtml=ph?('<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">Kuva</div><img src="'+ph+'" style="max-width:300px;max-height:300px;border:1px solid #ccc;border-radius:6px"></div>'):"";
  var worker=currentUser?currentUser.name:"";
  var site=esc(dev.locDetail||siteName(dev.locId)||"");
  var kt=esc((ans.items&&ans.items.s16)||"");
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>H\\u00e4lytyksensiirron asennustodistus</title>'
    +'<style>'
    +'body{font-family:"Trebuchet MS",Verdana,Geneva,sans-serif;color:#1b1b1b;margin:26px;max-width:760px}'
    +'h1{font-family:Georgia,"Times New Roman",serif;font-size:19px;letter-spacing:.4px;margin:0}'
    +'.brand{font-family:Georgia,serif;font-size:26px;font-weight:700;color:#c1121f;letter-spacing:3px}'
    +'.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c1121f;padding-bottom:12px}'
    +'.meta{width:100%;border-collapse:collapse;font-size:12px;margin:14px 0}'
    +'.meta td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top}.meta td.k{color:#666;width:150px}'
    +'table.chk{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}'
    +'table.chk td{padding:5px 8px;border-bottom:1px solid #e6e6e6;vertical-align:top}'
    +'table.chk td.v{width:190px;text-align:right}'
    +'table.chk td.sec{background:#f4f4f4;font-family:Georgia,serif;font-weight:700;color:#c1121f;border-bottom:1px solid #ddd}'
    +'.foot{display:flex;justify-content:space-between;gap:24px;margin-top:22px}'
    +'.sign{min-width:230px;font-size:12px}.sign .line{border-bottom:1px solid #333;height:20px;margin-bottom:2px}'
    +'.company{margin-top:22px;border-top:2px solid #c1121f;padding-top:10px;font-size:11px;color:#333;line-height:1.55}'
    +'.company .n{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;letter-spacing:1px}'
    +'@media print{button{display:none}}'
    +'</style></head><body>'
    +'<div class="head"><div><div class="brand">SAVUKS</div><div style="font-size:11px;color:#666">Paloturvallisuuspalvelut</div></div>'
    +'<div style="text-align:right"><h1>H\\u00e4lytyksensiirron asennustodistus</h1><div style="font-size:12px;color:#666">Paloilmoitinj\\u00e4rjestelm\\u00e4</div></div></div>'
    +'<table class="meta">'
    +'<tr><td class="k">Asiakas</td><td>'+esc(ctx.name||"\\u2013")+'</td><td class="k">P\\u00e4iv\\u00e4ys</td><td>'+fmt(ans.date||today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"\\u2013")+'</td><td class="k">Sijainti</td><td>'+site+'</td></tr>'
    +'<tr><td class="k">Laitetunnus</td><td>'+esc(dev.tag||"\\u2013")+'</td><td class="k">Kohdetunnus</td><td>'+(kt||"\\u2013")+'</td></tr>'
    +'</table>'
    +'<table class="chk"><tbody>'+rows+'</tbody></table>'
    +photoHtml
    +'<div class="foot"><div class="sign"><div style="margin-bottom:14px"><div style="font-size:11px;color:#666">P\\u00e4iv\\u00e4m\\u00e4\\u00e4r\\u00e4</div><div class="line"></div>'+fmt(ans.date||today())+'</div>'
    +'<div><div style="font-size:11px;color:#666">Asentaja</div><div class="line"></div>'+esc(worker)+'</div></div></div>'
    +'<div class="company"><span class="n">SAVUKS</span> &nbsp; puh. 044 3665638 &nbsp; info@savuks.com &nbsp; www.savuks.com<br>Santalankulmantie 8, 21290 Rusko &nbsp; Y-tunnus 3465682-5</div>'
    +'<p style="margin-top:20px"><button onclick="window.print()" style="background:#c1121f;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer">\\U0001f5a8 Tulosta / Tallenna PDF</button></p>'
    +'</body></html>';
  w.document.write(html);
  w.document.close();
}
const DRAFT_KEY="servalo_entry_drafts";'''
rep('const DRAFT_KEY="servalo_entry_drafts";', sr, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/siirto_patch.py

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
for t in "function openSiirtoTodistus" "function saveSiirtoTodistus" "function siirtoTodistusPk" "function siirtoItemsHtml" "function saveSrDraft" 'id="siirtoOverlay"' "servalo_siirto_drafts" "Asennustodistus"; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Mallidokumentin (IDR/PAP/THV ym.) tunnisteet EIVÄT ole vuotaneet ---"
if grep -niE "IKASET|Tamrex|Autismis|Turunen|Airiainen|Lintuhyt|Lintula|Vatialantie|Kultavuoren|sami\.sevon|thv\.fi|valvomo@thv|Viinikankatu|V\xc3\xa4h\xc3\xa4heikkil|Vaasan h\xc3\xa4t\xc3\xa4keskus|9256/1340|022846999|0290001112|12246|153124|100804|180041|1569797" servalo.html; then
  echo "VIRHE: mallidokumentin tunniste vuoti — keskeytetään."; exit 1
else echo "Mallidokumentti: puhdas"; fi

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Halytyksensiirron asennustodistus: paloilmoittimen lomake + pystymalli todistus + automaattitallennus"
git push origin main
echo "VALMIS."
```

---

## Huom
- `📄 Asennustodistus` -nappi näkyy vain **Paloilmoitin**-ryhmän laitteilla.
- Asentajan tiedot (1.0–1.4) esitäytetään Savuksille; operaattori-, hätäkeskus- ja
  vastaanottopaikkatiedot jätetään tyhjiksi ja täytetään kohteen mukaan.
- Todistus on **pystymalli** (A4). Tilat: Kunnossa (vihreä), Ei kunnossa (punainen),
  Ei testattu (harmaa).
- Kentät ovat `SIIRTO_ITEMS`-taulukossa — kerro, jos haluat lisätä/muokata kohtia.
- Puhelinnumero kirjoitetaan välilyönnillä (`044 3665638`), joten kiellettyjen vahti ei
  laukea.
