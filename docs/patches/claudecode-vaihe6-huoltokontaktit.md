# Vaihe 6 — huoltokontaktien hallinta per kohde (näkyvät /k/HUOLTOKOODI-sivulla)

**Edellytys:** Vaihe 1–5 ajettu. `api.js`:n auth-portti sisältää `/api/liite` (V5); `servalo.html` sisältää `apiHeaders`, `ensureKohde`, `refreshCodes`; `ohje24.html`:n `render`/`viewHuolto` ovat V2-tilassa.

`huolto_kontaktit`-taulu on jo skeemassa ja julkinen API palauttaa ne huoltonäkymälle — mutta niitä ei voinut hallita eikä `/k/HUOLTOKOODI` vielä käyttänyt niitä (kovakoodattu CONTACTS). Tämä patch lisää: hallintareitit (`api.js`), Servalo-paneelin kontaktien lisäämiseen/poistoon per kohde, ja saa julkisen huoltosivun näyttämään palvelimen kontaktit kun niitä on.

Kolme tiedostoa: `api.js`, `servalo.html`, `ohje24.html`.

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

---

### V6-1 — `api.js`: lisää `/api/kontakti` auth-portin ehtoihin

**FIND:**
```
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista") || p.startsWith("/api/raportti") || p.startsWith("/api/liite")) {
      if (!requireAuth()) return;
    }
```

**REPLACE:**
```
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista") || p.startsWith("/api/raportti") || p.startsWith("/api/liite") || p.startsWith("/api/kontakti")) {
      if (!requireAuth()) return;
    }
```

---

### V6-2 — `api.js`: kontaktireitit (POST/DELETE) ennen 404-fallbackia

**FIND:**
```
    // DELETE /api/liite/:id (auth)
    const mLiite = p.match(/^\/api\/liite\/([0-9a-f-]{36})$/i);
    if (method === "DELETE" && mLiite) {
      const q = await db.query("DELETE FROM liitteet WHERE id=$1 RETURNING id", [mLiite[1]]);
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown liite" });
      return sendJson(res, 200, { ok: true, id: q.rows[0].id });
    }

    return sendJson(res, 404, { error: "unknown api route" });
```

**REPLACE:**
```
    // DELETE /api/liite/:id (auth)
    const mLiite = p.match(/^\/api\/liite\/([0-9a-f-]{36})$/i);
    if (method === "DELETE" && mLiite) {
      const q = await db.query("DELETE FROM liitteet WHERE id=$1 RETURNING id", [mLiite[1]]);
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown liite" });
      return sendJson(res, 200, { ok: true, id: q.rows[0].id });
    }

    // POST /api/kontakti (auth: lisää hyväksytty huoltokontakti kohteelle)
    if (method === "POST" && p === "/api/kontakti") {
      const body = await readBody(req);
      const kohdeId = String(body.kohde_id || "").trim();
      const yritys = String(body.yritys || "").trim();
      const ala = String(body.ala || "").trim();
      if (!kohdeId) return sendJson(res, 400, { error: "kohde_id required" });
      if (!yritys) return sendJson(res, 400, { error: "yritys required" });
      const kohdeQ = await db.query("SELECT id FROM kohteet WHERE id=$1", [kohdeId]);
      if (!kohdeQ.rows.length) return sendJson(res, 404, { error: "unknown kohde" });
      const ins = await db.query(
        `INSERT INTO huolto_kontaktit (kohde_id, ala, ikoni, yritys, puhelin, hyvaksytty)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,true))
         RETURNING id, ala, ikoni, yritys, puhelin, hyvaksytty`,
        [kohdeId, ala, body.ikoni || "🔧", yritys, body.puhelin || null, typeof body.hyvaksytty === "boolean" ? body.hyvaksytty : null]
      );
      return sendJson(res, 201, ins.rows[0]);
    }

    // DELETE /api/kontakti/:id (auth)
    const mKont = p.match(/^\/api\/kontakti\/([0-9a-f-]{36})$/i);
    if (method === "DELETE" && mKont) {
      const q = await db.query("DELETE FROM huolto_kontaktit WHERE id=$1 RETURNING id", [mKont[1]]);
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown kontakti" });
      return sendJson(res, 200, { ok: true, id: q.rows[0].id });
    }

    return sendJson(res, 404, { error: "unknown api route" });
```

---

### V6-3 — `servalo.html`: huoltokontaktit-paneeli asiakasnäkymään

**FIND:**
```
        <tbody>${codeRowsHtml(c.id)}</tbody></table></div>
    </div></div>
    <div class="panel"><div class="panel-h">Avoimet huoltopyynnöt</div><div class="panel-b" style="padding:0">
```

**REPLACE:**
```
        <tbody>${codeRowsHtml(c.id)}</tbody></table></div>
    </div></div>
    <div class="panel"><div class="panel-h">Hyväksytyt huoltokontaktit (näkyvät /k/HUOLTOKOODI-sivulla)</div><div class="panel-b">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
        <input id="kkAla" placeholder="Ala (Putkityöt)" style="flex:1;min-width:120px;padding:9px;border:1px solid var(--line);border-radius:8px">
        <input id="kkYritys" placeholder="Yritys" style="flex:1;min-width:140px;padding:9px;border:1px solid var(--line);border-radius:8px">
        <input id="kkPuh" placeholder="Puhelin" style="flex:1;min-width:120px;padding:9px;border:1px solid var(--line);border-radius:8px">
        <button class="btn orange" type="button" onclick="addContact('${c.id}')">＋ Lisää kontakti</button>
        <button class="btn ghost" type="button" onclick="loadContacts('${c.id}')">⟳ Hae palvelimelta</button>
      </div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Ala</th><th>Yritys</th><th>Puhelin</th><th></th></tr></thead>
        <tbody>${contactRowsHtml(c.id)}</tbody></table></div>
    </div></div>
    <div class="panel"><div class="panel-h">Avoimet huoltopyynnöt</div><div class="panel-b" style="padding:0">
```

---

### V6-4 — `servalo.html`: kontaktien logiikkafunktiot

**FIND:**
```
function refreshCodes(){ if(document.getElementById("view-customer").classList.contains("active"))renderCustomerDetail(); }
```

**REPLACE:**
```
function refreshCodes(){ if(document.getElementById("view-customer").classList.contains("active"))renderCustomerDetail(); }
function contactsOf(c){ return (c && c.contacts) || []; }
function contactRowsHtml(cid){
  var c=custById(cid); var list=contactsOf(c);
  if(!list.length) return '<tr><td colspan="4" class="empty">Ei huoltokontakteja. Lisää yllä.</td></tr>';
  return list.map(function(k){
    return '<tr>'+
      '<td>'+esc(k.ikoni||"🔧")+' '+esc(k.ala||"")+'</td>'+
      '<td>'+esc(k.yritys||"")+'</td>'+
      '<td>'+esc(k.puhelin||"")+'</td>'+
      '<td style="white-space:nowrap">'+(k.hyvaksytty===false?'<span style="color:#b45309">ei hyväksytty</span> ':'')+
        '<button class="btn sm danger" onclick="deleteContact(\''+cid+'\',\''+k.id+'\')">🗑</button></td>'+
    '</tr>';
  }).join("");
}
function refreshContacts(){ if(document.getElementById("view-customer").classList.contains("active"))renderCustomerDetail(); }
async function addContact(cid){
  var c=custById(cid); if(!c)return;
  var ala=(document.getElementById("kkAla").value||"").trim();
  var yritys=(document.getElementById("kkYritys").value||"").trim();
  var puh=(document.getElementById("kkPuh").value||"").trim();
  if(!yritys){alert("Anna yrityksen nimi.");return;}
  var kid;
  try{ kid=await ensureKohde(c); }catch(e){ alert("Kohteen luonti palvelimelle epäonnistui."); return; }
  var r=await fetch("/api/kontakti",{method:"POST",headers:apiHeaders(),body:JSON.stringify({kohde_id:kid,ala:ala,yritys:yritys,puhelin:puh})});
  if(!r.ok){ alert("Kontaktin tallennus epäonnistui ("+r.status+")."); return; }
  var j=await r.json();
  c.contacts=c.contacts||[]; c.contacts.push(j); save(); refreshContacts();
  ["kkAla","kkYritys","kkPuh"].forEach(function(id){var e=document.getElementById(id); if(e)e.value="";});
}
function loadContacts(cid){
  var c=custById(cid); if(!c)return;
  if(!c.kohdeId){ alert("Ei palvelinkohdetta vielä. Lisää kontakti tai vie koodeja ensin."); return; }
  fetch("/api/kohteet/"+encodeURIComponent(c.kohdeId),{headers:apiHeaders()})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(j){ if(!j){alert("Haku epäonnistui.");return;} c.contacts=j.huolto_kontaktit||[]; save(); refreshContacts(); })
    .catch(function(){ alert("Palvelimeen ei saatu yhteyttä."); });
}
function deleteContact(cid, contactId){
  var c=custById(cid); if(!c)return;
  if(!confirm("Poistetaanko huoltokontakti?"))return;
  fetch("/api/kontakti/"+encodeURIComponent(contactId),{method:"DELETE",headers:apiHeaders()})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(){ c.contacts=(c.contacts||[]).filter(function(k){return k.id!==contactId;}); save(); refreshContacts(); })
    .catch(function(){});
}
```

---

### V6-5 — `ohje24.html`: lisää `SERVER_CONTACTS`-välimuisti

**FIND:**
```
/* ================= PIN ================= */
var huoltoUnlocked = {};
```

**REPLACE:**
```
/* ================= PIN ================= */
var huoltoUnlocked = {};
var SERVER_CONTACTS = {};
```

---

### V6-6 — `ohje24.html`: huoltonäkymä käyttää palvelimen kontakteja kun niitä on

**FIND:**
```
    '<div class="card"><h2>Hyväksytyt yhteystiedot</h2>'+
      CONTACTS.map(function(x){return '<div class="contact"><span class="ic">'+x.ic+'</span>'+
        '<div class="grow"><div class="t">'+esc(x.yritys)+'</div><div class="s">'+esc(x.ala)+'</div></div>'+
        '<a href="tel:'+esc(x.puh.replace(/\s/g,""))+'">'+esc(x.puh)+'</a></div>';}).join("")+
      '<div class="note" style="margin-top:10px">'+esc(TARVIKKEET)+'</div>'+
    '</div>'+
```

**REPLACE:**
```
    '<div class="card"><h2>Hyväksytyt yhteystiedot</h2>'+
      ((SERVER_CONTACTS[code]&&SERVER_CONTACTS[code].length
        ? SERVER_CONTACTS[code].map(function(k){return {ic:k.ikoni||"🔧", yritys:k.yritys||"", ala:k.ala||"", puh:k.puhelin||""};})
        : CONTACTS
      ).map(function(x){return '<div class="contact"><span class="ic">'+x.ic+'</span>'+
        '<div class="grow"><div class="t">'+esc(x.yritys)+'</div><div class="s">'+esc(x.ala)+'</div></div>'+
        '<a href="tel:'+esc((x.puh||"").replace(/\s/g,""))+'">'+esc(x.puh)+'</a></div>';}).join(""))+
      '<div class="note" style="margin-top:10px">'+esc(TARVIKKEET)+'</div>'+
    '</div>'+
```

---

### V6-7 — `ohje24.html`: tallenna palvelimen kontaktit koodinhaussa

**FIND:**
```
      if(res && res.nakymatyyppi){
        if(res.kohde){ if(res.kohde.nimi)COMPANY.name=res.kohde.nimi; if(res.kohde.osoite)COMPANY.address=res.kohde.osoite; }
        var mapped=mapServerCode(res);
        CODES[code]=mapped;
        renderView(code, mapped);
      } else { renderView(code, {type:null}); }
```

**REPLACE:**
```
      if(res && res.nakymatyyppi){
        if(res.kohde){ if(res.kohde.nimi)COMPANY.name=res.kohde.nimi; if(res.kohde.osoite)COMPANY.address=res.kohde.osoite; }
        if(res.huolto_kontaktit) SERVER_CONTACTS[code]=res.huolto_kontaktit;
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
for s in '"/api/kontakti"' "function addContact" "function deleteContact" "function contactRowsHtml" "SERVER_CONTACTS" "Hyväksytyt huoltokontaktit"; do
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
git commit -m "Vaihe 6: huoltokontaktien hallinta per kohde + julkinen huoltosivu kaeyttaeae palvelimen kontakteja"
git push origin main
```

Railway deployaa automaattisesti.

---

## TESTAUS (näin todistat että toimii)

1. Servalossa: valitse asiakas → uusi paneeli **Hyväksytyt huoltokontaktit**. Lisää esim. Ala "Putkityöt", Yritys "Putkiliike X Oy", Puhelin "040 123 4567" → **＋ Lisää kontakti**.
2. Varmista että asiakkaalla on **huolto**-tyyppinen koodi viety palvelimelle (V2). Avaa `https://servalo-production-8fdd.up.railway.app/k/HUOLTOKOODI` ja syötä PIN.
3. "Hyväksytyt yhteystiedot" -kortti näyttää nyt juuri lisäämäsi kontaktin (ei enää kovakoodattua demolistaa).
4. Poista kontakti Servalosta (🗑) → päivitä huoltosivu → kontakti katoaa.
5. **⟳ Hae palvelimelta** -nappi lataa kontaktit toiselle laitteelle/istuntoon.
