# Vaihe 1 — kohdistus kentältä Postgresiin (aja tämä Claude Codella)

**Tavoite:** kun lisäät koodin asuntoon Servalossa (skannaa / näppäile / CSV), se tallentuu
Postgresiin ja avaa oikean asukassivun osoitteessa `/k/KOODI` millä tahansa laitteella.
Vaihe 0 (palovaroitin-kuittaus) on jo tuotannossa; tämä käyttää samaa API:a
(`POST /api/kohteet`, `POST /api/kohdista`, `GET /api/koodi/:koodi`), joka on jo koodattu `api.js`:ään.

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

Periaate kuten Vaihe 0: palvelin on lisä, ei pakko. Jos DB ei vastaa, paikallinen tallennus toimii kuten ennenkin.

---

## OSA A — `servalo.html`: koodit työntyvät palvelimelle

### MUUTOS 1 — apufunktiot (kohde-silta + kohdistus + massavienti)

**FIND:**
```
function codesOf(cid){return (db.codes||[]).filter(x=>x.customerId===cid);}
```

**REPLACE:**
```
function codesOf(cid){return (db.codes||[]).filter(x=>x.customerId===cid);}
/* --- palvelinsynkka: kohde-silta + kohdistus --- */
function apiHeaders(){return {"Content-Type":"application/json","X-User-Id":(currentUser&&currentUser.id)||"kentta"};}
async function ensureKohde(c){
  if(c.kohdeId) return c.kohdeId;
  const r=await fetch("/api/kohteet",{method:"POST",headers:apiHeaders(),
    body:JSON.stringify({nimi:c.name,osoite:c.address||""})});
  if(!r.ok) throw new Error("kohde "+r.status);
  const j=await r.json(); c.kohdeId=j.id; save(); return j.id;
}
async function pushCode(c,x){
  const kid=await ensureKohde(c);
  const r=await fetch("/api/kohdista",{method:"POST",headers:apiHeaders(),
    body:JSON.stringify({koodi:x.code,kohde_id:kid,nakymatyyppi:"asukas",data:{apt:x.apt||"",note:x.note||""}})});
  if(!r.ok) throw new Error("kohdista "+r.status);
  x.synced=true; save(); return true;
}
function syncAllCodes(cid){
  const c=custById(cid); if(!c){return;}
  const list=codesOf(cid); if(!list.length){alert("Ei koodeja vietäväksi.");return;}
  (async function(){
    let ok=0,fail=0;
    for(const x of list){ try{ await pushCode(c,x); ok++; }catch(e){ fail++; } }
    refreshCodes();
    alert("Palvelimelle viety: "+ok+(fail?(" · epäonnistui: "+fail):"")+".\nJokainen viety koodi toimii nyt osoitteessa /k/KOODI.");
  })();
}
```

### MUUTOS 2 — `addCode`: uusi koodi työntyy heti palvelimelle (taustalla)

**FIND:**
```
  db.codes.push({id:uid(),customerId:cid,code,apt,note,images:[],created:today()});
  save();
  refreshCodes();
  const el=document.getElementById("ncCode");if(el)el.focus();
```

**REPLACE:**
```
  const nc={id:uid(),customerId:cid,code,apt,note,images:[],created:today()};
  db.codes.push(nc);
  save();
  refreshCodes();
  const cust=custById(cid); if(cust){ pushCode(cust,nc).then(function(){refreshCodes();}).catch(function(){}); }
  const el=document.getElementById("ncCode");if(el)el.focus();
```

### MUUTOS 3 — CSV-tuonti: tarjoa massavienti heti tuonnin jälkeen

**FIND:**
```
      save();refreshCodes();
      alert(added+" riviä tuotu.");
```

**REPLACE:**
```
      save();refreshCodes();
      if(added && confirm(added+" riviä tuotu. Viedäänkö ne heti palvelimelle (näkyvät /k/KOODI-sivuilla)?")){ syncAllCodes(cid); }
      else alert(added+" riviä tuotu.");
```

### MUUTOS 4 — koodilistaan ☁-merkki kun koodi on palvelimella

**FIND:**
```
      '<td><b>'+esc(x.code)+'</b></td>'+
```

**REPLACE:**
```
      '<td><b>'+esc(x.code)+'</b>'+(x.synced?' <span title="Tallennettu palvelimelle" style="color:#16a34a">☁</span>':'')+'</td>'+
```

### MUUTOS 5 — työkalupalkkiin "Vie palvelimelle" -nappi

**FIND:**
```
        <button class="btn ghost" type="button" onclick="importCodesCSV('${c.id}')">⬆ Tuo CSV</button>
      </div>
```

**REPLACE:**
```
        <button class="btn ghost" type="button" onclick="importCodesCSV('${c.id}')">⬆ Tuo CSV</button>
        <button class="btn ghost" type="button" onclick="syncAllCodes('${c.id}')">☁ Vie palvelimelle</button>
      </div>
```

---

## OSA B — `ohje24.html`: `/k/KOODI` hakee kohdistetun koodin palvelimelta

### MUUTOS 6 — render hakee tuntemattoman koodin palvelimelta (demokoodit toimivat yhä)

**FIND:**
```
function render(code){
  currentCode=code;
  el("topCode").textContent=code||"";
  var c=CODES[code];
  var html;
  if(!c || !c.type) html = c===undefined ? viewUnknown(code) : viewUnknown(code);
  else if(c.type==="aula")   html=viewAula(code,c);
  else if(c.type==="asukas") html=viewAsukas(code,c);
  else if(c.type==="laite")  html=viewLaite(code,c);
  else if(c.type==="huolto") html=viewHuolto(code,c);
  else html=viewUnknown(code);
  el("app").innerHTML=html;
  if(c && c.type==="asukas"){ try{ loadSmokeStatus(code); }catch(e){} }
  document.querySelectorAll(".chip").forEach(function(ch){
    ch.classList.toggle("active", ch.getAttribute("data-code")===code);
  });
  window.scrollTo(0,0);
}
```

**REPLACE:**
```
function mapServerCode(res){
  var d=res.data||{}, t=res.nakymatyyppi;
  if(t==="asukas") return {type:"asukas", apt:d.apt||res.koodi, floor:d.floor||""};
  if(t==="aula")   return {type:"aula"};
  if(t==="laite")  return {type:"laite", device:d.device||"Laite", loc:d.loc||"", kind:d.kind||"", last:d.last||"", next:d.next||"", state:d.state||"ok"};
  if(t==="huolto") return {type:"huolto", room:d.room||"Tekninen tila", loc:d.loc||"", pin:d.pin||""};
  return {type:null};
}
function renderView(code,c){
  var html;
  if(!c || !c.type) html = viewUnknown(code);
  else if(c.type==="aula")   html=viewAula(code,c);
  else if(c.type==="asukas") html=viewAsukas(code,c);
  else if(c.type==="laite")  html=viewLaite(code,c);
  else if(c.type==="huolto") html=viewHuolto(code,c);
  else html=viewUnknown(code);
  el("app").innerHTML=html;
  if(c && c.type==="asukas"){ try{ loadSmokeStatus(code); }catch(e){} }
  document.querySelectorAll(".chip").forEach(function(ch){
    ch.classList.toggle("active", ch.getAttribute("data-code")===code);
  });
  window.scrollTo(0,0);
}
function render(code){
  currentCode=code;
  el("topCode").textContent=code||"";
  var c=CODES[code];
  if(c){ renderView(code,c); return; }
  el("app").innerHTML='<div class="empty"><div class="big">⏳</div><h1>Haetaan…</h1></div>';
  fetch("/api/koodi/"+encodeURIComponent(code))
    .then(function(r){return r.ok?r.json():null;})
    .then(function(res){
      if(res && res.nakymatyyppi){
        if(res.kohde){ if(res.kohde.nimi)COMPANY.name=res.kohde.nimi; if(res.kohde.osoite)COMPANY.address=res.kohde.osoite; }
        renderView(code, mapServerCode(res));
      } else { renderView(code, {type:null}); }
    })
    .catch(function(){ renderView(code, {type:null}); });
}
```

---

## VALIDOINTI (aja ennen committia)

```bash
cd ~/Desktop/Servalo

# 1) palvelinkoodin syntaksi (ei muuttunut, mutta varmistetaan)
node --check server.js && node --check api.js && node --check db.js && echo "NODE OK"

# 2) servalo.html JS-syntaksi
node -e '
const fs=require("fs");
const h=fs.readFileSync("servalo.html","utf8");
const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
new Function(s);
console.log("SERVALO JS OK");
'

# 3) ohje24.html JS-syntaksi
node -e '
const fs=require("fs");
const h=fs.readFileSync("ohje24.html","utf8");
const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
new Function(s);
console.log("OHJE24 JS OK");
'

# 4) uudet palaset löytyvät
for s in "function ensureKohde" "function pushCode" "function syncAllCodes" "Vie palvelimelle" "function mapServerCode" "function renderView"; do
  grep -rq "$s" servalo.html ohje24.html && echo "OK: $s" || { echo "PUUTTUU: $s"; exit 1; }
done

# 5) kielletyt merkkijonot
if grep -rnE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html ohje24.html api.js db.js server.js; then
  echo "VAROITUS: tarkista osumat"; else echo "Ei kiellettyjä merkkijonoja"; fi
```

Kaikki `OK:` ja molemmat `... JS OK` → jatka. Muuten pysähdy.

---

## COMMIT & PUSH

```bash
cd ~/Desktop/Servalo
rm -f .git/index.lock
git add -A
git commit -m "Vaihe 1: kohdistus kentältä tallentuu Postgresiin + asukassivu toimii /k/KOODI"
git push origin main
```

Railway deployaa automaattisesti. Odota että logeissa lukee `[db] initSchema: ok`.

---

## TESTAUS (näin todistat että toimii)

1. Avaa Servalo (`servalo-production-8fdd.up.railway.app`), kirjaudu, avaa jokin asiakas → **Koodit & kohteet** -välilehti.
2. Lisää uusi koodi, esim. koodi `TESTI01`, asunto `B7`, ja paina **＋ Lisää**.
3. Rivin viereen ilmestyy hetken päästä **☁** — koodi on tallennettu palvelimelle.
   (Jos ☁ ei tule, paina **☁ Vie palvelimelle** -nappia ja katso ilmoitus.)
4. Avaa **puhelimella** `https://servalo-production-8fdd.up.railway.app/k/TESTI01`.
   → Näet asukasnäkymän "Asunto B7". Tämä todistaa: Servalossa tehty kohdistus → Postgres → julkinen sivu.
5. Avaa sama osoite toisella laitteella / incognitossa → sama näkymä. Data tulee palvelimelta.
6. Palovaroitin-kuittaus toimii tälläkin koodilla (Vaihe 0), eli koko ketju on ehjä.

Demokoodit (82FA66, 10AULA, 7HK220, 90ZZ00) toimivat yhä ilman palvelinhakua.

## Mitä tämä todistaa
Kohdistus kentältä → API → Postgres → julkinen asukassivu, yli laitteiden. Sama kaava toistuu
myöhemmissä vaiheissa (aula/laite/huolto-näkymät, kattavuusraportti, piirustukset liitteinä).

## Tiedossa olevat rajaukset (seuraaviin vaiheisiin)
- Kohdistus tehdään aina tyyppinä **asukas** (asuntopainotteinen kenttätyö). Aula/laite/huolto-tyypin
  valitsin tulee myöhemmin.
- Servalon koodilista pysyy toistaiseksi paikallisena (localStorage) käyttöliittymässä; palvelin on
  vielä yksisuuntainen varmuuskopio + julkisten sivujen lähde. Kaksisuuntainen synkka (toinen laite
  näkee listan Servalossa) on oma pieni lisävaihe.
