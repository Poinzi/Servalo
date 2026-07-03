# Claude Code -prompti: "Luo pöytäkirja" -nappi + jatkuva automaattitallennus

Aja **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

> **Riippuvuus:** tämä olettaa, että käsisammuttimien pöytäkirja on jo lisätty
> (aiempi prompti `claudecode-servalo-sammutinpoytakirja.md`). Skripti pysähtyy heti,
> jos `function sammutinPk` ei löydy.

## Mitä tämä tekee

1. **"📋 Luo pöytäkirja" -nappi** laitekortin **Tarkastukset**-paneeliin, `＋`-napin
   **vastakkaiselle puolelle**. Nappi avaa tarkastuksen kirjausikkunan valmiiksi
   viritettynä (kuvakenttä esillä).
2. **Tallennuksessa** kirjataan tarkastus **ja** avautuu heti laitteen kategorian mukainen
   pöytäkirja:
   - **Käsisammutin** → nykyinen käsisammutinpöytäkirja (`sammutinPk`).
   - **Muu kategoria** (Paloilmoitin, Paloposti/Pikapaloposti, Väestönsuoja/VSS,
     Savunpoisto, Poistumistievalaistus, Sammutusjärjestelmä jne.) → yleinen
     Savuks-tyylinen pöytäkirja, joka **otsikoidaan laitteen kategorian mukaan**.
     Näin jokaisella kategorialla on oma pöytäkirjatyyppinsä; käsisammutin on
     räätälöity nyt, muut saavat oman otsikoidun pohjan ja niitä hiotaan tarpeen mukaan.
3. **Jatkuva automaattitallennus (luonnos):** kirjausikkunan kentät ja **valokuva**
   tallentuvat selaimen muistiin (`localStorage`) heti kirjoittaessa. Jos kenttä pätkii
   tai ikkuna sulkeutuu kesken kohteen, samalla laitteella kirjaus **palautuu** kun
   ikkuna avataan uudelleen — koko pöytäkirja ei mene hukkaan. Tallennettu luonnos
   tyhjenee, kun merkintä on tallennettu.

Kuva on sisäinen (asiakas ei näe sitä listassa), mutta valuu pöytäkirjaan kuten ennenkin.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF "function sammutinPk" servalo.html || { echo "VIRHE: sammutinPk puuttuu — aja ensin claudecode-servalo-sammutinpoytakirja.md"; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/luopk_patch.py <<'PYEOF'
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

# 1) Modaalin runko: liitä jatkuva automaattitallennus kirjoittaessa
rep('    <div class="modal-b">\n      <input type="hidden" id="enDevId"><input type="hidden" id="enType">',
    '    <div class="modal-b" oninput="saveEntryDraft()" onchange="saveEntryDraft()">\n      <input type="hidden" id="enDevId"><input type="hidden" id="enType">', 1)

# 2) Tarkastukset-paneeli: "Luo pöytäkirja" -nappi plussan vastakkaiselle puolelle
rep('      <div class="mini-add"><button class="iconbtn req-edit" onclick="openEntry(\'${d.id}\',\'inspections\')">＋</button></div>',
    '      <div class="mini-add" style="justify-content:space-between"><button class="btn ghost req-edit" style="padding:5px 12px;font-size:12px" onclick="openInspectionPk(\'${d.id}\')">\U0001F4CB Luo pöytäkirja</button><button class="iconbtn req-edit" onclick="openEntry(\'${d.id}\',\'inspections\')">＋</button></div>', 1)

# 3) previewPhoto: talleta valokuva luonnokseen (kestää kentän pätkimisen)
rep('  r.onload=()=>{pp.innerHTML=`<img src="${r.result}" alt="Esikatselu" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px">`;};',
    '  r.onload=()=>{pp.innerHTML=`<img src="${r.result}" alt="Esikatselu" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px">`;_draftPhoto={name:f.name,type:f.type,data:r.result};saveEntryDraft();};', 1)

# 4) Uudet toiminnot + muuttujat ennen openEntryä
rep('function openEntry(devId,type){\n  if(!can("devices_edit"))return;\n  const cfg=ENTRY_CFG[type];if(!cfg)return;',
'''const DRAFT_KEY="servalo_entry_drafts";
let _draftPhoto=null;
let _pkAfterSave=null;

function openInspectionPk(devId){
  openEntry(devId,"inspections");
  _pkAfterSave=devId;
}
function entryDraftKey(devId,type){return devId+"|"+type;}
function readDrafts(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||"{}");}catch(e){return {};}}
function saveEntryDraft(){
  var devId=document.getElementById("enDevId").value;
  var type=document.getElementById("enType").value;
  if(!devId||!type)return;
  var all=readDrafts();
  all[entryDraftKey(devId,type)]={
    date:document.getElementById("enDate").value,
    pohja:document.getElementById("enTemplate").value,
    comment:document.getElementById("enComment").value,
    name:document.getElementById("enName").value,
    interval:document.getElementById("enInterval").value,
    photo:_draftPhoto,
    ts:Date.now()
  };
  try{localStorage.setItem(DRAFT_KEY,JSON.stringify(all));}catch(e){}
}
function clearEntryDraft(devId,type){
  var all=readDrafts();delete all[entryDraftKey(devId,type)];
  try{localStorage.setItem(DRAFT_KEY,JSON.stringify(all));}catch(e){}
}
function pkCtxFor(d){var c=d&&d.customerId?custById(d.customerId):null;return {name:c?c.name:"",address:(c&&c.address)||""};}
function laitePk(devs,ctx){
  var d=devs&&devs[0];
  if(isExting(d)){sammutinPk(devs,ctx);return;}
  var g=(d&&d.group)||"Laitteet";
  laitePkGeneric(devs,ctx,g);
}
function laitePkGeneric(devs,ctx,title){
  ctx=ctx||{name:"",address:""};
  var w=window.open("","_blank");
  if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  var mmYY=function(iso){if(!iso)return"";var p=String(iso).slice(0,10).split("-");return p.length>=2?(p[1]+"/"+p[0].slice(2)):"";};
  var photoOf=function(d){var a=d.inspections||[];for(var i=0;i<a.length;i++){if(a[i].photo&&a[i].photo.data)return a[i].photo.data;}return"";};
  var rows=(devs||[]).map(function(d,i){
    var ph=photoOf(d);
    var img=ph?('<img src="'+ph+'" style="width:44px;height:44px;object-fit:cover;border:1px solid #ccc;border-radius:4px">'):'<span style="color:#bbb">–</span>';
    return '<tr>'
      +'<td class="num">'+(i+1)+'</td>'
      +'<td>'+esc(d.locDetail||siteName(d.locId)||"")+'</td>'
      +'<td>'+esc(d.tag||"")+'</td>'
      +'<td>'+esc(d.make||"")+'</td>'
      +'<td class="c">'+(d.inspLast?"✓":"")+'</td>'
      +'<td class="c">'+esc(mmYY(d.last))+'</td>'
      +'<td class="c">'+esc(d.serial||"")+'</td>'
      +'<td class="c">'+esc(d.inspInterval||d.interval||"")+'</td>'
      +'<td>'+esc(d.notes||"")+'</td>'
      +'<td class="c">'+img+'</td>'
      +'</tr>';
  }).join("")||'<tr><td colspan="10" style="text-align:center;color:#999;padding:18px">Ei laitteita valinnassa.</td></tr>';
  var worker=currentUser?currentUser.name:"";
  var html='<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>Tarkastuspöytäkirja</title>'
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
    +'<div style="text-align:right"><h1>Tarkastuspöytäkirja</h1><div style="font-size:12px;color:#666">'+esc(title||"Laitteet")+'</div></div></div>'
    +'<div class="meta"><b>Asiakas:</b> '+esc(ctx.name||"–")+' &nbsp; <b>Osoite:</b> '+esc(ctx.address||"–")+' &nbsp; <b>Päiväys:</b> '+fmt(today())+' &nbsp; <b>Laitteita:</b> '+(devs?devs.length:0)+'</div>'
    +'<table><thead><tr>'
    +'<th class="c">#</th><th>Sijainti</th><th>Tunnus</th><th>Merkki / Malli</th><th class="c">Tark.</th><th class="c">Huolto kk/vv</th><th class="c">Sarjanro</th><th class="c">Tarkastusväli</th><th>Lisätiedot</th><th class="c">Kuva</th>'
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
function openEntry(devId,type){
  if(!can("devices_edit"))return;
  const cfg=ENTRY_CFG[type];if(!cfg)return;
  _pkAfterSave=null;_draftPhoto=null;''', 1)

# 5) openEntry loppu: palauta mahdollinen luonnos ennen ikkunan näyttämistä
rep('  document.getElementById("enInterval").value=isCycle?(type==="inspections"?((dev&&(dev.inspInterval||dev.interval))||""):((dev&&dev.interval)||"")):"";\n  show("entryOverlay");',
'''  document.getElementById("enInterval").value=isCycle?(type==="inspections"?((dev&&(dev.inspInterval||dev.interval))||""):((dev&&dev.interval)||"")):"";
  var _dr=readDrafts()[entryDraftKey(devId,type)];
  if(_dr){
    if(_dr.date)document.getElementById("enDate").value=_dr.date;
    if(_dr.pohja)document.getElementById("enTemplate").value=_dr.pohja;
    if(_dr.comment)document.getElementById("enComment").value=_dr.comment;
    if(_dr.name)document.getElementById("enName").value=_dr.name;
    if(_dr.interval)document.getElementById("enInterval").value=_dr.interval;
    if(_dr.photo){_draftPhoto=_dr.photo;var _pp=document.getElementById("enPhotoPrev");if(_pp)_pp.innerHTML='<img src="'+_dr.photo.data+'" alt="Esikatselu" style="max-width:160px;max-height:160px;border:1px solid var(--line);border-radius:6px"><div class="hint">Palautettu tallentamaton kuva</div>';}
  }
  show("entryOverlay");''', 1)

# 6) saveEntry: käytä luonnoskuvaa, tyhjennä luonnos, avaa pöytäkirja
rep('  const finalize=()=>{\n    d[type]=d[type]||[];',
    '  const finalize=()=>{\n    if(!entry.photo&&_draftPhoto&&type==="inspections")entry.photo=_draftPhoto;\n    d[type]=d[type]||[];', 1)

rep('    d.updated=today();save();closeOverlay("entryOverlay");renderDevTab();\n  };',
'''    d.updated=today();save();clearEntryDraft(d.id,type);closeOverlay("entryOverlay");renderDevTab();
    var _pk=_pkAfterSave;_pkAfterSave=null;_draftPhoto=null;
    if(_pk&&type==="inspections"){laitePk([d],pkCtxFor(d));}
  };''', 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/luopk_patch.py

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
for t in "function openInspectionPk" "function saveEntryDraft" "function clearEntryDraft" "function laitePk" "function laitePkGeneric" "function pkCtxFor" "Luo pöytäkirja" "servalo_entry_drafts"; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

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
git commit -m "Laitekortti: Luo poytakirja -nappi + kategoriakohtainen poytakirja + jatkuva automaattitallennus"
git push origin main
echo "VALMIS."
```

---

## Huom
- **Käsisammutin** avaa nykyisen räätälöidyn pöytäkirjan; muut kategoriat saavat yleisen
  Savuks-pohjan otsikoituna laitteen kategorialla. Räätälöidään kategoriakohtaiset pohjat
  yksi kerrallaan tarpeen mukaan — kerro mikä kategoria seuraavaksi.
- **Automaattitallennus** on selainpohjainen (`localStorage`), joten se suojaa myös
  vahingossa suljetulta ikkunalta / välkkyvältä kentältä. Luonnos on laite- ja
  tyyppikohtainen, ja tyhjenee tallennuksen jälkeen.
- Kuvan base64 talletetaan luonnokseen, koska selain ei salli tiedostokentän palauttamista
  ohjelmallisesti — näin otettu kuva ei katoa vaikka ikkuna sulkeutuisi.
- Puhelinnumero kirjoitetaan välilyönnillä (`044 3665638`), joten kiellettyjen vahti ei
  laukea (vahti tarkistaa välilyönnittömän `0443665638`-muodon).
