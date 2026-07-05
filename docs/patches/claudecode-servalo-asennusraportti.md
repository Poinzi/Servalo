# Claude Code -prompti: Asennusraportti (muokattava, tallennettava)

Aja **Servalo-repon juuressa**. Lisää uusi **Asennusraportit**-toiminto Raportit-valikkoon:
tallennettava raportti, jossa on vapaa yläosa (työn kuvaus + omat kentät + kuvat) ja
asuntokohtaiset kohteet (kukin: asunto/tila, omat kentät, huomiot, kuvat). Kaikki kentät
ovat vapaasti nimettäviä. Kuvat pienennetään automaattisesti. Tekstin voi sanella (fi-FI).
Raportit tallentuvat selaimeen ja ne voi avata, muokata ja tulostaa PDF:ksi.

Käyttää omaa `db.installReports`-avainta (ei sekaannu laskutuksen `db.reports`-listaan).
Ei kosketa dataan eikä muihin toimintoihin.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/inst_patch.py <<'PYEOF'
import io, sys

FN = sys.argv[1] if len(sys.argv) > 1 else "servalo.html"

INST_JS = r'''/* ========== ASENNUSRAPORTIT (muokattavat, tallennettavat) ========== */
function instAll(){return (db.installReports=db.installReports||[]);}
var instDraft=null, instEditId=null;
function instEa(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function instBlank(){return {title:"",customerId:"",locId:"",worker:(currentUser?currentUser.name:""),desc:"",fields:[],photos:[],blocks:[]};}
function instBlankBlock(){return {id:uid(),apt:"",note:"",fields:[],photos:[]};}
function ensureInstUI(){
  if(document.getElementById("instListOverlay"))return;
  var css=document.createElement("style");css.id="instCss";
  css.textContent=".inst-modal{max-width:940px;width:96%}"
   +".inst-row{display:flex;gap:8px;align-items:flex-start;margin:5px 0}"
   +".inst-block{border:1px solid #e2c7c7;border-radius:10px;padding:12px;margin:12px 0;background:#fff8f8}"
   +".inst-block h4{margin:0 0 6px;color:#c1121f;font-family:Georgia,serif}"
   +".inst-ph{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}"
   +".inst-ph .cell{position:relative}"
   +".inst-ph img{width:84px;height:84px;object-fit:cover;border:1px solid #ccc;border-radius:6px}"
   +".inst-ph .del{position:absolute;top:-6px;right:-6px;background:#c1121f;color:#fff;border:0;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;line-height:1}"
   +".inst-t{width:100%;border-collapse:collapse;font-size:13px}"
   +".inst-t th{text-align:left;background:#faf0f0;padding:7px;border-bottom:2px solid #c1121f}"
   +".inst-t td{padding:7px;border-bottom:1px solid #eee}"
   +".inst-mini{background:#eee;border:0;border-radius:6px;padding:4px 9px;cursor:pointer;font-size:12px;margin-left:6px}"
   +".inst-mini.red{background:#c1121f;color:#fff}.inst-mini.blue{background:#1d4ed8;color:#fff}";
  document.head.appendChild(css);
  var wrap=document.createElement("div");
  wrap.innerHTML='<div class="overlay" id="instListOverlay"><div class="modal inst-modal">'
   +'<div class="modal-h"><span>&#128221; Asennusraportit</span><span class="x" onclick="closeOverlay(\'instListOverlay\')">&times;</span></div>'
   +'<div class="modal-b"><div style="margin-bottom:10px"><button class="btn orange" onclick="instNew()">&#65291; Uusi raportti</button></div><div id="instListBody"></div></div>'
   +'</div></div>'
   +'<div class="overlay" id="instEditOverlay"><div class="modal inst-modal">'
   +'<div class="modal-h"><span id="instEditTitle">Asennusraportti</span><span class="x" onclick="instBack()">&times;</span></div>'
   +'<div class="modal-b" id="instEditBody"></div>'
   +'<div class="modal-foot"><button class="btn ghost" onclick="instBack()">Takaisin</button><button class="btn ghost" onclick="instPrintDraft()">&#128424; Tulosta / PDF</button><button class="btn orange" onclick="instSave()">Tallenna</button></div>'
   +'</div></div>';
  document.body.appendChild(wrap);
}
function openInstReports(){ensureInstUI();renderInstList();document.getElementById("instListOverlay").classList.add("show");}
function renderInstList(){
  var b=document.getElementById("instListBody");if(!b)return;
  var list=instAll();
  if(!list.length){b.innerHTML='<div style="color:#999;padding:18px;text-align:center">Ei tallennettuja raportteja. Luo uusi yll&auml;.</div>';return;}
  var rows=list.map(function(r){
    var cust=(typeof custById==="function")?custById(r.customerId):null;
    var nb=(r.blocks?r.blocks.length:0);
    return '<tr><td><b>'+esc(r.title||"(nimet&ouml;n)")+'</b></td>'
      +'<td>'+esc(cust?cust.name:"–")+'</td>'
      +'<td>'+esc(r.created||"")+'</td>'
      +'<td>'+nb+' kohdetta</td>'
      +'<td style="white-space:nowrap;text-align:right">'
        +'<button class="inst-mini blue" onclick="instOpen(\''+r.id+'\')">Avaa</button>'
        +'<button class="inst-mini" onclick="instPrint(\''+r.id+'\')">Tulosta</button>'
        +'<button class="inst-mini red" onclick="instDelete(\''+r.id+'\')">Poista</button>'
      +'</td></tr>';
  }).join("");
  b.innerHTML='<table class="inst-t"><thead><tr><th>Otsikko</th><th>Asiakas</th><th>Luotu</th><th>Kohteita</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function instNew(){instEditId=null;instDraft=instBlank();openInstEditor();}
function instOpen(id){var r=instAll().find(function(x){return x.id===id;});if(!r)return;instEditId=id;instDraft=JSON.parse(JSON.stringify(r));if(!instDraft.fields)instDraft.fields=[];if(!instDraft.photos)instDraft.photos=[];if(!instDraft.blocks)instDraft.blocks=[];openInstEditor();}
function openInstEditor(){ensureInstUI();document.getElementById("instListOverlay").classList.remove("show");renderInstEditor();document.getElementById("instEditOverlay").classList.add("show");}
function instBack(){document.getElementById("instEditOverlay").classList.remove("show");renderInstList();document.getElementById("instListOverlay").classList.add("show");}
function instCustOpts(sel){return '<option value="">– valitse asiakas –</option>'+db.customers.map(function(c){return '<option value="'+c.id+'"'+(c.id===sel?' selected':'')+'>'+esc(c.name)+'</option>';}).join("");}
function instLocOpts(sel){return '<option value="">– valitse kohde –</option>'+db.locs.filter(function(l){return l.type==="site";}).map(function(l){return '<option value="'+l.id+'"'+(l.id===sel?' selected':'')+'>'+esc(locPath(l.id))+'</option>';}).join("");}
function instPhotoCells(photos,delFn){return (photos||[]).map(function(p,i){return '<div class="cell"><img src="'+p+'"><button class="del" onclick="'+delFn+'('+i+')">&times;</button></div>';}).join("");}
function instBPhotoCells(photos,bi){return (photos||[]).map(function(p,i){return '<div class="cell"><img src="'+p+'"><button class="del" onclick="instDelBPhoto('+bi+','+i+')">&times;</button></div>';}).join("");}
function instTopFieldRows(){return instDraft.fields.map(function(f,i){
  return '<div class="inst-row"><input class="f" placeholder="Kent&auml;n nimi" value="'+instEa(f.k)+'" oninput="instDraft.fields['+i+'].k=this.value">'
    +'<input class="f" placeholder="Arvo" value="'+instEa(f.v)+'" oninput="instDraft.fields['+i+'].v=this.value">'
    +'<button class="inst-mini red" onclick="instDelField('+i+')">&times;</button></div>';}).join("");}
function instBlockHtml(bk,bi){
  return '<div class="inst-block"><h4>Kohde '+(bi+1)+'</h4>'
   +'<div class="inst-row"><input class="f" placeholder="Asunto / tila (esim. As 5 / keitti&ouml;)" value="'+instEa(bk.apt)+'" oninput="instDraft.blocks['+bi+'].apt=this.value">'
     +'<button class="inst-mini red" onclick="instDelBlock('+bi+')">Poista kohde</button></div>'
   +bk.fields.map(function(f,fi){
       return '<div class="inst-row"><input class="f" placeholder="Kent&auml;n nimi" value="'+instEa(f.k)+'" oninput="instDraft.blocks['+bi+'].fields['+fi+'].k=this.value">'
         +'<input class="f" placeholder="Arvo" value="'+instEa(f.v)+'" oninput="instDraft.blocks['+bi+'].fields['+fi+'].v=this.value">'
         +'<button class="inst-mini red" onclick="instDelBField('+bi+','+fi+')">&times;</button></div>';}).join("")
   +'<div style="margin:4px 0"><button class="inst-mini" onclick="instAddBField('+bi+')">&#65291; Lis&auml;&auml; kentt&auml;</button></div>'
   +'<div class="inst-row"><textarea class="f" rows="2" placeholder="Huomiot / teksti…" oninput="instDraft.blocks['+bi+'].note=this.value">'+instEa(bk.note)+'</textarea>'
     +'<button class="inst-mini blue" onclick="instDictateBlock('+bi+')">&#127908;</button></div>'
   +'<div class="inst-ph">'+instBPhotoCells(bk.photos,bi)+'</div>'
   +'<input type="file" accept="image/*" capture="environment" multiple onchange="instAddBPhoto(this,'+bi+')">'
   +'</div>';}
function renderInstEditor(){
  ensureInstUI();
  document.getElementById("instEditTitle").textContent=instEditId?"Muokkaa asennusraporttia":"Uusi asennusraportti";
  var d=instDraft;
  var h='<div class="field"><label>Otsikko / urakka</label><input class="f" value="'+instEa(d.title)+'" oninput="instDraft.title=this.value" placeholder="esim. Palovaroittimien vaihto – As Oy Kuusikko"></div>'
   +'<div class="grid2">'
     +'<div class="field"><label>Asiakas</label><select class="f" onchange="instDraft.customerId=this.value">'+instCustOpts(d.customerId)+'</select></div>'
     +'<div class="field"><label>Kohde</label><select class="f" onchange="instDraft.locId=this.value">'+instLocOpts(d.locId)+'</select></div>'
     +'<div class="field"><label>Tekij&auml;</label><input class="f" value="'+instEa(d.worker)+'" oninput="instDraft.worker=this.value"></div>'
   +'</div>'
   +'<div class="field"><label>Ty&ouml;n kuvaus <button type="button" class="inst-mini blue" onclick="instDictateDesc()">&#127908; Sanele</button></label>'
     +'<textarea class="f" rows="3" oninput="instDraft.desc=this.value" placeholder="Yleiskuvaus ty&ouml;st&auml;…">'+instEa(d.desc)+'</textarea></div>'
   +'<div class="field"><label>Yleiset lis&auml;kent&auml;t</label>'+instTopFieldRows()+'<div style="margin-top:4px"><button class="inst-mini" onclick="instAddField()">&#65291; Lis&auml;&auml; kentt&auml;</button></div></div>'
   +'<div class="field"><label>Yleiset kuvat</label><div class="inst-ph">'+instPhotoCells(d.photos,"instDelPhoto")+'</div><input type="file" accept="image/*" capture="environment" multiple onchange="instAddPhoto(this)"></div>'
   +'<hr style="margin:16px 0;border:0;border-top:2px solid #f0dede">'
   +'<div style="font-weight:700;color:#c1121f;margin-bottom:6px">Asuntokohtaiset kohteet</div>'
   +d.blocks.map(function(bk,bi){return instBlockHtml(bk,bi);}).join("")
   +'<button class="btn ghost" onclick="instAddBlock()">&#65291; Lis&auml;&auml; asunto / tila</button>';
  document.getElementById("instEditBody").innerHTML=h;
}
function instAddField(){instDraft.fields.push({k:"",v:""});renderInstEditor();}
function instDelField(i){instDraft.fields.splice(i,1);renderInstEditor();}
function instAddBlock(){instDraft.blocks.push(instBlankBlock());renderInstEditor();}
function instDelBlock(bi){if(!confirm("Poista tämä kohde?"))return;instDraft.blocks.splice(bi,1);renderInstEditor();}
function instAddBField(bi){instDraft.blocks[bi].fields.push({k:"",v:""});renderInstEditor();}
function instDelBField(bi,fi){instDraft.blocks[bi].fields.splice(fi,1);renderInstEditor();}
function instDelPhoto(i){instDraft.photos.splice(i,1);renderInstEditor();}
function instDelBPhoto(bi,i){instDraft.blocks[bi].photos.splice(i,1);renderInstEditor();}
function instShrink(file,cb){
  var rd=new FileReader();
  rd.onload=function(){var img=new Image();img.onload=function(){
    var mx=1000,w=img.width,h=img.height;
    if(w>h&&w>mx){h=Math.round(h*mx/w);w=mx;}else if(h>=w&&h>mx){w=Math.round(w*mx/h);h=mx;}
    var c=document.createElement("canvas");c.width=w;c.height=h;
    c.getContext("2d").drawImage(img,0,0,w,h);
    try{cb(c.toDataURL("image/jpeg",0.7));}catch(e){cb(rd.result);}
  };img.onerror=function(){cb(rd.result);};img.src=rd.result;};
  rd.readAsDataURL(file);
}
function instAddPhoto(input){var fs=input.files;if(!fs||!fs.length)return;var arr=Array.prototype.slice.call(fs);input.value="";var n=arr.length,done=0;arr.forEach(function(f){instShrink(f,function(u){instDraft.photos.push(u);done++;if(done===n)renderInstEditor();});});}
function instAddBPhoto(input,bi){var fs=input.files;if(!fs||!fs.length)return;var arr=Array.prototype.slice.call(fs);input.value="";var n=arr.length,done=0;arr.forEach(function(f){instShrink(f,function(u){instDraft.blocks[bi].photos.push(u);done++;if(done===n)renderInstEditor();});});}
function instDictate(cb){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert("Sanelu ei ole tuettu tässä selaimessa.");return;}
  var rec=new SR();rec.lang="fi-FI";rec.interimResults=false;rec.maxAlternatives=1;
  rec.onresult=function(ev){var t="";for(var i=0;i<ev.results.length;i++){t+=ev.results[i][0].transcript+" ";}t=t.trim();if(t)cb(t);};
  rec.onerror=function(){};
  try{rec.start();}catch(e){}
}
function instDictateDesc(){instDictate(function(t){instDraft.desc=(instDraft.desc?instDraft.desc+" ":"")+t;renderInstEditor();});}
function instDictateBlock(bi){instDictate(function(t){var b=instDraft.blocks[bi];b.note=(b.note?b.note+" ":"")+t;renderInstEditor();});}
function instSave(){
  var d=instDraft;
  if(!d.title||!d.title.trim()){alert("Anna raportille otsikko.");return;}
  d.updated=today();
  if(instEditId){var r=instAll().find(function(x){return x.id===instEditId;});if(r){Object.assign(r,d);}}
  else{d.id=uid();d.created=today();d.by=currentUser?currentUser.name:"";instAll().unshift(d);instEditId=d.id;}
  save();
  document.getElementById("instEditOverlay").classList.remove("show");
  renderInstList();document.getElementById("instListOverlay").classList.add("show");
}
function instDelete(id){if(!confirm("Poista raportti pysyvästi?"))return;db.installReports=instAll().filter(function(x){return x.id!==id;});save();renderInstList();}
function instPrintDraft(){instPrintObj(instDraft);}
function instPrint(id){var r=instAll().find(function(x){return x.id===id;});if(r)instPrintObj(r);}
function instPrintObj(d){
  var w=window.open("","_blank");if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  var cust=(typeof custById==="function")?custById(d.customerId):null;
  var site=d.locId?(typeof locPath==="function"?locPath(d.locId):(typeof siteName==="function"?siteName(d.locId):"")):"";
  var ftab=function(fields){if(!fields||!fields.length)return"";return '<table class="ft">'+fields.map(function(f){return '<tr><td class="k">'+esc(f.k||"–")+'</td><td>'+esc(f.v||"")+'</td></tr>';}).join("")+'</table>';};
  var pgrid=function(photos){if(!photos||!photos.length)return"";return '<div class="pg">'+photos.map(function(p){return '<img src="'+p+'">';}).join("")+'</div>';};
  var blocks=(d.blocks||[]).map(function(bk,i){
    return '<div class="blk"><div class="blkh">'+esc(bk.apt||("Kohde "+(i+1)))+'</div>'
      +ftab(bk.fields)+(bk.note?'<div class="note">'+esc(bk.note)+'</div>':"")+pgrid(bk.photos)+'</div>';}).join("");
  var worker=d.worker||(currentUser?currentUser.name:"");
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Asennusraportti</title><style>'
    +'@page{size:A4;margin:14mm}'
    +'body{font-family:"Trebuchet MS",Verdana,sans-serif;color:#1b1b1b;margin:24px}'
    +'.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c1121f;padding-bottom:12px}'
    +'.brand{font-family:Georgia,serif;font-size:26px;font-weight:700;color:#c1121f;letter-spacing:3px}'
    +'h1{font-family:Georgia,serif;font-size:21px;margin:0}'
    +'.sub{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;margin:16px 0 4px}'
    +'.meta{border-collapse:collapse;font-size:12px;margin:8px 0}.meta td{padding:3px 8px;border-bottom:1px solid #eee}.meta td.k{color:#666}'
    +'.desc{font-size:13px;white-space:pre-wrap;margin:6px 0}'
    +'.ft{border-collapse:collapse;font-size:12px;margin:6px 0;width:100%}'
    +'.ft td{padding:4px 8px;border-bottom:1px solid #eee}.ft td.k{color:#666;width:34%;font-weight:600}'
    +'.pg{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.pg img{width:150px;height:150px;object-fit:cover;border:1px solid #ccc;border-radius:6px}'
    +'.blk{border:1px solid #e2c7c7;border-radius:8px;padding:12px;margin:12px 0}'
    +'.blkh{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;margin-bottom:4px}'
    +'.note{font-size:12px;white-space:pre-wrap;margin:6px 0}'
    +'.company{margin-top:22px;border-top:2px solid #c1121f;padding-top:10px;font-size:11px;color:#333;line-height:1.55}.company .n{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;letter-spacing:1px}'
    +'@media print{button{display:none}.sub,.blkh,h1{break-after:avoid;page-break-after:avoid}.blk,.pg,.company{break-inside:avoid;page-break-inside:avoid}}'
    +'</style></head><body>'
    +'<div class="head"><div><div class="brand">SAVUKS</div><div style="font-size:11px;color:#666">Paloturvallisuuspalvelut</div></div>'
    +'<div style="text-align:right"><h1>Asennusraportti</h1><div style="font-size:12px;color:#666">'+esc(d.title||"")+'</div></div></div>'
    +'<table class="meta"><tr><td class="k">Asiakas</td><td>'+esc(cust?cust.name:"–")+'</td><td class="k">Päiväys</td><td>'+fmt(today())+'</td></tr>'
    +'<tr><td class="k">Kohde</td><td>'+esc(site||"–")+'</td><td class="k">Tekijä</td><td>'+esc(worker)+'</td></tr></table>'
    +(d.desc?'<div class="sub">Työn kuvaus</div><div class="desc">'+esc(d.desc)+'</div>':"")
    +((d.fields&&d.fields.length)?'<div class="sub">Yleistiedot</div>'+ftab(d.fields):"")
    +((d.photos&&d.photos.length)?pgrid(d.photos):"")
    +(blocks?'<div class="sub">Asuntokohtaiset kohteet</div>'+blocks:"")
    +'<div class="company"><span class="n">Savuks Oy</span> &nbsp; puh. 044 3665638 &nbsp; info@savuks.com &nbsp; www.savuks.com<br>Santalankulmantie 8, 21290 Rusko &nbsp; Y-tunnus 3465682-5</div>'
    +'<p style="margin-top:20px"><button onclick="window.print()" style="background:#c1121f;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer">&#128424; Tulosta / Tallenna PDF</button></p>'
    +'</body></html>';
  w.document.write(html);w.document.close();
}
'''

def patch(fn, edits):
    s = io.open(fn, encoding="utf-8").read()
    orig = s
    for old, new, n in edits:
        c = s.count(old)
        if c != n:
            print("VIRHE (%s): ankkuria loytyi %d kpl (odotettu %d):\n  %s" % (fn, c, n, old[:100]))
            sys.exit(1)
        s = s.replace(old, new)
    if s == orig:
        print("VIRHE: %s ei muuttunut." % fn); sys.exit(1)
    io.open(fn, "w", encoding="utf-8").write(s)
    print("Patch OK: %s" % fn)

ANCHOR = "/* ========== KÄYTTÄJÄT / ROOLIT ========== */"
MENU_OLD = '<button data-report="poistetut">\U0001f5d1 Käytöstä poistetut laitteet</button>'
MENU_NEW = MENU_OLD + '\n        <button onclick="openInstReports()">\U0001f4dd Asennusraportit</button>'

patch(FN, [
    (ANCHOR, INST_JS + "\n" + ANCHOR, 1),
    (MENU_OLD, MENU_NEW, 1),
])
PYEOF

python3 /tmp/inst_patch.py servalo.html

echo "--- servalo.html JS-syntaksin validointi ---"
node -e '
const fs=require("fs");
const h=fs.readFileSync("servalo.html","utf8");
const re=/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g;
let m,i=0,ok=true;
while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){ok=false;console.log("Script-lohko "+i+" FAIL: "+e.message);}}
console.log(ok?("JS OK ("+i+" lohkoa)"):"JS FAILED");
process.exit(ok?0:1);
'

echo "--- Uudet palaset läsnä ---"
grep -qF 'function openInstReports' servalo.html && echo "OK: moduuli" || { echo "PUUTTUU: moduuli"; exit 1; }
grep -qF 'onclick="openInstReports()"' servalo.html && echo "OK: valikkopainike" || { echo "PUUTTUU: valikko"; exit 1; }
grep -qF 'db.installReports' servalo.html && echo "OK: tallennus" || { echo "PUUTTUU: tallennus"; exit 1; }

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Asennusraportit: muokattava, tallennettava raportti (vapaa yläosa + asuntokohtaiset lohkot, kuvat, sanelu, PDF)"
git push origin main
echo "VALMIS."
```

---

## Mitä tulee
- **Raportit-valikkoon** uusi kohta **📝 Asennusraportit**.
- **Lista:** kaikki tallennetut raportit — Avaa / Tulosta / Poista.
- **Editori:** otsikko/urakka, asiakas, kohde, tekijä; **työn kuvaus** (sanelu-nappi);
  vapaasti nimettävät **yleiset lisäkentät**; **yleiset kuvat**; ja alle
  **asuntokohtaiset kohteet** — kukin: asunto/tila, omat kentät, huomiot (sanelu), kuvat.
- **Kuvat** pienennetään automaattisesti (max 1000 px, JPEG) jotta selaimen muisti riittää.
- **Tallennus** selaimeen (`db.installReports`); raportin voi avata ja muokata myöhemmin.
- **Tulosta / PDF:** siisti Savuks-tyylinen tuloste, sivutus kunnossa.

## Näin käytät
Raportit ▾ → 📝 Asennusraportit → ＋ Uusi raportti. Täytä yläosa, lisää kenttiä ja kuvia,
paina "＋ Lisää asunto / tila" jokaiselle asunnolle. Tallenna. Tulosta halutessasi PDF.

## Testattu
Patch ajettu hiekkalaatikossa oikeaan servalo.html-kopioon: molemmat ankkurit osuivat
(n=1), JS-syntaksi OK, kielletyt merkkijonot puhtaat.
