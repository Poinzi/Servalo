# Vaihe 5 — koodien liitekuvat palvelimelle (näkyvät kaikilla laitteilla)

**Edellytys:** Vaihe 1–4 ajettu. `api.js`:n auth-portti sisältää jo `/api/raportti` (V4), `servalo.html` sisältää `apiHeaders`, `addCodeImage`, `closeCoverage` (V4).

Tähän asti koodien liitekuvat elivät vain selaimen localStoragessa (muistiraja + ei näy muilla laitteilla). Nyt kuvat tallentuvat Postgresin `liitteet`-tauluun (bytea) ja niitä voi katsella miltä laitteelta tahansa. **Skeemaa ei tarvitse muuttaa** — `liitteet`-taulu on jo olemassa. Kaksi tiedostoa: `api.js` (3 reittiä) ja `servalo.html` (nappi + upload + katselu-overlay).

Kuvat kulkevat data-URL:na autentikoidussa fetchissä (ei `<img>`-headerongelmaa). Paikallinen `x.images` säilyy välittömään esikatseluun; palvelin on lähde ristiin laitteille.

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

---

### V5-1 — `api.js`: lisää `/api/liite` auth-portin ehtoihin

**FIND:**
```
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista") || p.startsWith("/api/raportti")) {
      if (!requireAuth()) return;
    }
```

**REPLACE:**
```
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista") || p.startsWith("/api/raportti") || p.startsWith("/api/liite")) {
      if (!requireAuth()) return;
    }
```

---

### V5-2 — `api.js`: lisää kuvareitit (POST/GET/DELETE) ennen 404-fallbackia

**FIND:**
```
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown koodi" });
      return sendJson(res, 200, { ok: true, koodi: q.rows[0].koodi });
    }

    return sendJson(res, 404, { error: "unknown api route" });
```

**REPLACE:**
```
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown koodi" });
      return sendJson(res, 200, { ok: true, koodi: q.rows[0].koodi });
    }

    // POST /api/liite (auth: tallenna koodin liitekuva Postgresiin)
    if (method === "POST" && p === "/api/liite") {
      const body = await readBody(req, 1024 * 1024 * 6); // max ~6 MB
      const koodi = String(body.koodi || "").trim().toUpperCase();
      const dataUrl = String(body.dataUrl || "");
      if (!koodi) return sendJson(res, 400, { error: "koodi required" });
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return sendJson(res, 400, { error: "invalid dataUrl" });
      const mime = m[1];
      const buf = Buffer.from(m[2], "base64");
      const exists = await db.query("SELECT kohde_id FROM koodit WHERE koodi=$1", [koodi]);
      if (!exists.rows.length) return sendJson(res, 404, { error: "unknown koodi" });
      const ins = await db.query(
        "INSERT INTO liitteet (koodi, kohde_id, tyyppi, nimi, mime, data) VALUES ($1,$2,'kuva',$3,$4,$5) RETURNING id, luotu",
        [koodi, exists.rows[0].kohde_id, "kuva-" + Date.now() + ".jpg", mime, buf]
      );
      return sendJson(res, 201, { id: ins.rows[0].id, luotu: ins.rows[0].luotu });
    }

    // GET /api/liitteet/:koodi (auth: listaa koodin kuvat data-URL:eina)
    if (method === "GET" && p.startsWith("/api/liitteet/")) {
      const koodi = decodeURIComponent(p.slice("/api/liitteet/".length)).trim().toUpperCase();
      if (!koodi) return sendJson(res, 400, { error: "empty koodi" });
      const q = await db.query(
        "SELECT id, mime, encode(data,'base64') AS b64, luotu FROM liitteet WHERE koodi=$1 AND tyyppi='kuva' ORDER BY luotu",
        [koodi]
      );
      const kuvat = q.rows.map((r) => ({
        id: r.id,
        mime: r.mime,
        luotu: r.luotu,
        dataUrl: "data:" + (r.mime || "image/jpeg") + ";base64," + r.b64,
      }));
      return sendJson(res, 200, kuvat);
    }

    // DELETE /api/liite/:id (auth)
    const mLiite = p.match(/^\/api\/liite\/([0-9a-f-]{36})$/i);
    if (method === "DELETE" && mLiite) {
      const q = await db.query("DELETE FROM liitteet WHERE id=$1 RETURNING id", [mLiite[1]]);
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown liite" });
      return sendJson(res, 200, { ok: true, id: q.rows[0].id });
    }

    return sendJson(res, 404, { error: "unknown api route" });
```

---

### V5-3 — `servalo.html`: `addCodeImage` työntää kuvan myös palvelimelle

**FIND:**
```
        const data=cv.toDataURL("image/jpeg",0.6);
        x.images=x.images||[];x.images.push(data);
        try{save();}catch(e){x.images.pop();alert("Muisti täynnä — kuvaa ei voitu tallentaa. Kuvat siirtyvät backend-vaiheessa palvelimelle.");}
        refreshCodes();
```

**REPLACE:**
```
        const data=cv.toDataURL("image/jpeg",0.6);
        x.images=x.images||[];x.images.push(data);
        try{save();}catch(e){x.images.pop();alert("Selaimen paikallinen muisti täynnä — kuva viedään vain palvelimelle.");}
        refreshCodes();
        if(x.synced){ pushImage(x.code,data).then(function(){}).catch(function(){}); }
```

---

### V5-4 — `servalo.html`: "☁🖼" -nappi Liitteet-sarakkeeseen (vain synkatuille)

**FIND:**
```
      '<td>'+thumbs+'<button class="btn sm ghost" onclick="addCodeImage(\''+x.id+'\')">📎 +</button></td>'+
```

**REPLACE:**
```
      '<td>'+thumbs+'<button class="btn sm ghost" onclick="addCodeImage(\''+x.id+'\')">📎 +</button>'+(x.synced?' <button class="btn sm ghost" onclick="viewServerImages(\''+x.id+'\')" title="Palvelinkuvat">☁🖼</button>':'')+'</td>'+
```

---

### V5-5 — `servalo.html`: kuvien upload + katselu-overlay -funktiot

`closeCoverage` (V4) on viimeinen kattavuusraportin funktio. Lisätään kuvafunktiot heti sen perään.

**FIND:**
```
function closeCoverage(){ var o=document.getElementById("covOverlay"); if(o)o.remove(); }
```

**REPLACE:**
```
function closeCoverage(){ var o=document.getElementById("covOverlay"); if(o)o.remove(); }
function pushImage(code,dataUrl){
  return fetch("/api/liite",{method:"POST",headers:apiHeaders(),body:JSON.stringify({koodi:code,dataUrl:dataUrl})})
    .then(function(r){return r.ok?r.json():null;}).then(function(j){ return (j&&j.id)||null; });
}
function viewServerImages(id){
  var x=(db.codes||[]).find(c=>c.id===id); if(!x)return;
  fetch("/api/liitteet/"+encodeURIComponent(x.code),{headers:apiHeaders()})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(list){ if(!list){ alert("Kuvien haku epäonnistui."); return; } renderImagesOverlay(x.code, list); })
    .catch(function(){ alert("Palvelimeen ei saatu yhteyttä."); });
}
function renderImagesOverlay(code, list){
  var body = list.length ? list.map(function(im){
    return '<div style="position:relative;display:inline-block;margin:6px">'+
      '<img src="'+im.dataUrl+'" style="width:140px;height:140px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">'+
      '<button class="btn sm danger" style="position:absolute;top:4px;right:4px" onclick="deleteServerImage(\''+im.id+'\',\''+esc(code)+'\')">🗑</button>'+
    '</div>';
  }).join("") : '<p style="color:#64748b">Ei palvelinkuvia tälle koodille vielä. Lisää kuva 📎 +.</p>';
  var ov=document.createElement("div"); ov.id="imgOverlay";
  ov.style.cssText="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto";
  ov.innerHTML='<div style="background:#fff;border-radius:14px;max-width:680px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.3)">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'+
      '<h2 style="margin:0;font-size:18px">☁🖼 Palvelinkuvat · '+esc(code)+'</h2>'+
      '<button class="btn ghost" onclick="closeImages()">✕ Sulje</button></div>'+
    '<div>'+body+'</div>'+
    '<p style="font-size:12px;color:#64748b;margin-top:12px">Tallennettu palvelimelle, näkyvät kaikilla laitteilla.</p></div>';
  ov.addEventListener("click",function(e){ if(e.target===ov) closeImages(); });
  document.body.appendChild(ov);
}
function closeImages(){ var o=document.getElementById("imgOverlay"); if(o)o.remove(); }
function deleteServerImage(imgId, code){
  if(!confirm("Poistetaanko palvelinkuva?"))return;
  fetch("/api/liite/"+encodeURIComponent(imgId),{method:"DELETE",headers:apiHeaders()})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(){ closeImages(); var x=(db.codes||[]).find(c=>(c.code||"").toUpperCase()===code.toUpperCase()); if(x) viewServerImages(x.id); })
    .catch(function(){});
}
```

---

## VALIDOINTI (aja ennen committia)

```bash
cd ~/Desktop/Servalo

# 1) palvelinkoodin syntaksi
node --check server.js && node --check api.js && node --check db.js && echo "NODE OK"

# 2) servalo.html JS-syntaksi
node -e '
const fs=require("fs");
const h=fs.readFileSync("servalo.html","utf8");
const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
new Function(s);
console.log("servalo.html JS OK");
'

# 3) uudet palaset löytyvät
for s in '"/api/liite"' "/api/liitteet/" "function pushImage" "function viewServerImages" "function deleteServerImage" "☁🖼"; do
  grep -rq "$s" api.js servalo.html && echo "OK: $s" || { echo "PUUTTUU: $s"; exit 1; }
done

# 4) kielletyt merkkijonot
if grep -rnE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html ohje24.html api.js db.js server.js; then
  echo "VAROITUS: tarkista osumat"; else echo "Ei kiellettyjä merkkijonoja"; fi
```

Kaikki `OK:`, `NODE OK` ja `servalo.html JS OK` → jatka. Muuten pysähdy.

---

## COMMIT & PUSH

```bash
cd ~/Desktop/Servalo
rm -f .git/index.lock
git add -A
git commit -m "Vaihe 5: koodien liitekuvat Postgresiin - naekyvaet kaikilla laitteilla"
git push origin main
```

Railway deployaa automaattisesti.

---

## TESTAUS (näin todistat että toimii)

1. **Laite A:** valitse asiakas → Koodit & kohteet. Varmista että koodi on synkattu (☁-merkki; muuten paina ☁ Vie palvelimelle).
2. Paina synkatun koodin **📎 +** ja ota/valitse kuva. Se tallentuu paikallisesti JA palvelimelle.
3. Paina saman rivin **☁🖼** → overlay näyttää palvelimelle tallennetut kuvat.
4. **Laite B** (toinen selain/incognito, kirjaudu, ⟳ Hae palvelimelta): paina saman koodin **☁🖼** → sama kuva näkyy. Tämä todistaa että kuva tuli palvelimelta.
5. Poista kuva overlaysta (🗑) → lista päivittyy; kuva katoaa myös laite A:lta kun avaat ☁🖼 uudelleen.
