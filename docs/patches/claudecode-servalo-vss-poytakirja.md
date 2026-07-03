# Claude Code -prompti: väestönsuojan tarkastuspöytäkirja (SPEK 2024 -pohjainen, ohjeistettu)

Aja **Servalo-repon juuressa**. Prompti tekee muutokset, validoi, tarkistaa kielletyt
merkkijonot ja pushaa `main`-haaraan.

> **Riippuvuus:** aja **ensin** `claudecode-servalo-luo-poytakirja.md` ja
> `claudecode-servalo-paloilmoitin-poytakirja.md`. Skripti pysähtyy, jos
> `function openPaloilmPk` ei löydy. Reititys ankkuroidaan Paloilmoitin-riviin, joten
> toimii riippumatta muista laitepatcheista.
>
> Ryhmä **Väestönsuoja** on jo laiteryhmävalikossa — uutta ryhmää ei lisätä.

## Mitä tämä tekee

Väestönsuojan tarkastus on rakennettu **SPEK 2024** -ohjeen ja **RT 92-11173-S1** -kortin
mukaisesti. Pöytäkirja on **pystymalli** (A4) ja täytettävissä puhelimella.

- **Laitekortin `📋 Luo pöytäkirja` -nappi** avaa väestönsuojalle (ryhmä **Väestönsuoja**)
  oman tarkastuslomakkeen.
- **10 osa-aluetta** (ovet, tiivisteet, siisteys, ylipaineventtiilit/mittari, rakenteet &
  merkinnät, käyttöönottosuunnitelma, varusteet, padotusventtiili & viemärit, varapoistumistie,
  ilmanvaihtokone/hiekkasuodatin). Kullekin **4-tason luokitus** — OK / HUOLTO / PUUTE /
  VAARATILANNE (+ Ei koske) — havainnot ja **sisäänrakennettu ohjeteksti** (Ohje-painike).
- **Tiiveyskoe (painekoe):** tila, tulos, ylipaine (Pa), kesto (min), mittausväline ja seuraava
  koe. Sisäänrakennettu SPEK-ohje (≥10 min, suositus 15–20 min, tavoite 100–300 Pa,
  U-putkimittari, väli väh. 10 v).
- **Varusteluettelo:** 18 varustetta, kullekin tila (OK / Uusittava / Puuttuu / Ei koske),
  päiväys/vanhenee ja havainnot. Rajallisen käyttöiän varusteet merkitty (seuraa päiväystä).
- **Kokonaisarvio:** OK / HUOLTO / PUUTE / VAARATILANNE.
- **Suojan tiedot:** omistaja, isännöitsijä, huoltomies, suojelulohko/-yksikkö, suojaluokka,
  henkilömäärä, pinta-ala, tarkastuslaji, tarkastusnro, edellinen pöytäkirja.
- **Tallenna + luo pöytäkirja** kirjaa tarkastuksen laitteelle **ja** avaa Savuks-tyylisen
  pöytäkirjan (tulosta / tallenna PDF / jaa). **Liitä tai luo.** **Automaattitallennus.**
  Pöytäkirjassa myös vastuu-, luokitus- ja lakiviitteet.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function openPaloilmPk" servalo.html || { echo "VIRHE: openPaloilmPk puuttuu — aja ensin paloilmoitin-patch."; exit 1; }
grep -qF "enVsTkPaine" servalo.html && { echo "VIRHE: laajennettu VSS-pöytäkirja on jo asennettu — patch on jo ajettu."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/vss_patch.py <<'PYEOF'
import io, sys, re

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

# 0) Poista aiempi (suppeampi) VSS-toteutus, jos se on jo asennettu — patch on korvaava.
if '<div class="overlay" id="vssOverlay">' in s:
    s2 = re.sub(r'<div class="overlay" id="vssOverlay">[\s\S]*?\n</div>\n\n<!-- DEVICE FILE MODAL -->',
                '<!-- DEVICE FILE MODAL -->', s, count=1)
    if s2 == s:
        print("VIRHE: vanhaa vssOverlay-lohkoa ei osattu poistaa."); sys.exit(1)
    s = s2
if 'const VSS_DRAFT_KEY="servalo_vss_drafts";' in s:
    s2 = re.sub(r'const VSS_DRAFT_KEY="servalo_vss_drafts";[\s\S]*?\nconst DRAFT_KEY="servalo_entry_drafts";',
                'const DRAFT_KEY="servalo_entry_drafts";', s, count=1)
    if s2 == s:
        print("VIRHE: vanhaa VSS-funktiolohkoa ei osattu poistaa."); sys.exit(1)
    s = s2

# 1) Uusi overlay ennen laitetiedostomodaalia
overlay = '''<div class="overlay" id="vssOverlay">
  <div class="modal" style="max-width:760px">
    <div class="modal-h"><span>Väestönsuojan tarkastus</span><span class="x" onclick="closeOverlay('vssOverlay')">×</span></div>
    <div class="modal-b" oninput="saveVsDraft()" onchange="saveVsDraft()">
      <input type="hidden" id="enVsDevId">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:150px"><label>Päiväys</label><input class="f" id="enVsDate" type="date"></div>
        <div class="field" style="flex:1;min-width:150px"><label>Tarkastuslaji</label><select class="f" id="enVsLaji"><option value=""></option><option>Vuosittainen tarkastus</option><option>Käyttöönottotarkastus</option><option>Tiiveyskoe / perushuolto</option><option>Jälkitarkastus</option><option>Pyydetty tarkastus</option></select></div>
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
      <div style="font-weight:700;margin:16px 0 4px;color:#c1121f">Tarkastuskohteet (10 osa-aluetta)</div>
      <p class="hint" style="margin:0 0 8px">Luokitus: <b>OK</b> / <b>HUOLTO</b> / <b>PUUTE</b> / <b>VAARATILANNE</b> (tai Ei koske) + havainnot. Avaa <b>Ohje</b> nähdäksesi tarkastusohjeen.</p>
      <div id="vsCheck"></div>
      <div style="font-weight:700;margin:16px 0 4px;color:#c1121f">Tiiveyskoe (painekoe)</div>
      <p class="hint" style="margin:0 0 8px">SPEK 2024: ylipaineen pysyttävä väh. 10 min (suositus 15–20 min), tavoite 100–300 Pa, U-putkimittari. Väli väh. 10 v tai peruskorjauksen jälkeen.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:180px"><label>Tiiveyskokeen tila</label><select class="f" id="enVsTkTehty"><option value=""></option><option>Tehty tässä tarkastuksessa</option><option>Ei tehty (ei ajankohtainen)</option><option>Erillinen huolto</option></select></div>
        <div class="field" style="flex:1;min-width:130px"><label>Tulos</label><select class="f" id="enVsTkTulos"><option value=""></option><option>Hyväksytty</option><option>Hylätty</option><option>Ei tehty</option></select></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:110px"><label>Ylipaine (Pa)</label><input class="f" id="enVsTkPaine" placeholder="100–300"></div>
        <div class="field" style="flex:1;min-width:110px"><label>Kesto (min)</label><input class="f" id="enVsTkKesto" placeholder="≥10"></div>
        <div class="field" style="flex:1;min-width:140px"><label>Mittausväline</label><input class="f" id="enVsTkValine" placeholder="U-putkimittari"></div>
      </div>
      <div class="field" style="max-width:240px"><label>Seuraava tiiveyskoe</label><input class="f" id="enVsTkSeur" type="date"></div>
      <div style="font-weight:700;margin:16px 0 4px;color:#c1121f">Varusteluettelo</div>
      <p class="hint" style="margin:0 0 8px">Tila (OK / Uusittava / Puuttuu / Ei koske), päiväys/vanhenee ja havainnot. ⏱ = seuraa päiväystä (rajallinen käyttöikä).</p>
      <div id="vsProd"></div>
      <div style="font-weight:700;margin:16px 0 4px;color:#c1121f">Kokonaisarvio</div>
      <div class="field" style="max-width:260px"><select class="f" id="enVsArvio"><option value=""></option><option>OK</option><option>HUOLTO</option><option>PUUTE</option><option>VAARATILANNE</option></select></div>
      <div class="field"><label>Tehdyt työt</label><textarea class="f" id="enVsTyot" rows="2" placeholder="Tarkastuksessa tehdyt työt…"></textarea></div>
      <div class="field"><label>Lisätiedot / korjaussuositukset</label><textarea class="f" id="enVsLisa" rows="3" placeholder="Korjaussuositukset, huomiot…"></textarea></div>
      <div class="field"><label>Kiinteistön edustaja tarkastuksessa</label><input class="f" id="enVsEdustaja" placeholder="Nimi"></div>
      <div class="field"><label>📷 Kuva <span class="hint" style="font-weight:400">(sisäinen – asiakas ei näe)</span></label><input class="f" id="enVsPhoto" type="file" accept="image/*" capture="environment" onchange="previewVsPhoto()"><div id="enVsPhotoPrev" style="margin-top:8px"></div></div>
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

# 2) Reititys: lisää haara Paloilmoitin-rivin jälkeen (vain jos puuttuu)
if 'openVssPk(devId);return;' not in s:
    rep('if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}',
'''if(_d&&_d.group==="Paloilmoitin"){openPaloilmPk(devId);return;}
  if(_d&&_d.group==="Väestönsuoja"){openVssPk(devId);return;}''', 1)

# 3) VSS-toiminnot ennen luonnosmuuttujia
vs = '''const VSS_DRAFT_KEY="servalo_vss_drafts";
let _vsPhoto=null;
const VSS_CHECK=[
 {id:"o1",l:"1. Ovet ja sisäänkäynti",help:"Tarkasta oven sijainti, kunto ja kiinnitykset. Varmista, että kaikki ovikomponentit (kahvat, saranat, salvat, lukot) ovat tallessa ja ehjiä. Puhdista ja voitele liikkuvat osat kevyesti. Käyttöönotossa tai tiiveyskokeessa kirjaa purkutyöt ja tarvittavat muutokset."},
 {id:"o2",l:"2. Ovien tiivisteet",help:"Tarkasta tiivisteiden kunto, halkeamat ja kovettumat. Puhdista ja rasvaa silikonilla, vaihda vaurioituneet tiivisteet. Kirjaa vaihdot ja mahdolliset puutteet."},
 {id:"o3",l:"3. Yleinen siisteys",help:"Tarkasta, ettei tilassa ole ylimääräistä tavaraa, roskia tai esteitä. Varmista kulkureittien ja poistumisteiden esteettömyys. Kirjaa siivoustarve ja liitä kuva tarvittaessa."},
 {id:"o4",l:"4. Ylipaineventtiilit ja mittari",help:"Tarkasta venttiilit, laipat ja tiivisteet. Tarkasta ylipainemittari (U-putkimittari): mittari ehjä, letkut kiinni, nesteen pinta näkyvissä — lisää tarvittaessa vettä tai glykoliseosta. Puhdista venttiilit ja vaihda tiivisteet tarvittaessa."},
 {id:"o5",l:"5. Rakenteet ja merkinnät",help:"Tarkasta seinien, katon ja lattian kunto (halkeamat, kosteus, ruoste). Varmista sähkölaitteiden ja valaistuksen toiminta. Tarkasta merkit ja opasteet (luettavuus, sijainti). Testaa puhelin- ja TV-yhteydet sekä matkapuhelimen kuuluvuus; jos ei kuulu, kirjaa vahvistimen tarve."},
 {id:"o6",l:"6. Käyttöönottosuunnitelma",help:"Tarkasta, että käyttöönottosuunnitelma on olemassa, ajantasainen ja helposti löydettävissä. Varmista, että siinä on ohjeet 72 tunnin käyttöönottoon. Kirjaa päiväys ja puuttuvat liitteet."},
 {id:"o7",l:"7. Varusteet ja tarvikkeet",help:"Tarkasta, että SPEK 2024:n mukaiset perusvarusteet ovat olemassa, ehjiä ja käyttökunnossa. Tarkasta päiväykset ja arvioi uusimistarve. Erittele varusteet alla olevaan varusteluetteloon. Majoitus- ja ruokailutarvikkeet tuodaan vasta käyttöönoton yhteydessä."},
 {id:"o8",l:"8. Padotusventtiili ja viemärit",help:"Tarkasta venttiilin liikkuvuus, tiivisteet ja vuotojen jäljet. Varmista, ettei venttiilipesässä tai ympäröivässä lattiassa ole vettä. Kevyt voitelu (CRC-tyyppinen aine), ettei venttiili ruostu. Testaa avaamalla ja sulkemalla kevyesti. Kirjaa vesihavaintojen syyt."},
 {id:"o9",l:"9. Varapoistumistie",help:"Tarkasta käytävänluukun tiivisteet, esteettömyys ja opasteet. Testaa valaistus ja toimivuus. Kirjaa havainnot ja liitä kuva tarvittaessa."},
 {id:"o10",l:"10. Ilmanvaihtokone / hiekkasuodatin",help:"Tarkasta aktiivihiilisuodattimen olemassaolo, päiväys ja kunto (uusittava, jos yli 10 v tai merkinnät puuttuvat). Yleiskunto ja puhtaus; pyöräytä roottori käsin (kevyt liike, ei ääntä); tarkasta johdotukset, liitokset ja maadoitus; koekäytä lyhyesti (melu, värinä, pyörimissuunta). Hiekkasuodatin: kansi ja tiivisteet ehjät, hiekkapinta tasainen, ei kosteutta tai paakkuja — hiekkaa ei lapioida rutiinitarkastuksessa. Puutteista PUUTE ja modernisointisuositus."}
];
const VSS_PROD=[
 {id:"p01",l:"Vesisäiliöt (20–40 l, kannelliset)"},
 {id:"p02",l:"Käsipumppu / vedenottoväline"},
 {id:"p03",l:"Vedenpuhdistustabletit / -aine",exp:true},
 {id:"p04",l:"Joditabletit",exp:true},
 {id:"p05",l:"WC-astiat ja tarvikkeet"},
 {id:"p06",l:"Jäteastiat / jätepussit"},
 {id:"p07",l:"Lapio / rautakanki / sorkkarauta"},
 {id:"p08",l:"Ensiapulaukku",exp:true},
 {id:"p09",l:"Sidetarpeet ja desinfiointiaineet",exp:true},
 {id:"p10",l:"Hengityssuojaimet",exp:true},
 {id:"p11",l:"Suodattimet ja aktiivihiilisuodatin",exp:true},
 {id:"p12",l:"Suojanaamarit ja suodatinpatruunat",exp:true},
 {id:"p13",l:"Taskulamppu / ladattava valaisin"},
 {id:"p14",l:"Paristot",exp:true},
 {id:"p15",l:"Radiovastaanotin (paristokäyttöinen)"},
 {id:"p16",l:"Opasteet ja merkinnät"},
 {id:"p17",l:"Alkusammutuskalusto (sammutuspeite / vesitynnyri)"},
 {id:"p18",l:"Suojakäsineet ja varoitusnauha"}
];
function vsCheckOpts(){return '<option value=""></option><option>OK</option><option>HUOLTO</option><option>PUUTE</option><option>VAARATILANNE</option><option>Ei koske</option>';}
function vsProdOpts(){return '<option value=""></option><option>OK</option><option>Uusittava</option><option>Puuttuu</option><option>Ei koske</option>';}
function vsCheckHtml(){
  return VSS_CHECK.map(function(it){
    return '<div class="field" style="border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:6px">'
      +'<label style="font-weight:600;display:block;margin-bottom:4px">'+esc(it.l)+'</label>'
      +'<details style="margin-bottom:6px"><summary style="cursor:pointer;color:#c1121f;font-size:11px;font-weight:600">Ohje</summary>'
      +'<div style="font-size:11px;color:#555;background:#faf5f5;border:1px solid #eddede;border-radius:6px;padding:6px 8px;margin-top:4px;line-height:1.5">'+esc(it.help)+'</div></details>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<select class="f" id="vsc_'+it.id+'_s" style="flex:0 0 160px">'+vsCheckOpts()+'</select>'
      +'<input class="f" id="vsc_'+it.id+'_i" placeholder="Havainnot / toimenpiteet" style="flex:1;min-width:160px">'
      +'</div></div>';
  }).join("");
}
function vsProdHtml(){
  return VSS_PROD.map(function(it){
    var mark=it.exp?' <span title="Seuraa päiväystä (rajallinen käyttöikä)" style="color:#b26a00">⏱</span>':'';
    return '<div class="field" style="border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:6px">'
      +'<label style="font-weight:600;display:block;margin-bottom:4px">'+esc(it.l)+mark+'</label>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<select class="f" id="vsp_'+it.id+'_s" style="flex:0 0 150px">'+vsProdOpts()+'</select>'
      +'<input class="f" id="vsp_'+it.id+'_d" type="date" style="flex:0 0 150px" title="Päiväys / vanhenee">'
      +'<input class="f" id="vsp_'+it.id+'_i" placeholder="Havainnot" style="flex:1;min-width:150px">'
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
    tkTehty:document.getElementById("enVsTkTehty").value,
    tkTulos:document.getElementById("enVsTkTulos").value,
    tkPaine:document.getElementById("enVsTkPaine").value,
    tkKesto:document.getElementById("enVsTkKesto").value,
    tkValine:document.getElementById("enVsTkValine").value,
    tkSeur:document.getElementById("enVsTkSeur").value,
    arvio:document.getElementById("enVsArvio").value,
    tyot:document.getElementById("enVsTyot").value,
    lisa:document.getElementById("enVsLisa").value,
    edustaja:document.getElementById("enVsEdustaja").value,
    check:chk,prod:prod,photo:_vsPhoto
  };
}
var VS_FIELDS=["enVsDate","enVsLaji","enVsNro","enVsPrev","enVsOmistaja","enVsIsannoitsija","enVsHuoltomies","enVsLohko","enVsYksikko","enVsLuokka","enVsHenkilot","enVsPinta","enVsTkTehty","enVsTkTulos","enVsTkPaine","enVsTkKesto","enVsTkValine","enVsTkSeur","enVsArvio","enVsTyot","enVsLisa","enVsEdustaja"];
var VS_MAP={date:"enVsDate",laji:"enVsLaji",nro:"enVsNro",prev:"enVsPrev",omistaja:"enVsOmistaja",isannoitsija:"enVsIsannoitsija",huoltomies:"enVsHuoltomies",lohko:"enVsLohko",yksikko:"enVsYksikko",luokka:"enVsLuokka",henkilot:"enVsHenkilot",pinta:"enVsPinta",tkTehty:"enVsTkTehty",tkTulos:"enVsTkTulos",tkPaine:"enVsTkPaine",tkKesto:"enVsTkKesto",tkValine:"enVsTkValine",tkSeur:"enVsTkSeur",arvio:"enVsArvio",tyot:"enVsTyot",lisa:"enVsLisa",edustaja:"enVsEdustaja"};
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
  VS_FIELDS.forEach(function(id){var el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("enVsDate").value=today();
  document.getElementById("enVsTkValine").value="U-putkimittari";
  var pf=document.getElementById("enVsPhoto"),pp=document.getElementById("enVsPhotoPrev"),ff=document.getElementById("enVsFile");
  if(pf)pf.value="";if(pp)pp.innerHTML="";if(ff)ff.value="";_vsPhoto=null;
  var dr=readVsDrafts()[devId];
  if(dr){
    Object.keys(VS_MAP).forEach(function(k){
      if(dr[k]!=null&&dr[k]!==""){var el=document.getElementById(VS_MAP[k]);if(el)el.value=dr[k];}
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
  var entry={date:ans.date,pohja:"Väestönsuojan tarkastus",comment:(ans.lisa||"").trim(),checklist:ans};
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
    r.onerror=function(){alert("Tiedoston luku epäonnistui.");};
    r.readAsDataURL(fl);
  } else finalize();
}
function vssPk(dev,ctx,ans){
  ctx=ctx||{name:"",address:""};ans=ans||{check:{},prod:{}};
  var w=window.open("","_blank");
  if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  var dash='<span style="color:#bbb">–</span>';
  var cstat=function(v){
    if(v==="OK")return '<span style="color:#1a7f37;font-weight:700">OK</span>';
    if(v==="HUOLTO")return '<span style="color:#b26a00;font-weight:700">HUOLTO</span>';
    if(v==="PUUTE")return '<span style="color:#c1121f;font-weight:700">PUUTE</span>';
    if(v==="VAARATILANNE")return '<span style="color:#a30000;font-weight:800">VAARATILANNE</span>';
    if(v==="Ei koske")return '<span style="color:#888">Ei koske</span>';
    if(v)return esc(v);
    return dash;
  };
  var pstat=function(v){
    if(v==="OK")return '<span style="color:#1a7f37;font-weight:700">OK</span>';
    if(v==="Uusittava")return '<span style="color:#b26a00;font-weight:700">Uusittava</span>';
    if(v==="Puuttuu")return '<span style="color:#c1121f;font-weight:700">Puuttuu</span>';
    if(v==="Ei koske")return '<span style="color:#888">Ei koske</span>';
    if(v)return esc(v);
    return dash;
  };
  var tkTulos=function(v){
    if(v==="Hyväksytty")return '<span style="color:#1a7f37;font-weight:700">Hyväksytty</span>';
    if(v==="Hylätty")return '<span style="color:#c1121f;font-weight:700">Hylätty</span>';
    if(v)return esc(v);
    return dash;
  };
  var arvioBadge=function(v){
    var c={"OK":"#1a7f37","HUOLTO":"#b26a00","PUUTE":"#c1121f","VAARATILANNE":"#a30000"}[v]||"#888";
    return v?('<span style="display:inline-block;padding:4px 14px;border-radius:6px;background:'+c+';color:#fff;font-weight:800;letter-spacing:1px">'+esc(v)+'</span>'):dash;
  };
  var crows=VSS_CHECK.map(function(it){
    var v=(ans.check&&ans.check[it.id])||{};
    return '<tr><td>'+esc(it.l)+'</td><td class="v">'+cstat(v.s||"")+'</td><td>'+(v.i?esc(v.i):"")+'</td></tr>';
  }).join("");
  var prows=VSS_PROD.map(function(it){
    var v=(ans.prod&&ans.prod[it.id])||{};
    var dd=v.d?fmt(v.d):dash;
    var lbl=esc(it.l)+(it.exp?' <span style="color:#b26a00" title="Seuraa päiväystä">⏱</span>':'');
    return '<tr><td>'+lbl+'</td><td class="v">'+pstat(v.s||"")+'</td><td class="d">'+dd+'</td><td>'+(v.i?esc(v.i):"")+'</td></tr>';
  }).join("");
  var ph=(dev.inspections&&dev.inspections[0]&&dev.inspections[0].photo&&dev.inspections[0].photo.data)||(ans.photo&&ans.photo.data)||"";
  var photoHtml=ph?('<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">Kuva</div><img src="'+ph+'" style="max-width:300px;max-height:300px;border:1px solid #ccc;border-radius:6px"></div>'):"";
  var worker=currentUser?currentUser.name:"";
  var site=esc(dev.locDetail||siteName(dev.locId)||"");
  var vastuu="Väestönsuojan kunnosta vastaa lopullisesti rakennuksen omistaja tai haltija. Suoja on pidettävä sellaisessa kunnossa, että se voidaan ottaa käyttöön 72 tunnin kuluessa viranomaisen määräyksestä. Palotarkastaja suorittaa viranomaisvalvonnan palotarkastuksen yhteydessä.";
  var luok="Luokitus: OK = kunnossa · HUOLTO = huoltotarve · PUUTE = korjattava puute · VAARATILANNE = välitön vaara / käyttökelvoton.";
  var laki="Tarkastus perustuu SPEK 2024 -ohjeeseen ja RT 92-11173-S1 -korttiin sekä pelastuslakiin (379/2011 §71–75) ja valtioneuvoston asetukseen väestönsuojista (409/2011). Annetut korjaussuositukset perustuvat mainittuun lainsäädäntöön ja asetuksiin.";
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Väestönsuojan tarkastuspöytäkirja</title>'
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
    +'table.chk td.v{width:120px}table.chk td.d{width:100px;white-space:nowrap}'
    +'.huom{margin-top:10px;border:1px solid #bbb;border-radius:6px;min-height:44px;padding:10px;font-size:12px}'
    +'.note{font-size:11px;color:#444;background:#faf5f5;border:1px solid #eddede;border-radius:6px;padding:8px 10px;margin:12px 0;line-height:1.5}'
    +'.foot{display:flex;justify-content:space-between;gap:24px;margin-top:22px}'
    +'.sign{min-width:230px;font-size:12px}.sign .line{border-bottom:1px solid #333;height:20px;margin-bottom:2px}'
    +'.company{margin-top:22px;border-top:2px solid #c1121f;padding-top:10px;font-size:11px;color:#333;line-height:1.55}'
    +'.company .n{font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:14px;letter-spacing:1px}'
    +'@media print{button{display:none}}'
    +'</style></head><body>'
    +'<div class="head"><div><div class="brand">SAVUKS</div><div style="font-size:11px;color:#666">Paloturvallisuuspalvelut</div></div>'
    +'<div style="text-align:right"><h1>Tarkastuspöytäkirja</h1><div style="font-size:12px;color:#666">Väestönsuoja</div></div></div>'
    +'<table class="meta">'
    +'<tr><td class="k">Kohde / asiakas</td><td>'+esc(ctx.name||"–")+'</td><td class="k">Päiväys</td><td>'+fmt(ans.date||today())+'</td></tr>'
    +'<tr><td class="k">Osoite</td><td>'+esc(ctx.address||"–")+'</td><td class="k">Tarkastuslaji</td><td>'+esc(ans.laji||"–")+'</td></tr>'
    +'<tr><td class="k">Laitetunnus</td><td>'+esc(dev.tag||"–")+'</td><td class="k">Sijainti</td><td>'+site+'</td></tr>'
    +'<tr><td class="k">Tarkastusnro</td><td>'+esc(ans.nro||"–")+'</td><td class="k">Edellinen pöytäkirja</td><td>'+esc(ans.prev||"–")+'</td></tr>'
    +'<tr><td class="k">Omistaja</td><td>'+esc(ans.omistaja||"–")+'</td><td class="k">Isännöitsijä</td><td>'+esc(ans.isannoitsija||"–")+'</td></tr>'
    +'<tr><td class="k">Huoltomies</td><td>'+esc(ans.huoltomies||"–")+'</td><td class="k">Suojaluokka</td><td>'+esc(ans.luokka||"–")+'</td></tr>'
    +'<tr><td class="k">Suojelulohko</td><td>'+esc(ans.lohko||"–")+'</td><td class="k">Suojeluyksikkö</td><td>'+esc(ans.yksikko||"–")+'</td></tr>'
    +'<tr><td class="k">Henkilömäärä</td><td>'+esc(ans.henkilot||"–")+'</td><td class="k">Pinta-ala</td><td>'+esc(ans.pinta||"–")+'</td></tr>'
    +'<tr><td class="k">Tarkastusväli</td><td>'+esc(dev.inspInterval||dev.interval||"–")+'</td><td class="k"></td><td></td></tr>'
    +'</table>'
    +'<div class="sub">Tarkastuskohteet</div>'
    +'<table class="chk"><thead><tr><th>Osa-alue</th><th>Luokitus</th><th>Havainnot / toimenpiteet</th></tr></thead><tbody>'+crows+'</tbody></table>'
    +'<div class="sub">Tiiveyskoe (painekoe)</div>'
    +'<table class="meta">'
    +'<tr><td class="k">Tila</td><td>'+esc(ans.tkTehty||"–")+'</td><td class="k">Tulos</td><td>'+tkTulos(ans.tkTulos||"")+'</td></tr>'
    +'<tr><td class="k">Ylipaine</td><td>'+(ans.tkPaine?esc(ans.tkPaine)+" Pa":"–")+'</td><td class="k">Kesto</td><td>'+(ans.tkKesto?esc(ans.tkKesto)+" min":"–")+'</td></tr>'
    +'<tr><td class="k">Mittausväline</td><td>'+esc(ans.tkValine||"–")+'</td><td class="k">Seuraava tiiveyskoe</td><td>'+(ans.tkSeur?fmt(ans.tkSeur):"–")+'</td></tr>'
    +'</table>'
    +'<div class="sub">Varusteluettelo</div>'
    +'<table class="chk"><thead><tr><th>Varuste / tarvikeryhmä</th><th>Tila</th><th>Päiväys / vanhenee</th><th>Havainnot</th></tr></thead><tbody>'+prows+'</tbody></table>'
    +'<div class="sub">Kokonaisarvio</div><div style="margin:6px 0 4px">'+arvioBadge(ans.arvio||"")+'</div>'
    +'<div style="margin-top:16px;font-size:12px;font-weight:700">Tehdyt työt</div><div class="huom">'+esc(ans.tyot||"")+'</div>'
    +'<div style="margin-top:12px;font-size:12px;font-weight:700">Lisätiedot / korjaussuositukset</div><div class="huom">'+esc(ans.lisa||"")+'</div>'
    +photoHtml
    +'<div class="note">'+esc(luok)+'</div>'
    +'<div class="note">'+esc(vastuu)+'<br>'+esc(laki)+'</div>'
    +'<div class="foot"><div class="sign"><div style="margin-bottom:14px"><div style="font-size:11px;color:#666">Kiinteistön edustaja tarkastuksessa</div><div class="line"></div>'+esc(ans.edustaja||"")+'</div>'
    +'<div><div style="font-size:11px;color:#666">Tarkastuksen laatija / tekijä</div><div class="line"></div>'+esc(worker)+'</div></div>'
    +'<div class="sign"><div><div style="font-size:11px;color:#666">Päivämäärä</div><div class="line"></div>'+fmt(ans.date||today())+'</div></div></div>'
    +'<div class="company"><span class="n">SAVUKS</span> &nbsp; puh. 044 3665638 &nbsp; info@savuks.com &nbsp; www.savuks.com<br>Santalankulmantie 8, 21290 Rusko &nbsp; Y-tunnus 3465682-5</div>'
    +'<p style="margin-top:20px"><button onclick="window.print()" style="background:#c1121f;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer">🖨 Tulosta / Tallenna PDF</button></p>'
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
for t in "function openVssPk" "function saveVssPk" "function vssPk" "function vsCheckHtml" "function vsProdHtml" "function collectVss" "id=\"vssOverlay\"" "servalo_vss_drafts" "VAARATILANNE" "enVsTkPaine" "{openVssPk(devId);return;}"; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Mallidokumentin tunnisteet EIVÄT ole vuotaneet ---"
if grep -niE "Innovestor|Isohaavisto|0504783408|Raeal Areena|Areenakatu|044 9858 923|0449858923|Lempäälä|Fidera Flow" servalo.html; then
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
git commit -m "Vaestonsuojan tarkastuspoytakirja: 10 osa-aluetta, 4-tason luokitus, tiiveyskoe, ohjeistus"
git push origin main
echo "VALMIS."
```

---

## Huom
- Nappi reitittää automaattisesti: **Väestönsuoja**-ryhmän laitteella `Luo pöytäkirja` avaa
  tämän tarkastuslomakkeen.
- **Luokitus:** OK = vihreä, HUOLTO = oranssi, PUUTE = punainen, VAARATILANNE = tumma punainen.
  Varusteet: OK = vihreä, Uusittava = oranssi, Puuttuu = punainen, Ei koske = harmaa.
- **Ohjeteksti** on sisäänrakennettu jokaiseen osa-alueeseen (`Ohje`-painike avaa ohjeen,
  perustuu VSS-tarkastusohjeen kohtiin 4.1–4.10).
- **Tiiveyskoe** ja **kokonaisarvio** ovat omina osioinaan; pöytäkirjassa myös luokitus-,
  vastuu- ja lakiviitteet (SPEK 2024, RT 92-11173-S1, pelastuslaki 379/2011, VnA 409/2011).
- Kohteet ovat `VSS_CHECK`- ja `VSS_PROD`-taulukoissa — kerro, jos haluat lisätä/muokata.
- Voit **liittää** valmiin raportin tai **luoda** pöytäkirjan kentistä.
- Puhelinnumero kirjoitetaan välilyönnillä (`044 3665638`).
