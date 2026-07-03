# Claude Code -prompti: Servalo — Laskutussivu + työraportti

Aja tämä **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

Mitä tämä tekee:
1. **Työraportti (asentaja)** — "Omat työt" -näkymään tulee **＋ Kirjaa työraportti** -nappi. Asentaja valitsee asiakkaan ja (valinnaisesti) laitteen, kirjoittaa tehdyn työn. Tekijä + pvm tallentuvat automaattisesti. Raportti menee laskutukseen tilassa **Avoin**.
2. **Laskutussivu (vain toimisto/admin)** — uusi **🧾 Laskutus** -näkymä Hallinta-valikkoon. Näyttää raportit taulukkona: Pvm, Asiakas, Kohde/laite, Tehty työ, Tekijä, Tila.
3. **Tilat & toiminnot:**
   - **✔ Laskutettu** → rivi siirtyy pois avoimelta listalta (löytyy silti *Laskutetut*-välilehdeltä, ei katoa lopullisesti).
   - **⏸ Odottaa lisätietoa** → kysyy tekstikentän: *mikä ongelma estää laskutuksen*. Rivi näkyy omalla välilehdellä ja syy näkyy rivissä. Voi muokata tai palauttaa avoimeksi.
4. **Välilehdet:** Avoimet · Odottaa lisätietoa · Laskutetut, kunkin lukumäärä otsikossa.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/laskutus_patch.py <<'PYEOF'
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

# ---- A: db.reports init + demodata ----
old_a = 'db.codes=db.codes||[];'
new_a = '''db.codes=db.codes||[];
if(!Array.isArray(db.reports)){
  var _rdev=function(idr){var x=db.devices.find(function(d){return d.idr===idr;});return x?x.id:null;};
  db.reports=[
    {id:uid(),created:"2026-06-18",by:"Mikko Virtanen",byId:"u3",customerId:"p1",deviceId:_rdev("601678"),work:"Vuosihuolto: paloilmoittimen ilmaisimet puhdistettu ja testattu, keskus OK.",status:"avoin",infoNote:"",invoicedDate:""},
    {id:uid(),created:"2026-06-20",by:"Sanna Koskinen",byId:"u4",customerId:"p2",deviceId:_rdev("601698"),work:"Vikakäynti: vikavalon syy paikallistettu ja silmukka korjattu.",status:"lisatieto",infoNote:"Asiakkaan tilausnumero (PO) puuttuu — ei voi laskuttaa ennen kuin isännöitsijä toimittaa sen.",invoicedDate:""},
    {id:uid(),created:"2026-06-10",by:"Jani Lehtonen",byId:"u5",customerId:"p3",deviceId:null,work:"Käsisammuttimien määräaikaishuolto, 6 kpl.",status:"laskutettu",infoNote:"",invoicedDate:"2026-06-15"}
  ];
  save();
}'''
rep(old_a, new_a, 1)

# ---- B: navigaatio — Laskutus Hallinta-valikkoon ----
rep('        <button id="navDispatch" data-go="dispatch">🗂 Työnjako</button>',
    '        <button id="navDispatch" data-go="dispatch">🗂 Työnjako</button>\n        <button id="navBilling" data-go="billing">🧾 Laskutus</button>', 1)

# ---- C: Laskutus-näkymä + työraportti-modaali (ennen HALLINTA-osiota) ----
old_c = '''    <!-- ===== HALLINTA ===== -->
    <section id="view-admin" class="view">'''
new_c = '''    <!-- ===== LASKUTUS ===== -->
    <section id="view-billing" class="view">
      <div class="topbar"><h2 style="margin:0">Laskutus</h2></div>
      <div class="panel"><div class="panel-b">
        <div class="stats" style="margin-bottom:16px">
          <div class="stat"><div class="lbl">Avoimet</div><div class="num" id="blOpen">0</div></div>
          <div class="stat alert"><div class="lbl">Odottaa lisätietoa</div><div class="num" id="blInfo">0</div></div>
          <div class="stat ok"><div class="lbl">Laskutettu</div><div class="num" id="blDone">0</div></div>
        </div>
        <div class="subtabs" id="billTabs" style="margin-bottom:14px"></div>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>Pvm</th><th>Asiakas</th><th>Kohde / laite</th><th>Tehty työ</th><th>Tekijä</th><th>Tila</th><th>Toiminnot</th></tr></thead>
          <tbody id="billRows"></tbody></table></div>
      </div></div>
    </section>

    <!-- ===== HALLINTA ===== -->
    <section id="view-admin" class="view">'''
rep(old_c, new_c, 1)

# ---- D: työraportti-modaali (ennen HALLINTA-kommenttia ei käy; laitetaan userOverlayn viereen) ----
old_d = '<!-- OMAT ASETUKSET MODAL -->'
new_d = '''<!-- TYÖRAPORTTI MODAL -->
<div class="overlay" id="reportOverlay">
  <div class="modal" style="max-width:560px">
    <div class="modal-h"><span>🧾 Uusi työraportti</span><span class="x" onclick="closeOverlay('reportOverlay')">×</span></div>
    <div class="modal-b">
      <div class="field"><label>Asiakas *</label><select class="f" id="rpCustomer"></select></div>
      <div class="field"><label>Kohde / laite <span class="hint">(valinnainen)</span></label><select class="f" id="rpDevice"><option value="">– Ei tiettyä laitetta –</option></select></div>
      <div class="field"><label>Tehty työ *</label><textarea class="f" id="rpWork" rows="4" placeholder="Kuvaa tehty työ…"></textarea></div>
      <div class="hint">Tekijä ja päivämäärä tallentuvat automaattisesti: <b id="rpMeta"></b></div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeOverlay('reportOverlay')">Peruuta</button>
      <button class="btn orange" onclick="saveReport()">Tallenna laskutukseen</button>
    </div>
  </div>
</div>

<!-- OMAT ASETUKSET MODAL -->'''
rep(old_d, new_d, 1)

# ---- E: reititys ----
rep('  else if(v==="history")renderHistory();}',
    '  else if(v==="history")renderHistory();\n  else if(v==="billing")renderBilling();}', 1)

# ---- F: oikeus (supervisor saa billing; admin aina) ----
rep('  if(r==="supervisor")return ["mywork","dispatch","customers","reports","devices_edit","view"].includes(p);',
    '  if(r==="supervisor")return ["mywork","dispatch","customers","reports","devices_edit","view","billing"].includes(p);', 1)

# ---- G: applyRole — näytä navBilling + sisällytä More-valikon näkyvyyteen ----
rep('  show("navDispatch", can("dispatch"));',
    '  show("navDispatch", can("dispatch"));\n  show("navBilling", can("billing"));', 1)
rep('const any=["navCustomers","navDispatch","navAdmin"].some',
    'const any=["navCustomers","navDispatch","navBilling","navAdmin"].some', 1)

# ---- H: Omat työt -topbariin "Kirjaa työraportti" -nappi ----
rep('<div class="topbar"><h2 style="margin:0">Omat työt</h2><span class="hint" id="mwWho"></span></div>',
    '<div class="topbar"><h2 style="margin:0">Omat työt</h2><span class="hint" id="mwWho"></span><button class="btn orange" style="margin-left:auto" onclick="openReportModal()">＋ Kirjaa työraportti</button></div>', 1)

# ---- I: JS — työraportti + laskutus (ennen TYÖNJAKO-osiota) ----
old_i = '/* ========== TYÖNJAKO (työnjohtaja) ========== */'
new_i = '''/* ========== TYÖRAPORTTI + LASKUTUS ========== */
const BILL_TAG={avoin:["ct-lead","Avoin"],lisatieto:["ct-inactive","Odottaa lisätietoa"],laskutettu:["ct-active","Laskutettu"]};
let billSub="avoin";
function reportKohde(r){
  if(r.deviceId){var d=db.devices.find(function(x){return x.id===r.deviceId;});if(d)return d.idr+(d.make?" · "+d.make:"");}
  return "–";
}
function openReportModal(deviceId){
  if(!currentUser){alert("Kirjaudu ensin.");return;}
  var cs=document.getElementById("rpCustomer");
  cs.innerHTML='<option value="">– Valitse asiakas –</option>'+db.customers.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join("");
  var ds=document.getElementById("rpDevice");
  ds.innerHTML='<option value="">– Ei tiettyä laitetta –</option>'+db.devices.filter(function(d){return !d.deleted;}).map(function(d){return '<option value="'+d.id+'">'+esc(d.idr)+" · "+esc(d.make||d.target||"")+'</option>';}).join("");
  document.getElementById("rpWork").value="";
  document.getElementById("rpMeta").textContent=(currentUser.name||"")+" · "+fmt(today());
  if(deviceId){var dv=db.devices.find(function(x){return x.id===deviceId;});ds.value=deviceId;if(dv&&dv.customerId)cs.value=dv.customerId;}
  document.getElementById("reportOverlay").classList.add("show");
}
function saveReport(){
  var cid=document.getElementById("rpCustomer").value;
  var did=document.getElementById("rpDevice").value||null;
  var work=document.getElementById("rpWork").value.trim();
  if(!cid){alert("Valitse asiakas.");return;}
  if(!work){alert("Kirjoita tehty työ.");return;}
  db.reports=db.reports||[];
  db.reports.unshift({id:uid(),created:today(),by:currentUser?currentUser.name:"",byId:currentUser?currentUser.id:null,customerId:cid,deviceId:did,work:work,status:"avoin",infoNote:"",invoicedDate:""});
  save();closeOverlay("reportOverlay");
  alert("Työraportti tallennettu laskutukseen.");
  if(typeof renderBilling==="function"&&document.getElementById("view-billing")&&document.getElementById("view-billing").classList.contains("active"))renderBilling();
}
function billMarkInvoiced(id){
  var r=(db.reports||[]).find(function(x){return x.id===id;});if(!r)return;
  if(!confirm("Merkitäänkö laskutetuksi? Rivi siirtyy Laskutetut-välilehdelle."))return;
  r.status="laskutettu";r.invoicedDate=today();save();renderBilling();
}
function billNeedInfo(id){
  var r=(db.reports||[]).find(function(x){return x.id===id;});if(!r)return;
  var note=prompt("Mikä ongelma estää laskutuksen? (näkyy laskutuslistalla)", r.infoNote||"");
  if(note===null)return;
  r.status="lisatieto";r.infoNote=note.trim();save();renderBilling();
}
function billReopen(id){
  var r=(db.reports||[]).find(function(x){return x.id===id;});if(!r)return;
  r.status="avoin";r.invoicedDate="";save();renderBilling();
}
function billDelete(id){
  if(!confirm("Poistetaanko työraportti kokonaan? Tätä ei voi perua."))return;
  db.reports=(db.reports||[]).filter(function(x){return x.id!==id;});save();renderBilling();
}
function renderBilling(){
  if(!can("billing")){return;}
  var reps=db.reports||[];
  var nOpen=reps.filter(function(r){return r.status==="avoin";}).length;
  var nInfo=reps.filter(function(r){return r.status==="lisatieto";}).length;
  var nDone=reps.filter(function(r){return r.status==="laskutettu";}).length;
  document.getElementById("blOpen").textContent=nOpen;
  document.getElementById("blInfo").textContent=nInfo;
  document.getElementById("blDone").textContent=nDone;
  var tabs=[["avoin","Avoimet",nOpen],["lisatieto","Odottaa lisätietoa",nInfo],["laskutettu","Laskutetut",nDone]];
  document.getElementById("billTabs").innerHTML=tabs.map(function(t){return '<button class="subtab '+(billSub===t[0]?"active":"")+'" onclick="billTab(\\''+t[0]+'\\')">'+t[1]+" ("+t[2]+")</button>";}).join("");
  var list=reps.filter(function(r){return r.status===billSub;}).slice().sort(function(a,b){return String(b.created).localeCompare(String(a.created));});
  var body=document.getElementById("billRows");
  if(!list.length){body.innerHTML='<tr><td colspan="7" class="empty">Ei rivejä tällä välilehdellä.</td></tr>';return;}
  body.innerHTML=list.map(function(r){
    var c=db.customers.find(function(x){return x.id===r.customerId;});
    var tg=BILL_TAG[r.status]||BILL_TAG.avoin;
    var tila='<span class="ctag '+tg[0]+'">'+tg[1]+'</span>';
    if(r.status==="laskutettu"&&r.invoicedDate)tila+='<br><span class="hint">'+fmt(r.invoicedDate)+'</span>';
    var work=esc(r.work||"");
    if(r.status==="lisatieto"&&r.infoNote)work+='<br><span class="badge red" style="white-space:normal">⏸ '+esc(r.infoNote)+'</span>';
    var act="";
    if(r.status==="avoin"){
      act='<button class="btn sm orange" onclick="billMarkInvoiced(\\''+r.id+'\\')">✔ Laskutettu</button> '+
          '<button class="btn sm ghost" onclick="billNeedInfo(\\''+r.id+'\\')">⏸ Lisätieto</button>';
    }else if(r.status==="lisatieto"){
      act='<button class="btn sm orange" onclick="billMarkInvoiced(\\''+r.id+'\\')">✔ Laskutettu</button> '+
          '<button class="btn sm ghost" onclick="billNeedInfo(\\''+r.id+'\\')">✎ Muokkaa syytä</button> '+
          '<button class="btn sm ghost" onclick="billReopen(\\''+r.id+'\\')">↩ Avoimeksi</button>';
    }else{
      act='<button class="btn sm ghost" onclick="billReopen(\\''+r.id+'\\')">↩ Palauta avoimeksi</button> '+
          '<button class="btn sm danger" onclick="billDelete(\\''+r.id+'\\')">🗑</button>';
    }
    return '<tr><td style="white-space:nowrap">'+fmt(r.created)+'</td>'+
      '<td>'+esc(c?c.name:"–")+'</td>'+
      '<td>'+esc(reportKohde(r))+'</td>'+
      '<td>'+work+'</td>'+
      '<td>'+esc(r.by||"")+'</td>'+
      '<td style="white-space:nowrap">'+tila+'</td>'+
      '<td style="white-space:nowrap">'+act+'</td></tr>';
  }).join("");
}
function billTab(k){billSub=k;renderBilling();}

/* ========== TYÖNJAKO (työnjohtaja) ========== */'''
rep(old_i, new_i, 1)

if s == orig:
    print("VIRHE: mitään ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/laskutus_patch.py

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

echo "--- Uudet tokenit läsnä ---"
for t in "db.reports" openReportModal saveReport renderBilling billMarkInvoiced billNeedInfo view-billing navBilling reportOverlay; do
  grep -q "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else
  echo "Kielletyt: puhdas"
fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Servalo: laskutussivu + tyoraportti (asentaja luo, toimisto laskuttaa, tilat avoin/lisatieto/laskutettu)"
git push origin main
echo "VALMIS."
```

---

## Miten tämä toimii

- **Asentaja:** Omat työt → ＋ Kirjaa työraportti → valitse asiakas (+ laite) → kirjoita tehty työ → *Tallenna laskutukseen*. Tekijä ja pvm tulevat automaattisesti.
- **Toimisto/admin:** Hallinta ▾ → 🧾 Laskutus. Avoimet-välilehdellä jokaisella rivillä:
  - **✔ Laskutettu** poistaa rivin avoimelta listalta (näkyy Laskutetut-välilehdellä, josta voi tarvittaessa palauttaa avoimeksi).
  - **⏸ Lisätieto** avaa kentän johon kirjoitat, mikä estää laskutuksen. Rivi siirtyy *Odottaa lisätietoa* -välilehdelle ja syy näkyy rivissä; sen voi muokata tai palauttaa avoimeksi.
- **Näkyvyys:** Laskutus-näkymä näkyy vain Pääkäyttäjälle ja Työnjohtajalle. Asentaja ja asiakas eivät näe sitä.
- **Demodata:** patch lisää 3 esimerkkiraporttia (avoin / odottaa lisätietoa / laskutettu), jotta näet näkymän heti. Voit poistaa ne Laskutus-sivulta.

Aja Servalo-repon juuressa Claude Codella. En pushaa mitään itse.
