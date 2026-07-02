# Vaihe 2 — tyyppivalitsin (asukas/aula/laite/huolto) + huolto/piirustukset palvelimelta

**Edellytys:** Vaihe 1 on jo ajettu (servalo.html sisältää `apiHeaders`, `pushCode`, `syncAllCodes`; ohje24.html sisältää `mapServerCode`, `render` palvelinhaulla). Tämä patch olettaa ne olemassa oleviksi.

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

---

### V2-1 — `servalo.html`: lisää `ncTypeChange()` (piilottaa/näyttää PIN-kentän)

**FIND:**
```
function apiHeaders(){return {"Content-Type":"application/json","X-User-Id":(currentUser&&currentUser.id)||"kentta"};}
```

**REPLACE:**
```
function apiHeaders(){return {"Content-Type":"application/json","X-User-Id":(currentUser&&currentUser.id)||"kentta"};}
function ncTypeChange(){
  var t=(document.getElementById("ncType")||{}).value||"asukas";
  var apt=document.getElementById("ncApt"), pin=document.getElementById("ncPin");
  if(pin) pin.style.display=(t==="huolto")?"":"none";
  if(apt){
    apt.placeholder = t==="asukas"?"Asunto / tila (A12)"
      : t==="laite"?"Laite (Käsisammutin)"
      : t==="huolto"?"Tila (Lämmönjakohuone)"
      : "Nimi / sijainti (valinnainen)";
  }
}
```

---

### V2-2 — `servalo.html`: `pushCode` rakentaa datan tyypin mukaan

**FIND:**
```
async function pushCode(c,x){
  const kid=await ensureKohde(c);
  const r=await fetch("/api/kohdista",{method:"POST",headers:apiHeaders(),
    body:JSON.stringify({koodi:x.code,kohde_id:kid,nakymatyyppi:"asukas",data:{apt:x.apt||"",note:x.note||""}})});
  if(!r.ok) throw new Error("kohdista "+r.status);
  x.synced=true; save(); return true;
}
```

**REPLACE:**
```
async function pushCode(c,x){
  const kid=await ensureKohde(c);
  const t=x.type||"asukas";
  let data;
  if(t==="laite") data={device:x.apt||"",loc:x.note||"",note:x.note||""};
  else if(t==="huolto") data={room:x.apt||"",loc:x.note||"",pin:x.pin||"",note:x.note||""};
  else if(t==="aula") data={};
  else data={apt:x.apt||"",note:x.note||""};
  const r=await fetch("/api/kohdista",{method:"POST",headers:apiHeaders(),
    body:JSON.stringify({koodi:x.code,kohde_id:kid,nakymatyyppi:t,data:data})});
  if(!r.ok) throw new Error("kohdista "+r.status);
  x.synced=true; save(); return true;
}
```

---

### V2-3 — `servalo.html`: lisää tyyppivalitsin + PIN-kenttä työkaluriviin

**FIND:**
```
        <button class="btn ghost" type="button" onclick="scanCode()">📷 Skannaa</button>
        <input id="ncApt" placeholder="Asunto / tila (A12)" style="flex:1;min-width:110px;padding:9px;border:1px solid var(--line);border-radius:8px">
        <input id="ncNote" placeholder="Huomio (valinnainen)" style="flex:2;min-width:140px;padding:9px;border:1px solid var(--line);border-radius:8px">
```

**REPLACE:**
```
        <button class="btn ghost" type="button" onclick="scanCode()">📷 Skannaa</button>
        <select id="ncType" onchange="ncTypeChange()" style="min-width:120px;padding:9px;border:1px solid var(--line);border-radius:8px">
          <option value="asukas">Asukas</option>
          <option value="aula">Aula</option>
          <option value="laite">Laite</option>
          <option value="huolto">Huolto</option>
        </select>
        <input id="ncApt" placeholder="Asunto / tila (A12)" style="flex:1;min-width:110px;padding:9px;border:1px solid var(--line);border-radius:8px">
        <input id="ncNote" placeholder="Huomio (valinnainen)" style="flex:2;min-width:140px;padding:9px;border:1px solid var(--line);border-radius:8px">
        <input id="ncPin" placeholder="PIN (huolto)" inputmode="numeric" maxlength="4" style="display:none;min-width:90px;padding:9px;border:1px solid var(--line);border-radius:8px">
```

---

### V2-4 — `servalo.html`: `addCode` lukee tyypin ja PINin

**FIND:**
```
function addCode(cid){
  const code=(document.getElementById("ncCode").value||"").trim();
  const apt=(document.getElementById("ncApt").value||"").trim();
  const note=(document.getElementById("ncNote").value||"").trim();
  if(!code){alert("Anna koodi (skannaa tai näppäile).");return;}
  const ex=codesOf(cid);
  if(ex.some(x=>(x.code||"").toLowerCase()===code.toLowerCase())){if(!confirm("Koodi on jo listalla. Lisätäänkö silti?"))return;}
  if(apt&&ex.some(x=>(x.apt||"").toLowerCase()===apt.toLowerCase())){if(!confirm("Tälle asunnolle on jo koodi. Lisätäänkö silti?"))return;}
  const nc={id:uid(),customerId:cid,code,apt,note,images:[],created:today()};
  db.codes.push(nc);
  save();
  refreshCodes();
  const cust=custById(cid); if(cust){ pushCode(cust,nc).then(function(){refreshCodes();}).catch(function(){}); }
  const el=document.getElementById("ncCode");if(el)el.focus();
}
```

**REPLACE:**
```
function addCode(cid){
  const code=(document.getElementById("ncCode").value||"").trim();
  const apt=(document.getElementById("ncApt").value||"").trim();
  const note=(document.getElementById("ncNote").value||"").trim();
  const tEl=document.getElementById("ncType"); const type=tEl?tEl.value:"asukas";
  const pinEl=document.getElementById("ncPin"); const pin=(type==="huolto"&&pinEl)?(pinEl.value||"").trim():"";
  if(!code){alert("Anna koodi (skannaa tai näppäile).");return;}
  const ex=codesOf(cid);
  if(ex.some(x=>(x.code||"").toLowerCase()===code.toLowerCase())){if(!confirm("Koodi on jo listalla. Lisätäänkö silti?"))return;}
  if(apt&&ex.some(x=>(x.apt||"").toLowerCase()===apt.toLowerCase())){if(!confirm("Tälle asunnolle on jo koodi. Lisätäänkö silti?"))return;}
  const nc={id:uid(),customerId:cid,code,apt,note,type,pin,images:[],created:today()};
  db.codes.push(nc);
  save();
  refreshCodes();
  const cust=custById(cid); if(cust){ pushCode(cust,nc).then(function(){refreshCodes();}).catch(function(){}); }
  if(pinEl)pinEl.value="";
  const el=document.getElementById("ncCode");if(el)el.focus();
}
```

---

### V2-5 — `servalo.html`: `codeRowsHtml` näyttää tyyppimerkinnän (ei asukas)

**FIND:**
```
      '<td><b>'+esc(x.code)+'</b>'+(x.synced?' <span title="Tallennettu palvelimelle" style="color:#16a34a">☁</span>':'')+'</td>'+
      '<td>'+esc(x.apt||"")+'</td>'+
```

**REPLACE:**
```
      '<td><b>'+esc(x.code)+'</b>'+(x.synced?' <span title="Tallennettu palvelimelle" style="color:#16a34a">☁</span>':'')+'</td>'+
      '<td>'+esc(x.apt||"")+((x.type&&x.type!=="asukas")?' <span style="font-size:11px;color:#64748b;border:1px solid var(--line);border-radius:6px;padding:1px 5px">'+esc(x.type)+'</span>':"")+'</td>'+
```

---

### V2-6 — `servalo.html`: `editCode` kysyy tyypin + PINin ja päivittää palvelimelle

**FIND:**
```
function editCode(id){
  const x=(db.codes||[]).find(c=>c.id===id);if(!x)return;
  const code=prompt("Koodi:",x.code);if(code===null)return;
  const apt=prompt("Asunto / tila:",x.apt||"");if(apt===null)return;
  const note=prompt("Huomio:",x.note||"");if(note===null)return;
  x.code=code.trim();x.apt=apt.trim();x.note=note.trim();
  save();refreshCodes();
}
```

**REPLACE:**
```
function editCode(id){
  const x=(db.codes||[]).find(c=>c.id===id);if(!x)return;
  const code=prompt("Koodi:",x.code);if(code===null)return;
  const type=prompt("Tyyppi (asukas/aula/laite/huolto):",x.type||"asukas");if(type===null)return;
  const apt=prompt("Asunto / tila:",x.apt||"");if(apt===null)return;
  const note=prompt("Huomio:",x.note||"");if(note===null)return;
  const t=(type.trim()||"asukas").toLowerCase();
  let pin=x.pin||"";
  if(t==="huolto"){ const p=prompt("Huolto-PIN (4 numeroa):",pin); if(p!==null)pin=p.trim(); }
  x.code=code.trim();x.type=t;x.apt=apt.trim();x.note=note.trim();x.pin=pin;x.synced=false;
  save();refreshCodes();
  const cust=custById(x.customerId); if(cust){ pushCode(cust,x).then(function(){refreshCodes();}).catch(function(){}); }
}
```

---

### V2-7 — `servalo.html`: CSV-tuonti tukee `tyyppi`- ja `pin`-sarakkeita

**FIND:**
```
      const ci=head.indexOf("koodi"),ni=head.indexOf("nimi"),si=head.indexOf("sijainti");
      let added=0;
      for(let i=1;i<rows.length;i++){
        const row=rows[i];if(!row.length)continue;
        const code=(ci>=0&&row[ci]?row[ci]:"").trim();
        const apt=(ni>=0&&row[ni]?row[ni]:"").trim();
        const note=(si>=0&&row[si]?row[si]:"").trim();
        if(!code&&!apt)continue;
        db.codes.push({id:uid(),customerId:cid,code,apt,note,images:[],created:today()});
        added++;
      }
```

**REPLACE:**
```
      const ci=head.indexOf("koodi"),ni=head.indexOf("nimi"),si=head.indexOf("sijainti"),ti=head.indexOf("tyyppi"),pii=head.indexOf("pin");
      let added=0;
      for(let i=1;i<rows.length;i++){
        const row=rows[i];if(!row.length)continue;
        const code=(ci>=0&&row[ci]?row[ci]:"").trim();
        const apt=(ni>=0&&row[ni]?row[ni]:"").trim();
        const note=(si>=0&&row[si]?row[si]:"").trim();
        const type=((ti>=0&&row[ti]?row[ti]:"asukas").trim().toLowerCase())||"asukas";
        const pin=(pii>=0&&row[pii]?row[pii]:"").trim();
        if(!code&&!apt)continue;
        db.codes.push({id:uid(),customerId:cid,code,apt,note,type,pin,images:[],created:today()});
        added++;
      }
```

---

### V2-8 — `ohje24.html`: merkitse demo-huoltokoodi `demo:true`:ksi

**FIND:**
```
  "7HK220":{ type:"huolto", room:"Lämmönjakohuone", loc:"Kellari, A-rappu", pin:"2468" },
```

**REPLACE:**
```
  "7HK220":{ type:"huolto", room:"Lämmönjakohuone", loc:"Kellari, A-rappu", pin:"2468", demo:true },
```

---

### V2-9a — `ohje24.html`: PIN-portti vain jos koodilla on PIN

Jos huoltokoodilla ei ole PINiä, piirustukset näkyvät suoraan (ne eivät ole salaisia — vain kohdistettuja).

**FIND:**
```
function viewHuolto(code,c){
  if(!huoltoUnlocked[code]){
```

**REPLACE:**
```
function viewHuolto(code,c){
  if(!huoltoUnlocked[code] && c.pin){
```

---

### V2-9b — `ohje24.html`: demo-vihje näkyy vain demokoodille

**FIND:**
```
        '<div class="err" id="pinErr"></div>'+
        '<p class="hint">(demo-koodi: '+esc(c.pin)+')</p>'+
      '</div></div>'+footer();
```

**REPLACE:**
```
        '<div class="err" id="pinErr"></div>'+
        (c.demo?'<p class="hint">(demo-koodi: '+esc(c.pin)+')</p>':'')+
      '</div></div>'+footer();
```

---

### V2-10 — `ohje24.html`: cachetetaan palvelinkoodi `CODES`:iin (jotta PIN toimii)

`pinType()` lukee `CODES[currentCode]`. Kun koodi haetaan palvelimelta, se pitää tallentaa `CODES`:iin, muuten PIN-tarkistus ei löydä koodia.

**FIND:**
```
      if(res && res.nakymatyyppi){
        if(res.kohde){ if(res.kohde.nimi)COMPANY.name=res.kohde.nimi; if(res.kohde.osoite)COMPANY.address=res.kohde.osoite; }
        renderView(code, mapServerCode(res));
      } else { renderView(code, {type:null}); }
```

**REPLACE:**
```
      if(res && res.nakymatyyppi){
        if(res.kohde){ if(res.kohde.nimi)COMPANY.name=res.kohde.nimi; if(res.kohde.osoite)COMPANY.address=res.kohde.osoite; }
        var mapped=mapServerCode(res);
        CODES[code]=mapped;
        renderView(code, mapped);
      } else { renderView(code, {type:null}); }
```

---

## VALIDOINTI (aja ennen committia)

```bash
cd ~/Desktop/Servalo

# 1) palvelinkoodin syntaksi
node --check server.js && node --check api.js && node --check db.js && echo "NODE OK"

# 2) HTML-tiedostojen JS-syntaksi
for f in servalo.html ohje24.html; do
  node -e '
const fs=require("fs");
const h=fs.readFileSync(process.argv[1],"utf8");
const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
new Function(s);
console.log(process.argv[1]+" JS OK");
' "$f" || exit 1
done

# 3) uudet palaset löytyvät
for s in "function ncTypeChange" 'id="ncType"' 'id="ncPin"' "nakymatyyppi:t" 'indexOf("tyyppi")' "demo:true" "CODES[code]=mapped" "huoltoUnlocked[code] && c.pin"; do
  grep -rq "$s" servalo.html ohje24.html && echo "OK: $s" || { echo "PUUTTUU: $s"; exit 1; }
done

# 4) kielletyt merkkijonot
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
git commit -m "Vaihe 2: tyyppivalitsin (asukas/aula/laite/huolto) + huolto/piirustukset palvelimelta"
git push origin main
```

Railway deployaa automaattisesti.

---

## TESTAUS (näin todistat että toimii)

1. Servalossa: valitse asiakas → Koodit & kohteet. Työkalurivillä on nyt **tyyppivalitsin**.
2. Valitse **Huolto** → PIN-kenttä ilmestyy. Näppäile koodi esim. `HUOLTO1`, tila `Lämmönjakohuone`, PIN `1234` → **＋ Lisää**.
3. Rivi saa ☁-merkin ja tyyppitagin. Avaa puhelimella `https://servalo-production-8fdd.up.railway.app/k/HUOLTO1`.
4. Julkinen sivu näyttää **huoltonäkymän PIN-portin**. Syötä `1234` → piirustukset + yhteystiedot aukeavat.
5. Lisää **Laite**-tyyppinen koodi → `/k/KOODI` näyttää laitenäkymän. Lisää **Aula**-koodi → aulanäkymä.
6. Kohdistamaton koodi näyttää yhä "Koodi ei ole vielä käytössä".
