# Claude Code -prompti: sprinklerijärjestelmän huoltopöytäkirja (komponenttiloki + oma kategoria)

Aja **Servalo-repon juuressa**. Prompti lisää uuden laiteryhmän **Sprinkleri**,
tekee muutokset, validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

> **Riippuvuus:** aja **ensin** `claudecode-servalo-luo-poytakirja.md` ja
> `claudecode-servalo-paloilmoitin-poytakirja.md`. Skripti pysähtyy, jos
> `function openPaloilmPk` ei löydy. Reititys ankkuroidaan Paloilmoitin-riviin, joten
> toimii riippumatta muista laitepatcheista.

## Mitä tämä tekee

Sprinklerihuolto ei ole Kyllä/Ei-tarkastuslista vaan **komponenttikohtainen huoltoloki**:
jokaiselle laiteosalle kirjataan **toimenpide** (Huollettu / Tarkastettu / Korjattava /
Ei koske), **lisätiedot** ja **päivämäärä**. Pöytäkirja on **pystymalli** (A4).

- **Lisää uuden laiteryhmän `Sprinkleri`** laiteryhmävalikkoon.
- **Laitekortin `📋 Luo pöytäkirja` -nappi** avaa sprinklerilaitteistolle (kun laitteen
  ryhmä on **Sprinkleri**) oman **komponenttilokin** — täytettävissä puhelimella.
- **Tallenna + luo pöytäkirja** kirjaa huollon laitteelle **ja** avaa heti
  Savuks-tyylisen **pystymallin pöytäkirjan** (tulosta / tallenna PDF / jaa).
- **Liitä tai luo:** voit joko liittää valmiin raportin (tiedosto) tai luoda pöytäkirjan
  suoraan täytetyistä kentistä.
- **Jatkuva automaattitallennus** (localStorage).

Huollon tiedot: suoritusaika (alku–loppu), vastaava huoltopäällikkö, työn suorittajat,
työnumero. Pöytäkirjassa näkyvät myös noudatetut standardit (CEA 4001/4007/4008,
SFS 5980, SFS-EN 12845 + A2, Laki 191/2024, SM-asetus 976/2024).

Komponentit: hälytysventtiilit, mudanerottimet, yksisuuntaventtiilit, sulkuventtiilit,
muut oheislaitteet (virtauskytkimet), palokunnan syöttöliittimet, vesilähde, pumput,
putkisto/suuttimet/kannakointi, hälytykset paloilmoittimelle, hälytykset
kiinteistövalvontaan, yhteystesti hätäkeskukseen, varaosat ja tarvikkeet, dokumentit/
kaaviot/opasteet, määräaikaistarkastukset.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function openPaloilmPk" servalo.html || { echo "VIRHE: openPaloilmPk puuttuu — aja ensin paloilmoitin-patch."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/sprink_patch.py <<'PYEOF'
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

# 0) Uusi laiteryhmä ryhmävalikkoon (Yhdistelmän eteen)
rep('"Yhdistelmä","Kuulutus"', '"Sprinkleri","Yhdistelmä","Kuulutus"', 1)

# 1) Uusi overlay ennen laitetiedostomodaalia
overlay = '''<div class="overlay" id="sprinkOverlay">
  <div class="modal" style="max-width:720px">
    <div class="modal-h"><span>Sprinklerijärjestelmän huolto</span><span class="x" onclick="closeOverlay('sprinkOverlay')">×</span></div>
    <div class="modal-b" oninput="saveSprDraft()" onchange="saveSprDraft()">
      <input type="hidden" id="enSprDevId">
      <div class="field"><label>Raportin päivämäärä</label><input class="f" id="enSprDate" type="date"></div>
      <div style="font-weight:700;margin:14px 0 4px;color:#c1121f">Huollon tiedot</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:150px"><label>Suoritusaika alkoi</label><input class="f" id="enSprAlku" type="date"></div>
        <div class="field" style="flex:1;min-width:150px"><label>Suoritusaika päättyi</label><input class="f" id="enSprLoppu" type="date"></div>
      </div>
      <div class="field"><label>Vastaava huoltopäällikkö</label><input class="f" id="enSprPaallikko" placeholder="Nimi"></div>
      <div class="field"><label>Työn suorittajat</label><input class="f" id="enSprTekijat" placeholder="esim. Sukunimi Etunimi, Sukunimi Etunimi"></div>
      <div class="field"><label>Työnumero (valinnainen)</label><input class="f" id="enSprTyonro" placeholder="esim. TY-2026-0187"></div>
      <div style="font-weight:700;margin:14px 0 4px;color:#c1121f">Komponentit</div>
      <p class="hint" style="margin:0 0 8px">Kullekin osalle: toimenpide, lisätiedot ja päivämäärä.</p>
      <div id="sprItems"></div>
      <div class="field"><label>Yleiset huomiot</label><textarea class="f" id="enSprHuomiot" rows="3" placeholder="Yhteenveto / havaitut puutteet…"></textarea></div>
      <div class="field"><label>\U0001F4F7 Kuva <span class="hint" style="font-weight:400">(sisäinen – asiakas ei näe)</span></label><input class="f" id="enSprPhoto" type="file" accept="image/*" capture="environment" onchange="previewSprPhoto()"><div id="enSprPhotoPrev" style="margin-top:8px"></div></div>
      <div class="field"><label>Liite (valmis raportti, valinnainen)</label><input class="f" id="enSprFile" type="file"></div>
      <p class="hint">Voit joko liittää valmiin raportin tai luoda pöytäkirjan täytetyistä kentistä.</p>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeOverlay('sprinkOverlay')">Peruuta</button>
      <button class="btn orange" onclick="saveSprinkPk()">Tallenna + luo pöytäkirja</button>
    </div>
  </div>
</div>

<!-- DEVICE FILE MODAL -->'''
rep('<!-- DEVICE FILE MODAL -->', overlay, 1)

# 2) Reititys: lisää haara Paloilmoitin-rivin jälkeen
rep('if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}',
'''if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}
  if(_d&&_d.group==="Sprinkleri"){openSprinkPk(devId);return;}''', 1)

# 3) Sprinkleri-toiminnot ennen luonnosmuuttujia
spr = '''const SPR_DRAFT_KEY="servalo_sprink_drafts";
let _sprPhoto=null;
const SPR_STD="CEA 4001, CEA 4007, CEA 4008, SFS 5980, SFS-EN 12845 + A2 \\u2022 Laki er\\u00e4ist\\u00e4 paloturvallisuuslaitteista 191/2024 \\u2022 SM-asetus paloilmoittimista ja automaattisista sammutuslaitteistoista 976/2024";
const SPR_ITEMS=[
 {id:"c01",l:"H\\u00e4lytysventtiilit"},
 {id:"c02",l:"Mudanerottimet"},
 {id:"c03",l:"Yksisuuntaventtiilit"},
 {id:"c04",l:"Sulkuventtiilit"},
 {id:"c05",l:"Muut oheislaitteet (virtauskytkimet)"},
 {id:"c06",l:"Palokunnan sy\\u00f6tt\\u00f6liittimet"},
 {id:"c07",l:"Vesil\\u00e4hde"},
 {id:"c08",l:"Pumput"},
 {id:"c09",l:"Putkisto, suuttimet, kannakointi"},
 {id:"c10",l:"H\\u00e4lytykset paloilmoittimelle"},
 {id:"c11",l:"H\\u00e4lytykset kiinteist\\u00f6valvontaan"},
 {id:"c12",l:"Yhteystesti h\\u00e4t\\u00e4keskukseen"},
 {id:"c13",l:"Varaosat ja tarvikkeet"},
 {id:"c14",l:"Dokumentit, kaaviot, opasteet"},
 {id:"c15",l:"M\\u00e4\\u00e4r\\u00e4aikaistarkastukset"}
];
function sprOpts(){return '<option value=""></option><option>Huollettu</option><option>Tarkastettu</option><option>Korjattava</option><option>Ei koske</option>';}
function sprItemsHtml(){
  return SPR_ITEMS.map(function(it){
    return '<div class="field" style="border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:8px">'
      +'<label style="font-weight:600;display:block;margin-bottom:4px">'+esc(it.l)+'</label>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<select class="f" id="spr_'+it.id+'_s" style="flex:0 0 150px">'+sprOpts()+'</select>'
      +'<input class="f" id="spr_'+it.id+'_d" type="date" style="flex:0 0 150px">'
      +'<input class="f" id="spr_'+it.id+'_i" placeholder="Lis\\u00e4tiedot" style="flex:1;min-width:160px">'
      +'</div></div>';
  }).join("");
}
function readSprDrafts(){try{return JSON.parse(localStorage.getItem(SPR_DRAFT_KEY)||"{}");}catch(e){return {};}}
function collectSpr(){
  var items={};
  SPR_ITEMS.forEach(function(it){
    var se=document.getElementById("spr_"+it.id+"_s"),de=document.getElementById("spr_"+it.id+"_d"),ie=document.getElementById("spr_"+it.id+"_i");
    items[it.id]={s:se?se.value:"",d:de?de.value:"",i:ie?ie.value:""};
  });
  return {
    date:document.getElementById("enSprDate").value||today(),
    alku:document.getElementById("enSprAlku").value,
    loppu:document.getElementById("enSprLoppu").value,
    paallikko:document.getElementById("enSprPaallikko").value,
    tekijat:document.getElementById("enSprTekijat").value,
    tyonro:document.getElementById("enSprTyonro").value,
    huomiot:document.getElementById("enSprHuomiot").value,
    items:items,
    photo:_sprPhoto
  };
}
function saveSprDraft(){
  var id=document.getElementById("enSprDevId").value;if(!id)return;
  var all=readSprDrafts();var a=collectSpr();a.ts=Date.now();all[id]=a;
  try{localStorage.setItem(SPR_DRAFT_KEY,JSON.stringify(all));}catch(e){}
}
function clearSprDraft(id){var all=readSprDrafts();delete all[id];try{localStorage.setItem(SPR_DRAFT_KEY,JSON.stringify(all));}catch(e){}}
function previewSprPhoto(){
  var pi=document.getElementById("enSprPhoto"),pp=document.getElementById("enSprPhotoPrev");
  if(!pi||!pp)return;pp.innerHTML="";
  var fl=pi.files&&pi.files[0];if(!fl)return;
  if(fl.size>4*1024*1024){alert("Kuva on liian suuri (max ~4 MB).");pi.value="";return;}
  var r=new FileReader();
  r.onload=function(){pp.innerHTML='<img src="'+r.result+'" alt="Esikatselu" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px">';_sprPhoto={name:fl.name,type:fl.type,data:r.result};saveSprDraft();};
  r.readAsDataURL(fl);
}
function openSprinkPk(devId){
  if(!can("devices_edit"))return;
  document.getElementById("enSprDevId").value=devId;
  document.getElementById("sprItems").innerHTML=sprItemsHtml();
  ["enSprDate","enSprAlku","enSprLoppu","enSprPaallikko","enSprTekijat","enSprTyonro","enSprHuomiot"].forEach(function(id){var el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("enSprDate").value=today();
  var pf=document.getElementById("enSprPhoto"),pp=document.getElementById("enSprPhotoPrev"),ff=document.getElementById("enSprFile");
  if(pf)pf.value="";if(pp)pp.innerHTML="";if(ff)ff.value="";_sprPhoto=null;
  var dr=readSprDrafts()[devId];
  if(dr){
    if(dr.date)document.getElementById("enSprDate").value=dr.date;
    if(dr.alku)document.getElementById("enSprAlku").value=dr.alku;
    if(dr.loppu)document.getElementById("enSprLoppu").value=dr.loppu;
    if(dr.paallikko)document.getElementById("enSprPaallikko").value=dr.paallikko;
    if(dr.tekijat)document.getElementById("enSprTekijat").value=dr.tekijat;
    if(dr.tyonro)document.getElementById("enSprTyonro").value=dr.tyonro;
    if(dr.huomiot)document.getElementById("enSprHuomiot").value=dr.huomiot;
    if(dr.items)SPR_ITEMS.forEach(function(it){var v=dr.items[it.id];if(!v)return;
      var se=document.getElementById("spr_"+it.id+"_s"),de=document.getElementById("spr_"+it.id+"_d"),ie=document.getElementById("spr_"+it.id+"_i");
      if(se&&v.s!=null)se.value=v.s;if(de&&v.d!=null)de.value=v.d;if(ie&&v.i!=null)ie.value=v.i;});
    if(dr.photo){_sprPhoto=dr.photo;if(pp)pp.innerHTML='<img src="'+dr.photo.data+'" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px"><div class="hint">Palautettu tallentamaton kuva</div>';}
  }
  show("sprinkOverlay");
}
function saveSprinkPk(){
  var devId=document.getElementById("enSprDevId").value;
  var d=db.devices.find(function(x){return x.id===devId;});if(!d)return;
  var ans=collectSpr();
  var entry={date:ans.date,pohja:"Sprinklerij\\u00e4rjestelm\\u00e4n m\\u00e4\\u00e4r\\u00e4aikaishuolto",comment:(ans.huomiot||"").trim(),checklist:ans};
  if(_sprPhoto)entry.photo=_sprPhoto;
  var finalize=function(){
    d.inspections=d.inspections||[];
    d.inspections.unshift(entry);
    d.inspInterval=d.inspInterval||d.interval;
    d.inspLast=entry.date;d.inspNext=addInterval(entry.date,d.inspInterval||d.interval);
    d.updated=today();save();clearSprDraft(devId);closeOverlay("sprinkOverlay");renderDevTab();
    sprinkPk(d,pkCtxFor(d),ans);
  };
  var ff=document.getElementById("enSprFile");
  if(ff&&ff.files&&ff.files[0]){
    var fl=ff.files[0];
    if(fl.size>4*1024*1024){alert("Tiedosto on liian suuri (max ~4 MB).");return;}
    var r=new FileReader();
    r.onload=function(){entry.file={name:fl.name,type:fl.type,data:r.result};finalize();};
    r.onerror=function(){alert("Tiedoston luku ep\\u00e4onnistui.");};
    r.readAsDataURL(fl);
  } else finalize();
}
function sprinkPk(dev,ctx,ans){
  ctx=ctx||{name:"",address:""};ans=ans||{items:{}};
  var w=window.open("","_blank");
  if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  var stat=function(v){
    if(v==="Huollettu")return '<span style="color:#1a7f37;font-weight:700">Huollettu</span>';
    if(v==="Tarkastettu")return '<span style="color:#1a7f37;font-weight:700">Tarkastettu</span>';
    if(v==="Korjattava")return '<span style="color:#c1121f;font-weight:700">Korjattava</span>';
    if(v==="Ei koske")return '<span style="color:#888">Ei koske</span>';
    if(v)return esc(v);
    return '<span style="color:#bbb">\\u2013</span>';
  };
  var rows=SPR_ITEMS.map(function(it){
    var v=(ans.items&&ans.items[it.id])||{};
    var dd=v.d?fmt(v.d):'<span style="color:#bbb">\\u2013</span>';
    var ii=v.i?esc(v.i):'';
    return '<tr><td>'+esc(it.l)+'</td><td class="v">'+stat(v.s||"")+'</td><td>'+ii+'</td><td class="d">'+dd+'</td></tr>';
  }).join("");
  var ph=(dev.inspections&&dev.inspections[0]&&dev.inspections[0].photo&&dev.inspections[0].photo.data)||(ans.photo&&ans.photo.data)||"";
  var photoHtml=ph?('<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">Kuva</div><img src="'+ph+'" style="max-width:300px;max-height:300px;border:1px solid #ccc;border-radius:6px"></div>'):"";
  var worker=currentUser?currentUser.name:"";
  var site=esc(dev.locDetail||siteName(dev.locId)||"");
  var aika=(ans.alku?fmt(ans.alku):"")+((ans.alku&&ans.loppu)?" \\u2013 ":"")+(ans.loppu?fmt(ans.loppu):"");
  if(!aika)aika="\\u2013";
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Sprinklerij\\u00e4rjestelm\\u00e4n huoltop\\u00f6yt\\u00e4kirja</title>'
    +'<style>'
    +'body{font-family:"Trebuchet MS",Verdana,Geneva,sans-serif;color:#1b1b1b;margin:26px;max-width:760px}'
    +'h1{font-family:Georgia,"Times New Roman",serif;font-size:20px;letter-spacing:.4px;margin:0}'
    +'.brand{font-family:Georgia,serif;font-size:26px;font-weight:700;color:#c1121f;letter-spacing:3px}'
    +'.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c1121f;padding-bottom:12px}'
    +'.meta{width:100%;border-collapse:collapse;font-size:12px;margin:14px 0}'
    +'.meta td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top}.meta td.k{color:#666;width:150px}'
    +'.std{font-size:11px;color:#444;background:#faf5f5;border:1px solid #eddede;border-radius:6px;padding:8px 10px;margin:6px 0 4px;line-height:1.5}'
    +'table.chk{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}'
    +'table.chk th{background:#c1121f;color:#fff;font-family:Georgia,serif;text-align:left;padding:6px 8px;font-size:11px}'
    +'table.chk td{padding:6px 8px;border-bottom:1px solid #e6e6e6;vertical-align:top}'
    +'table.chk td.v{width:110px}table.chk td.d{width:100px;white-space:nowrap}'
    +'.huom{margin-top:16px;border:1px solid #bbb;border-radius:6px;min-height:60px;padding:10px;font-size:12px}'
    +'.foot{display:flex;justify-content:space-between;gap:24px;margin-top:22px}'
    +'.sign{min-width:230px;font-size:12px}.sign .line{border-bottom:1px solid #333;height:20px;margin-bottom:2px}'
    +'.company{margin-top:22px;border-top:2px solid #c1121f;padding-top:10px;font-size:11px;color:#333;line-height:1.55}'
    +'.company .n{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;letter-spacing:1px}'
    +'@media print{button{display:none}}'
    +'</style></head><body>'
    +'<div class="head"><div><div class="brand">SAVUKS</div><div style="font-size:11px;color:#666">Paloturvallisuuspalvelut</div></div>'
    +'<div style="text-align:right"><h1>Huoltop\\u00f6yt\\u00e4kirja</h1><div style="font-size:12px;color:#666">Sprinklerij\\u00e4rjestelm\\u00e4</div></div></div>'
    +'<table class="meta">'
    +'<tr><td class="k">Asiakas</td><td>'+esc(ctx.name||"\\u2013")+'</td><td class="k">P\\u00e4iv\\u00e4ys</td><td>'+fmt(ans.date||today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"\\u2013")+'</td><td class="k">Sijainti</td><td>'+site+'</td></tr>'
    +'<tr><td class="k">Laitetunnus</td><td>'+esc(dev.tag||"\\u2013")+'</td><td class="k">Huollon suoritusaika</td><td>'+aika+'</td></tr>'
    +'<tr><td class="k">Vastaava huoltop\\u00e4\\u00e4llikk\\u00f6</td><td>'+esc(ans.paallikko||"\\u2013")+'</td><td class="k">Ty\\u00f6numero</td><td>'+esc(ans.tyonro||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Ty\\u00f6n suorittajat</td><td>'+esc(ans.tekijat||"\\u2013")+'</td><td class="k">Tarkastusv\\u00e4li</td><td>'+esc(dev.inspInterval||dev.interval||"\\u2013")+'</td></tr>'
    +'</table>'
    +'<div class="std"><b>Noudatetut standardit ja m\\u00e4\\u00e4r\\u00e4ykset:</b> '+esc(SPR_STD)+'</div>'
    +'<table class="chk"><thead><tr><th>Laite / Osa</th><th>Toimenpide</th><th>Lis\\u00e4tiedot</th><th>P\\u00e4iv\\u00e4m\\u00e4\\u00e4r\\u00e4</th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div style="margin-top:16px;font-size:12px;font-weight:700">Yleiset huomiot</div><div class="huom">'+esc(ans.huomiot||"")+'</div>'
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
rep('const DRAFT_KEY="servalo_entry_drafts";', spr, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/sprink_patch.py

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
for t in "function openSprinkPk" "function saveSprinkPk" "function sprinkPk" "function sprItemsHtml" "function saveSprDraft" "id=\"sprinkOverlay\"" "servalo_sprink_drafts" "{openSprinkPk(devId);return;}" '"Sprinkleri"'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Mallidokumentin tunnisteet EIVÄT ole vuotaneet ---"
if grep -niE "Caverion|38731042|0148519|RATAPIHANKATU|Aleksi Julin|L\xc3\xa4hdesm\xc3\xa4ki|Toiva Jonne|010 4071|Treen Areena|Areenahotelli|Julin" servalo.html; then
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
git commit -m "Sprinklerijarjestelman huoltopoytakirja + uusi laiteryhma: komponenttiloki + pystymalli"
git push origin main
echo "VALMIS."
```

---

## Huom
- Prompti lisää laiteryhmän **Sprinkleri**. Aseta sprinklerilaitteistolle tämä ryhmä, niin
  `Luo pöytäkirja` avaa tämän komponenttilokin.
- Toimenpide-värit: Huollettu / Tarkastettu = vihreä, Korjattava = punainen,
  Ei koske = harmaa.
- Komponentit ovat `SPR_ITEMS`-taulukossa ja standardit `SPR_STD`-muuttujassa — kerro, jos
  haluat lisätä/muokata kohtia.
- Voit **liittää** valmiin raportin tai **luoda** pöytäkirjan kentistä.
- Puhelinnumero kirjoitetaan välilyönnillä (`044 3665638`).
