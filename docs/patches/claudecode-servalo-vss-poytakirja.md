# Claude Code -prompti: väestönsuojan tarkastuspöytäkirja (pystymalli + puhelinsyöttö)

Aja **Servalo-repon juuressa**. Prompti tekee muutokset, validoi, tarkistaa kielletyt
merkkijonot ja pushaa `main`-haaraan.

> **Riippuvuus:** aja **ensin** `claudecode-servalo-luo-poytakirja.md` ja
> `claudecode-servalo-paloilmoitin-poytakirja.md`. Skripti pysähtyy, jos
> `function openPaloilmPk` ei löydy. Reititys ankkuroidaan Paloilmoitin-riviin, joten
> toimii riippumatta muista laitepatcheista.
>
> Ryhmä **Väestönsuoja** on jo laiteryhmävalikossa — uutta ryhmää ei lisätä.

## Mitä tämä tekee

Väestönsuojan tarkastus on **kaksiosainen**: tarkastuskohteet (kunto) ja vanhenevat
tuotteet (viimeinen käyttöpäivä). Pöytäkirja on **pystymalli** (A4).

- **Laitekortin `📋 Luo pöytäkirja` -nappi** avaa väestönsuojalle (kun laitteen ryhmä on
  **Väestönsuoja**) oman **tarkastuslomakkeen** — täytettävissä puhelimella.
- **Tarkastuskohteet:** 33 kohtaa, kullekin tila (Kunnossa / Puute / Ei koske) + lisätiedot.
- **Vanhenevat tuotteet:** 10 tuotetta, kullekin tila (OK / Uusittava / Ei koske) +
  viimeinen käyttöpäivä + lisätiedot.
- **Suojan tiedot:** omistaja, isännöitsijä, huoltomies, suojelulohko/-yksikkö, suojaluokka,
  henkilömäärä, pinta-ala, tarkastuslaji, tarkastusnro, edellinen pöytäkirja.
- **Tehdyt työt** ja **lisätiedot** vapaana tekstinä; pöytäkirjassa myös vastuu- ja
  lakiviitteet.
- **Tallenna + luo pöytäkirja** kirjaa tarkastuksen laitteelle **ja** avaa Savuks-tyylisen
  pöytäkirjan (tulosta / tallenna PDF / jaa). **Liitä tai luo.** **Automaattitallennus.**

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function openPaloilmPk" servalo.html || { echo "VIRHE: openPaloilmPk puuttuu — aja ensin paloilmoitin-patch."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/vss_patch.py <<'PYEOF'
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
overlay = '''<div class="overlay" id="vssOverlay">
  <div class="modal" style="max-width:740px">
    <div class="modal-h"><span>Väestönsuojan tarkastus</span><span class="x" onclick="closeOverlay('vssOverlay')">×</span></div>
    <div class="modal-b" oninput="saveVsDraft()" onchange="saveVsDraft()">
      <input type="hidden" id="enVsDevId">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:150px"><label>Päiväys</label><input class="f" id="enVsDate" type="date"></div>
        <div class="field" style="flex:1;min-width:150px"><label>Tarkastuslaji</label><select class="f" id="enVsLaji"><option value=""></option><option>Käyttöönottotarkastus</option><option>Määräaikaistarkastus</option><option>Jälkitarkastus</option><option>Pyydetty tarkastus</option></select></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:150px"><label>Tarkastusnro</label><input class="f" id="enVsNro" placeholder="esim. 1"></div>
        <div class="field" style="flex:1;min-width:150px"><label>Edellinen pöytäkirja</label><input class="f" id="enVsPrev" placeholder="esim. 2017 / käyttöönotto"></div>
      </div>
      <div style="font-weight:700;margin:14px 0 4px;color:#c1121f">Suojan tiedot</div>
      <div class="field"><label>Kiinteistön omistaja</label><input class="f" id="enVsOmistaja" placeholder="Omistajan nimi"></div>
      <div class="field"><label>Isännöitsijä</label><input class="f" id="enVsIsannoitsija" placeholder="Isännöitsijä / toimisto"></div>
      <div class="field"><label>Huoltomies (nimi ja puhelin)</label><input class="f" id="enVsHuoltomies" placeholder="Nimi, puhelin"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:130px"><label>Suojelulohko</label><input class="f" id="enVsLohko"></div>
        <div class="field" style="flex:1;min-width:130px"><label>Suojeluyksikkö</label><input class="f" id="enVsYksikko"></div>
        <div class="field" style="flex:1;min-width:130px"><label>Suojaluokka</label><input class="f" id="enVsLuokka" placeholder="esim. S1"></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:130px"><label>Henkilömäärä</label><input class="f" id="enVsHenkilot" placeholder="esim. 102 henk."></div>
        <div class="field" style="flex:1;min-width:130px"><label>Pinta-ala m²</label><input class="f" id="enVsPinta" placeholder="esim. 77 m²"></div>
      </div>
      <div style="font-weight:700;margin:16px 0 4px;color:#c1121f">Tarkastuskohteet</div>
      <p class="hint" style="margin:0 0 8px">Tila: <b>Kunnossa</b> / <b>Puute</b> / <b>Ei koske</b> + lisätiedot.</p>
      <div id="vsCheck"></div>
      <div style="font-weight:700;margin:16px 0 4px;color:#c1121f">Vanhenevat tuotteet</div>
      <p class="hint" style="margin:0 0 8px">Tila (OK / Uusittava / Ei koske), viimeinen käyttöpäivä ja lisätiedot.</p>
      <div id="vsProd"></div>
      <div class="field"><label>Tehdyt työt</label><textarea class="f" id="enVsTyot" rows="2" placeholder="Tarkastuksessa tehdyt työt…"></textarea></div>
      <div class="field"><label>Lisätiedot / huomiot</label><textarea class="f" id="enVsLisa" rows="3" placeholder="Korjaussuositukset, huomiot…"></textarea></div>
      <div class="field"><label>Kiinteistön edustaja tarkastuksessa</label><input class="f" id="enVsEdustaja" placeholder="Nimi"></div>
      <div class="field"><label>\U0001F4F7 Kuva <span class="hint" style="font-weight:400">(sisäinen – asiakas ei näe)</span></label><input class="f" id="enVsPhoto" type="file" accept="image/*" capture="environment" onchange="previewVsPhoto()"><div id="enVsPhotoPrev" style="margin-top:8px"></div></div>
      <div class="field"><label>Liite (valmis raportti, valinnainen)</label><input class="f" id="enVsFile" type="file"></div>
      <p class="hint">Voit joko liittää valmiin raportin tai luoda pöytäkirjan täytetyistä kentistä.</p>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeOverlay('vssOverlay')">Peruuta</button>
      <button class="btn orange" onclick="saveVssPk()">Tallenna + luo pöytäkirja</button>
    </div>
  </div>
</div>

<!-- DEVICE FILE MODAL -->'''
rep('<!-- DEVICE FILE MODAL -->', overlay, 1)

# 2) Reititys: lisää haara Paloilmoitin-rivin jälkeen
rep('if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}',
'''if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}
  if(_d&&_d.group==="V\\u00e4est\\u00f6nsuoja"){openVssPk(devId);return;}''', 1)

# 3) VSS-toiminnot ennen luonnosmuuttujia
vs = '''const VSS_DRAFT_KEY="servalo_vss_drafts";
let _vsPhoto=null;
const VSS_CHECK=[
 {id:"c01",l:"suojaantulotie"},
 {id:"c02",l:"vss-merkit / viitoitus"},
 {id:"c03",l:"suojan ovet ja tiivisteet"},
 {id:"c04",l:"suojan k\\u00e4ytt\\u00f6tarkoitus"},
 {id:"c05",l:"sulkuhuone / -teltta ja rakenteet"},
 {id:"c06",l:"ylipaineventtiilit + tiivisteet"},
 {id:"c07",l:"normaali-ilmanvaihdon sulku"},
 {id:"c08",l:"vesijohtojen sulkuventtiilit"},
 {id:"c09",l:"l\\u00e4mp\\u00f6johtojen sulkuventtiilit"},
 {id:"c10",l:"vesipiste varusteineen"},
 {id:"c11",l:"padotusventtiili"},
 {id:"c12",l:"vuotovesien poistoj\\u00e4rjestelm\\u00e4"},
 {id:"c13",l:"ilmanjakokanavisto"},
 {id:"c14",l:"esisuodatin (c-lk. hiekkasuodatin)"},
 {id:"c15",l:"suodattimen luukut ja tiivisteet"},
 {id:"c16",l:"suojan materiaali / suojah\\u00e4kin lukitus"},
 {id:"c17",l:"ilmanvaihtolaitteisto"},
 {id:"c18",l:"ylipainemittari + putkisto"},
 {id:"c19",l:"ilmanottoputki ja -kanava"},
 {id:"c20",l:"h\\u00e4t\\u00e4poistumisk\\u00e4yt\\u00e4v\\u00e4"},
 {id:"c21",l:"k\\u00e4yt\\u00e4v\\u00e4nluukku + tiivisteet"},
 {id:"c22",l:"tiiveyskoe"},
 {id:"c23",l:"varavesis\\u00e4ili\\u00f6t"},
 {id:"c24",l:"j\\u00e4tevesis\\u00e4ili\\u00f6t"},
 {id:"c25",l:"kuivak\\u00e4ym\\u00e4l\\u00e4t"},
 {id:"c26",l:"v\\u00e4est\\u00f6nsuojamateriaali"},
 {id:"c27",l:"viestilaitteet / antenni"},
 {id:"c28",l:"s\\u00e4hk\\u00f6asennukset"},
 {id:"c29",l:"k\\u00e4ytt\\u00f6-, huolto- ja purkusuunnitelma"},
 {id:"c30",l:"pelastussuunnitelma"},
 {id:"c31",l:"sirpale- ja s\\u00e4teilysuojaus"},
 {id:"c32",l:"suojan siisteys"},
 {id:"c33",l:"koneen valaisin"}
];
const VSS_PROD=[
 {id:"p01",l:"paristot"},
 {id:"p02",l:"suojasidepakkaus"},
 {id:"p03",l:"kyp\\u00e4r\\u00e4t"},
 {id:"p04",l:"joditabletit"},
 {id:"p05",l:"vedens\\u00e4ilytysaine"},
 {id:"p06",l:"ensiapulaukku"},
 {id:"p07",l:"l\\u00e4mp\\u00f6peite"},
 {id:"p08",l:"s\\u00e4teilymittari (kalibrointi)"},
 {id:"p09",l:"suojanaamarit"},
 {id:"p10",l:"suojanaamarin suodattimet"}
];
function vsCheckOpts(){return '<option value=""></option><option>Kunnossa</option><option>Puute</option><option>Ei koske</option>';}
function vsProdOpts(){return '<option value=""></option><option>OK</option><option>Uusittava</option><option>Ei koske</option>';}
function vsCheckHtml(){
  return VSS_CHECK.map(function(it){
    return '<div class="field" style="border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:6px">'
      +'<label style="font-weight:600;display:block;margin-bottom:4px">'+esc(it.l)+'</label>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<select class="f" id="vsc_'+it.id+'_s" style="flex:0 0 150px">'+vsCheckOpts()+'</select>'
      +'<input class="f" id="vsc_'+it.id+'_i" placeholder="Lis\\u00e4tiedot" style="flex:1;min-width:160px">'
      +'</div></div>';
  }).join("");
}
function vsProdHtml(){
  return VSS_PROD.map(function(it){
    return '<div class="field" style="border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:6px">'
      +'<label style="font-weight:600;display:block;margin-bottom:4px">'+esc(it.l)+'</label>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<select class="f" id="vsp_'+it.id+'_s" style="flex:0 0 150px">'+vsProdOpts()+'</select>'
      +'<input class="f" id="vsp_'+it.id+'_d" type="date" style="flex:0 0 150px" title="Viimeinen k\\u00e4ytt\\u00f6p\\u00e4iv\\u00e4">'
      +'<input class="f" id="vsp_'+it.id+'_i" placeholder="Lis\\u00e4tiedot" style="flex:1;min-width:150px">'
      +'</div></div>';
  }).join("");
}
function readVsDrafts(){try{return JSON.parse(localStorage.getItem(VSS_DRAFT_KEY)||"{}");}catch(e){return {};}}
function collectVss(){
  var chk={};VSS_CHECK.forEach(function(it){var se=document.getElementById("vsc_"+it.id+"_s"),ie=document.getElementById("vsc_"+it.id+"_i");chk[it.id]={s:se?se.value:"",i:ie?ie.value:""};});
  var prod={};VSS_PROD.forEach(function(it){var se=document.getElementById("vsp_"+it.id+"_s"),de=document.getElementById("vsp_"+it.id+"_d"),ie=document.getElementById("vsp_"+it.id+"_i");prod[it.id]={s:se?se.value:"",d:de?de.value:"",i:ie?ie.value:""};});
  return {
    date:document.getElementById("enVsDate").value||today(),
    laji:document.getElementById("enVsLaji").value,
    nro:document.getElementById("enVsNro").value,
    prev:document.getElementById("enVsPrev").value,
    omistaja:document.getElementById("enVsOmistaja").value,
    isannoitsija:document.getElementById("enVsIsannoitsija").value,
    huoltomies:document.getElementById("enVsHuoltomies").value,
    lohko:document.getElementById("enVsLohko").value,
    yksikko:document.getElementById("enVsYksikko").value,
    luokka:document.getElementById("enVsLuokka").value,
    henkilot:document.getElementById("enVsHenkilot").value,
    pinta:document.getElementById("enVsPinta").value,
    tyot:document.getElementById("enVsTyot").value,
    lisa:document.getElementById("enVsLisa").value,
    edustaja:document.getElementById("enVsEdustaja").value,
    check:chk,prod:prod,photo:_vsPhoto
  };
}
function saveVsDraft(){
  var id=document.getElementById("enVsDevId").value;if(!id)return;
  var all=readVsDrafts();var a=collectVss();a.ts=Date.now();all[id]=a;
  try{localStorage.setItem(VSS_DRAFT_KEY,JSON.stringify(all));}catch(e){}
}
function clearVsDraft(id){var all=readVsDrafts();delete all[id];try{localStorage.setItem(VSS_DRAFT_KEY,JSON.stringify(all));}catch(e){}}
function previewVsPhoto(){
  var pi=document.getElementById("enVsPhoto"),pp=document.getElementById("enVsPhotoPrev");
  if(!pi||!pp)return;pp.innerHTML="";
  var fl=pi.files&&pi.files[0];if(!fl)return;
  if(fl.size>4*1024*1024){alert("Kuva on liian suuri (max ~4 MB).");pi.value="";return;}
  var r=new FileReader();
  r.onload=function(){pp.innerHTML='<img src="'+r.result+'" alt="Esikatselu" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px">';_vsPhoto={name:fl.name,type:fl.type,data:r.result};saveVsDraft();};
  r.readAsDataURL(fl);
}
function openVssPk(devId){
  if(!can("devices_edit"))return;
  document.getElementById("enVsDevId").value=devId;
  document.getElementById("vsCheck").innerHTML=vsCheckHtml();
  document.getElementById("vsProd").innerHTML=vsProdHtml();
  ["enVsDate","enVsLaji","enVsNro","enVsPrev","enVsOmistaja","enVsIsannoitsija","enVsHuoltomies","enVsLohko","enVsYksikko","enVsLuokka","enVsHenkilot","enVsPinta","enVsTyot","enVsLisa","enVsEdustaja"].forEach(function(id){var el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("enVsDate").value=today();
  var pf=document.getElementById("enVsPhoto"),pp=document.getElementById("enVsPhotoPrev"),ff=document.getElementById("enVsFile");
  if(pf)pf.value="";if(pp)pp.innerHTML="";if(ff)ff.value="";_vsPhoto=null;
  var dr=readVsDrafts()[devId];
  if(dr){
    ["date","laji","nro","prev","omistaja","isannoitsija","huoltomies","lohko","yksikko","luokka","henkilot","pinta","tyot","lisa","edustaja"].forEach(function(k){
      var map={date:"enVsDate",laji:"enVsLaji",nro:"enVsNro",prev:"enVsPrev",omistaja:"enVsOmistaja",isannoitsija:"enVsIsannoitsija",huoltomies:"enVsHuoltomies",lohko:"enVsLohko",yksikko:"enVsYksikko",luokka:"enVsLuokka",henkilot:"enVsHenkilot",pinta:"enVsPinta",tyot:"enVsTyot",lisa:"enVsLisa",edustaja:"enVsEdustaja"};
      if(dr[k]!=null&&dr[k]!==""){var el=document.getElementById(map[k]);if(el)el.value=dr[k];}
    });
    if(dr.check)VSS_CHECK.forEach(function(it){var v=dr.check[it.id];if(!v)return;var se=document.getElementById("vsc_"+it.id+"_s"),ie=document.getElementById("vsc_"+it.id+"_i");if(se&&v.s!=null)se.value=v.s;if(ie&&v.i!=null)ie.value=v.i;});
    if(dr.prod)VSS_PROD.forEach(function(it){var v=dr.prod[it.id];if(!v)return;var se=document.getElementById("vsp_"+it.id+"_s"),de=document.getElementById("vsp_"+it.id+"_d"),ie=document.getElementById("vsp_"+it.id+"_i");if(se&&v.s!=null)se.value=v.s;if(de&&v.d!=null)de.value=v.d;if(ie&&v.i!=null)ie.value=v.i;});
    if(dr.photo){_vsPhoto=dr.photo;if(pp)pp.innerHTML='<img src="'+dr.photo.data+'" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px"><div class="hint">Palautettu tallentamaton kuva</div>';}
  }
  show("vssOverlay");
}
function saveVssPk(){
  var devId=document.getElementById("enVsDevId").value;
  var d=db.devices.find(function(x){return x.id===devId;});if(!d)return;
  var ans=collectVss();
  var entry={date:ans.date,pohja:"V\\u00e4est\\u00f6nsuojan tarkastus",comment:(ans.lisa||"").trim(),checklist:ans};
  if(_vsPhoto)entry.photo=_vsPhoto;
  var finalize=function(){
    d.inspections=d.inspections||[];
    d.inspections.unshift(entry);
    d.inspInterval=d.inspInterval||d.interval;
    d.inspLast=entry.date;d.inspNext=addInterval(entry.date,d.inspInterval||d.interval);
    d.updated=today();save();clearVsDraft(devId);closeOverlay("vssOverlay");renderDevTab();
    vssPk(d,pkCtxFor(d),ans);
  };
  var ff=document.getElementById("enVsFile");
  if(ff&&ff.files&&ff.files[0]){
    var fl=ff.files[0];
    if(fl.size>4*1024*1024){alert("Tiedosto on liian suuri (max ~4 MB).");return;}
    var r=new FileReader();
    r.onload=function(){entry.file={name:fl.name,type:fl.type,data:r.result};finalize();};
    r.onerror=function(){alert("Tiedoston luku ep\\u00e4onnistui.");};
    r.readAsDataURL(fl);
  } else finalize();
}
function vssPk(dev,ctx,ans){
  ctx=ctx||{name:"",address:""};ans=ans||{check:{},prod:{}};
  var w=window.open("","_blank");
  if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  var cstat=function(v){
    if(v==="Kunnossa")return '<span style="color:#1a7f37;font-weight:700">Kunnossa</span>';
    if(v==="Puute")return '<span style="color:#c1121f;font-weight:700">Puute</span>';
    if(v==="Ei koske")return '<span style="color:#888">Ei koske</span>';
    if(v)return esc(v);
    return '<span style="color:#bbb">\\u2013</span>';
  };
  var pstat=function(v){
    if(v==="OK")return '<span style="color:#1a7f37;font-weight:700">OK</span>';
    if(v==="Uusittava")return '<span style="color:#b26a00;font-weight:700">Uusittava</span>';
    if(v==="Ei koske")return '<span style="color:#888">Ei koske</span>';
    if(v)return esc(v);
    return '<span style="color:#bbb">\\u2013</span>';
  };
  var crows=VSS_CHECK.map(function(it){
    var v=(ans.check&&ans.check[it.id])||{};
    return '<tr><td>'+esc(it.l)+'</td><td class="v">'+cstat(v.s||"")+'</td><td>'+(v.i?esc(v.i):"")+'</td></tr>';
  }).join("");
  var prows=VSS_PROD.map(function(it){
    var v=(ans.prod&&ans.prod[it.id])||{};
    var dd=v.d?fmt(v.d):'<span style="color:#bbb">\\u2013</span>';
    return '<tr><td>'+esc(it.l)+'</td><td class="v">'+pstat(v.s||"")+'</td><td class="d">'+dd+'</td><td>'+(v.i?esc(v.i):"")+'</td></tr>';
  }).join("");
  var ph=(dev.inspections&&dev.inspections[0]&&dev.inspections[0].photo&&dev.inspections[0].photo.data)||(ans.photo&&ans.photo.data)||"";
  var photoHtml=ph?('<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">Kuva</div><img src="'+ph+'" style="max-width:300px;max-height:300px;border:1px solid #ccc;border-radius:6px"></div>'):"";
  var worker=currentUser?currentUser.name:"";
  var site=esc(dev.locDetail||siteName(dev.locId)||"");
  var vastuu="V\\u00e4est\\u00f6nsuojan kunnosta vastaa lopullisesti rakennuksen omistaja tai haltija. V\\u00e4est\\u00f6nsuojan on oltava samassa kunnossa kuin se oli rakennuksen valmistuessa. Palotarkastaja suorittaa viranomaisvalvonnan palotarkastuksen yhteydess\\u00e4.";
  var laki="Annetut korjaussuositukset perustuvat pelastuslakiin sek\\u00e4 VN:n ja SM:n asetuksiin.";
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>V\\u00e4est\\u00f6nsuojan tarkastusp\\u00f6yt\\u00e4kirja</title>'
    +'<style>'
    +'body{font-family:"Trebuchet MS",Verdana,Geneva,sans-serif;color:#1b1b1b;margin:26px;max-width:760px}'
    +'h1{font-family:Georgia,"Times New Roman",serif;font-size:20px;letter-spacing:.4px;margin:0}'
    +'.brand{font-family:Georgia,serif;font-size:26px;font-weight:700;color:#c1121f;letter-spacing:3px}'
    +'.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c1121f;padding-bottom:12px}'
    +'.meta{width:100%;border-collapse:collapse;font-size:12px;margin:14px 0}'
    +'.meta td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top}.meta td.k{color:#666;width:150px}'
    +'.sub{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;margin:18px 0 4px}'
    +'table.chk{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}'
    +'table.chk th{background:#c1121f;color:#fff;font-family:Georgia,serif;text-align:left;padding:6px 8px;font-size:11px}'
    +'table.chk td{padding:5px 8px;border-bottom:1px solid #e6e6e6;vertical-align:top}'
    +'table.chk td.v{width:110px}table.chk td.d{width:100px;white-space:nowrap}'
    +'.huom{margin-top:10px;border:1px solid #bbb;border-radius:6px;min-height:44px;padding:10px;font-size:12px}'
    +'.note{font-size:11px;color:#444;background:#faf5f5;border:1px solid #eddede;border-radius:6px;padding:8px 10px;margin:12px 0;line-height:1.5}'
    +'.foot{display:flex;justify-content:space-between;gap:24px;margin-top:22px}'
    +'.sign{min-width:230px;font-size:12px}.sign .line{border-bottom:1px solid #333;height:20px;margin-bottom:2px}'
    +'.company{margin-top:22px;border-top:2px solid #c1121f;padding-top:10px;font-size:11px;color:#333;line-height:1.55}'
    +'.company .n{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;letter-spacing:1px}'
    +'@media print{button{display:none}}'
    +'</style></head><body>'
    +'<div class="head"><div><div class="brand">SAVUKS</div><div style="font-size:11px;color:#666">Paloturvallisuuspalvelut</div></div>'
    +'<div style="text-align:right"><h1>Tarkastusp\\u00f6yt\\u00e4kirja</h1><div style="font-size:12px;color:#666">V\\u00e4est\\u00f6nsuoja</div></div></div>'
    +'<table class="meta">'
    +'<tr><td class="k">Kohde / asiakas</td><td>'+esc(ctx.name||"\\u2013")+'</td><td class="k">P\\u00e4iv\\u00e4ys</td><td>'+fmt(ans.date||today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"\\u2013")+'</td><td class="k">Tarkastuslaji</td><td>'+esc(ans.laji||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Laitetunnus</td><td>'+esc(dev.tag||"\\u2013")+'</td><td class="k">Sijainti</td><td>'+site+'</td></tr>'
    +'<tr><td class="k">Tarkastusnro</td><td>'+esc(ans.nro||"\\u2013")+'</td><td class="k">Edellinen p\\u00f6yt\\u00e4kirja</td><td>'+esc(ans.prev||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Omistaja</td><td>'+esc(ans.omistaja||"\\u2013")+'</td><td class="k">Is\\u00e4nn\\u00f6itsij\\u00e4</td><td>'+esc(ans.isannoitsija||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Huoltomies</td><td>'+esc(ans.huoltomies||"\\u2013")+'</td><td class="k">Suojaluokka</td><td>'+esc(ans.luokka||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Suojelulohko</td><td>'+esc(ans.lohko||"\\u2013")+'</td><td class="k">Suojeluyksikk\\u00f6</td><td>'+esc(ans.yksikko||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Henkil\\u00f6m\\u00e4\\u00e4r\\u00e4</td><td>'+esc(ans.henkilot||"\\u2013")+'</td><td class="k">Pinta-ala</td><td>'+esc(ans.pinta||"\\u2013")+'</td></tr>'
    +'<tr><td class="k">Tarkastusv\\u00e4li</td><td>'+esc(dev.inspInterval||dev.interval||"\\u2013")+'</td><td class="k"></td><td></td></tr>'
    +'</table>'
    +'<div class="sub">Tarkastuskohteet</div>'
    +'<table class="chk"><thead><tr><th>Tarkastuskohde</th><th>Tila</th><th>Lis\\u00e4tiedot</th></tr></thead><tbody>'+crows+'</tbody></table>'
    +'<div class="sub">Vanhenevat tuotteet</div>'
    +'<table class="chk"><thead><tr><th>Tuote</th><th>Tila</th><th>Viimeinen k\\u00e4ytt\\u00f6p\\u00e4iv\\u00e4</th><th>Lis\\u00e4tiedot</th></tr></thead><tbody>'+prows+'</tbody></table>'
    +'<div style="margin-top:16px;font-size:12px;font-weight:700">Tehdyt ty\\u00f6t</div><div class="huom">'+esc(ans.tyot||"")+'</div>'
    +'<div style="margin-top:12px;font-size:12px;font-weight:700">Lis\\u00e4tiedot / korjaussuositukset</div><div class="huom">'+esc(ans.lisa||"")+'</div>'
    +photoHtml
    +'<div class="note">'+esc(vastuu)+'<br>'+esc(laki)+'</div>'
    +'<div class="foot"><div class="sign"><div style="margin-bottom:14px"><div style="font-size:11px;color:#666">Kiinteist\\u00f6n edustaja tarkastuksessa</div><div class="line"></div>'+esc(ans.edustaja||"")+'</div>'
    +'<div><div style="font-size:11px;color:#666">Tarkastuksen laatija / tekij\\u00e4</div><div class="line"></div>'+esc(worker)+'</div></div>'
    +'<div class="sign"><div><div style="font-size:11px;color:#666">P\\u00e4iv\\u00e4m\\u00e4\\u00e4r\\u00e4</div><div class="line"></div>'+fmt(ans.date||today())+'</div></div></div>'
    +'<div class="company"><span class="n">SAVUKS</span> &nbsp; puh. 044 3665638 &nbsp; info@savuks.com &nbsp; www.savuks.com<br>Santalankulmantie 8, 21290 Rusko &nbsp; Y-tunnus 3465682-5</div>'
    +'<p style="margin-top:20px"><button onclick="window.print()" style="background:#c1121f;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer">\\U0001f5a8 Tulosta / Tallenna PDF</button></p>'
    +'</body></html>';
  w.document.write(html);
  w.document.close();
}
const DRAFT_KEY="servalo_entry_drafts";'''
rep('const DRAFT_KEY="servalo_entry_drafts";', vs, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/vss_patch.py

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
for t in "function openVssPk" "function saveVssPk" "function vssPk" "function vsCheckHtml" "function vsProdHtml" "function saveVsDraft" "id=\"vssOverlay\"" "servalo_vss_drafts" "{openVssPk(devId);return;}"; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Mallidokumentin tunnisteet EIVÄT ole vuotaneet ---"
if grep -niE "Innovestor|Isohaavisto|0504783408|Raeal|Areenakatu|044 9858 923|0449858923|Lempäälä|Julin" servalo.html; then
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
git commit -m "Vaestonsuojan tarkastuspoytakirja: tarkastuskohteet + vanhenevat tuotteet + pystymalli"
git push origin main
echo "VALMIS."
```

---

## Huom
- Nappi reitittää automaattisesti: **Väestönsuoja**-ryhmän laitteella `Luo pöytäkirja` avaa
  tämän tarkastuslomakkeen.
- Tarkastuskohteet: Kunnossa = vihreä, Puute = punainen, Ei koske = harmaa.
  Vanhenevat tuotteet: OK = vihreä, Uusittava = oranssi, Ei koske = harmaa.
- Kohteet ovat `VSS_CHECK`- ja `VSS_PROD`-taulukoissa — kerro, jos haluat lisätä/muokata.
- Voit **liittää** valmiin raportin tai **luoda** pöytäkirjan kentistä.
- Puhelinnumero kirjoitetaan välilyönnillä (`044 3665638`).
