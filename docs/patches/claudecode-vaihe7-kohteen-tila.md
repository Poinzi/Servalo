# Vaihe 7 — kohteen turvallisuustilanne hallittavaksi (näkyy /k-asukas- ja aulanäkymässä)

**Edellytys:** Vaihe 1–6 ajettu. `servalo.html` sisältää `apiHeaders`, `ensureKohde`, `deleteContact` (V6); `ohje24.html`:n `render` on V6-tilassa (sisältää `SERVER_CONTACTS[code]=res.huolto_kontaktit`).

`kohteet.status` on jo jsonb-sarakkeena ja julkinen API palauttaa sen — mutta sitä ei voinut muokata eikä `/k`-sivu vielä käyttänyt sitä (statusBlock luki kovakoodatun `COMPANY.status`). Tämä patch lisää muokkausreitin, Servalo-paneelin tilarivien hallintaan, ja saa asukas-/aulanäkymän näyttämään palvelimen tilan kun se on asetettu.

Status-rivi = `{name, meta, state}`, missä `state` ∈ `ok` / `warn` / `expired`.

Kolme tiedostoa: `api.js`, `servalo.html`, `ohje24.html`.

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

---

### V7-1 — `api.js`: `POST /api/kohteet/:id/status` (auth-portti kattaa jo `/api/kohteet`)

**FIND:**
```
      return sendJson(res, 200, { ...q.rows[0], koodit: koodit.rows, huolto_kontaktit: kontaktit.rows });
    }
```

**REPLACE:**
```
      return sendJson(res, 200, { ...q.rows[0], koodit: koodit.rows, huolto_kontaktit: kontaktit.rows });
    }

    // POST /api/kohteet/:id/status (auth: päivitä turvallisuustilanne)
    const mStatus = p.match(/^\/api\/kohteet\/([0-9a-f-]{36})\/status$/i);
    if (method === "POST" && mStatus) {
      const body = await readBody(req);
      if (!Array.isArray(body.status)) return sendJson(res, 400, { error: "status array required" });
      const q = await db.query(
        "UPDATE kohteet SET status=$2::jsonb WHERE id=$1 RETURNING id, status",
        [mStatus[1], JSON.stringify(body.status)]
      );
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown kohde" });
      return sendJson(res, 200, { ok: true, id: q.rows[0].id, status: q.rows[0].status });
    }
```

---

### V7-2 — `servalo.html`: turvallisuustilanne-paneeli asiakasnäkymään

**FIND:**
```
    <div class="panel"><div class="panel-h">Avoimet huoltopyynnöt</div><div class="panel-b" style="padding:0">
```

**REPLACE:**
```
    <div class="panel"><div class="panel-h">Turvallisuustilanne (näkyy /k-asukas- ja aulanäkymässä)</div><div class="panel-b">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
        <input id="stName" placeholder="Kohde (Käsisammuttimet)" style="flex:1;min-width:140px;padding:9px;border:1px solid var(--line);border-radius:8px">
        <input id="stMeta" placeholder="Lisätieto (Tarkastettu 3/2026)" style="flex:2;min-width:160px;padding:9px;border:1px solid var(--line);border-radius:8px">
        <select id="stState" style="min-width:130px;padding:9px;border:1px solid var(--line);border-radius:8px">
          <option value="ok">Voimassa</option>
          <option value="warn">Muista</option>
          <option value="expired">Vanhentunut</option>
        </select>
        <button class="btn orange" type="button" onclick="addStatusRow('${c.id}')">＋ Lisää rivi</button>
        <button class="btn primary" type="button" onclick="saveStatus('${c.id}')">💾 Tallenna palvelimelle</button>
        <button class="btn ghost" type="button" onclick="loadStatus('${c.id}')">⟳ Hae</button>
      </div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Kohde</th><th>Lisätieto</th><th>Tila</th><th></th></tr></thead>
        <tbody>${statusRowsHtml(c.id)}</tbody></table></div>
    </div></div>
    <div class="panel"><div class="panel-h">Avoimet huoltopyynnöt</div><div class="panel-b" style="padding:0">
```

---

### V7-3 — `servalo.html`: tilarivien logiikkafunktiot

**FIND:**
```
function deleteContact(cid, contactId){
  var c=custById(cid); if(!c)return;
  if(!confirm("Poistetaanko huoltokontakti?"))return;
  fetch("/api/kontakti/"+encodeURIComponent(contactId),{method:"DELETE",headers:apiHeaders()})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(){ c.contacts=(c.contacts||[]).filter(function(k){return k.id!==contactId;}); save(); refreshContacts(); })
    .catch(function(){});
}
```

**REPLACE:**
```
function deleteContact(cid, contactId){
  var c=custById(cid); if(!c)return;
  if(!confirm("Poistetaanko huoltokontakti?"))return;
  fetch("/api/kontakti/"+encodeURIComponent(contactId),{method:"DELETE",headers:apiHeaders()})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(){ c.contacts=(c.contacts||[]).filter(function(k){return k.id!==contactId;}); save(); refreshContacts(); })
    .catch(function(){});
}
function statusOf(c){ return (c && c.status) || []; }
function statusRowsHtml(cid){
  var c=custById(cid); var list=statusOf(c);
  if(!list.length) return '<tr><td colspan="4" class="empty">Ei tilarivejä. Lisää yllä ja tallenna palvelimelle.</td></tr>';
  return list.map(function(s,i){
    var lab = s.state==="ok"?"Voimassa":s.state==="warn"?"Muista":"Vanhentunut";
    return '<tr>'+
      '<td>'+esc(s.name||"")+'</td>'+
      '<td>'+esc(s.meta||"")+'</td>'+
      '<td>'+esc(lab)+'</td>'+
      '<td><button class="btn sm danger" onclick="removeStatusRow(\''+cid+'\','+i+')">🗑</button></td>'+
    '</tr>';
  }).join("");
}
function refreshStatus(){ if(document.getElementById("view-customer").classList.contains("active"))renderCustomerDetail(); }
function addStatusRow(cid){
  var c=custById(cid); if(!c)return;
  var name=(document.getElementById("stName").value||"").trim();
  var meta=(document.getElementById("stMeta").value||"").trim();
  var state=(document.getElementById("stState")||{}).value||"ok";
  if(!name){alert("Anna rivin nimi.");return;}
  c.status=c.status||[]; c.status.push({name:name,meta:meta,state:state}); save(); refreshStatus();
  ["stName","stMeta"].forEach(function(id){var e=document.getElementById(id); if(e)e.value="";});
}
function removeStatusRow(cid,i){
  var c=custById(cid); if(!c)return;
  c.status=(c.status||[]).filter(function(_,idx){return idx!==i;}); save(); refreshStatus();
}
async function saveStatus(cid){
  var c=custById(cid); if(!c)return;
  var kid;
  try{ kid=await ensureKohde(c); }catch(e){ alert("Kohteen luonti palvelimelle epäonnistui."); return; }
  var r=await fetch("/api/kohteet/"+encodeURIComponent(kid)+"/status",{method:"POST",headers:apiHeaders(),body:JSON.stringify({status:c.status||[]})});
  if(!r.ok){ alert("Tallennus epäonnistui ("+r.status+")."); return; }
  alert("Turvallisuustilanne tallennettu. Näkyy /k-asukas- ja aulanäkymässä.");
}
function loadStatus(cid){
  var c=custById(cid); if(!c)return;
  if(!c.kohdeId){ alert("Ei palvelinkohdetta vielä. Vie koodeja tai lisää kontakti ensin."); return; }
  fetch("/api/kohteet/"+encodeURIComponent(c.kohdeId),{headers:apiHeaders()})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(j){ if(!j){alert("Haku epäonnistui.");return;} c.status=Array.isArray(j.status)?j.status:[]; save(); refreshStatus(); })
    .catch(function(){ alert("Palvelimeen ei saatu yhteyttä."); });
}
```

---

### V7-4 — `ohje24.html`: asukas-/aulanäkymä käyttää palvelimen tilaa kun se on asetettu

**FIND:**
```
        if(res.kohde){ if(res.kohde.nimi)COMPANY.name=res.kohde.nimi; if(res.kohde.osoite)COMPANY.address=res.kohde.osoite; }
        if(res.huolto_kontaktit) SERVER_CONTACTS[code]=res.huolto_kontaktit;
```

**REPLACE:**
```
        if(res.kohde){ if(res.kohde.nimi)COMPANY.name=res.kohde.nimi; if(res.kohde.osoite)COMPANY.address=res.kohde.osoite; if(Array.isArray(res.kohde.status)&&res.kohde.status.length)COMPANY.status=res.kohde.status; }
        if(res.huolto_kontaktit) SERVER_CONTACTS[code]=res.huolto_kontaktit;
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
for s in "/status$" "function saveStatus" "function addStatusRow" "function statusRowsHtml" "Turvallisuustilanne" "COMPANY.status=res.kohde.status"; do
  grep -rq "$s" api.js servalo.html ohje24.html && echo "OK: $s" || { echo "PUUTTUU: $s"; exit 1; }
done

# 4) kielletyt merkkijonot
if grep -rnE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html ohje24.html api.js db.js server.js; then
  echo "VAROITUS: tarkista osumat"; else echo "Ei kiellettyjä merkkijonoja"; fi
```

Kaikki `OK:`, `NODE OK` ja molemmat `... JS OK` → jatka. Muuten pysähdy.

---

## COMMIT & PUSH

```bash
cd ~/Desktop/Servalo
rm -f .git/index.lock
git add -A
git commit -m "Vaihe 7: kohteen turvallisuustilanne hallittavaksi + naekyy /k-asukas- ja aulanaekymaessae"
git push origin main
```

Railway deployaa automaattisesti.

---

## TESTAUS (näin todistat että toimii)

1. Servalossa: valitse asiakas → uusi paneeli **Turvallisuustilanne**. Lisää esim. "Käsisammuttimet" / "Tarkastettu 3/2026" / Voimassa → **＋ Lisää rivi**. Lisää toinen rivi tilalla Muista tai Vanhentunut.
2. Paina **💾 Tallenna palvelimelle**.
3. Avaa asukaskoodin sivu `https://servalo-production-8fdd.up.railway.app/k/ASUKASKOODI` (koodin oltava viety palvelimelle, V2). "Taloyhtiön turvallisuustilanne" -kortti näyttää nyt juuri asettamasi rivit oikeilla väreillä (vihreä/keltainen/punainen).
4. Sama näkyy aulakoodilla (`/k/AULAKOODI`).
5. Muuta rivejä Servalossa → 💾 Tallenna → päivitä /k-sivu → muutokset näkyvät. **⟳ Hae** lataa tilan toiselle laitteelle.
