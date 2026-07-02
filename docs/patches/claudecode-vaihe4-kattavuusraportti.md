# Vaihe 4 — kattavuusraportti (kohdistus per kohde + palovaroitin-kuittausten kattavuus)

**Edellytys:** Vaihe 1–3 ajettu. servalo.html sisältää `apiHeaders`, `pullCodes` (V3), ja koodien työkalurivillä on napit ☁ Vie / ⟳ Hae.

Uusi näkymä Servaloon: montako koodia kullakin kohteella on kohdistettu (tyypeittäin) ja kuinka moni asukaskoodi on saanut palovaroitin-kuittauksen. Data lasketaan palvelimella (`GET /api/raportti/kattavuus`) ja näytetään overlay-taulukkona. Kaksi tiedostoa: `api.js` (uusi reitti) ja `servalo.html` (nappi + overlay).

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

---

### V4-1 — `api.js`: lisää `/api/raportti` auth-portin taakse

**FIND:**
```
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista")) {
      if (!requireAuth()) return;
    }
```

**REPLACE:**
```
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista") || p.startsWith("/api/raportti")) {
      if (!requireAuth()) return;
    }

    // GET /api/raportti/kattavuus (auth: kohdistus + palovaroitin-kattavuus per kohde)
    if (method === "GET" && p === "/api/raportti/kattavuus") {
      const q = await db.query(
        `SELECT t.id, t.nimi, t.osoite,
           (SELECT count(*) FROM koodit k WHERE k.kohde_id=t.id AND k.nakymatyyppi IS NOT NULL)::int AS koodit_lkm,
           (SELECT count(*) FROM koodit k WHERE k.kohde_id=t.id AND k.nakymatyyppi='asukas')::int AS asukas_lkm,
           (SELECT count(*) FROM koodit k WHERE k.kohde_id=t.id AND k.nakymatyyppi='laite')::int AS laite_lkm,
           (SELECT count(*) FROM koodit k WHERE k.kohde_id=t.id AND k.nakymatyyppi='huolto')::int AS huolto_lkm,
           (SELECT count(DISTINCT ku.koodi) FROM kuittaukset ku JOIN koodit k ON k.koodi=ku.koodi
              WHERE k.kohde_id=t.id AND k.nakymatyyppi='asukas' AND ku.tyyppi='palovaroitin')::int AS kuitatut_asukkaat,
           (SELECT max(ku.aikaleima) FROM kuittaukset ku JOIN koodit k ON k.koodi=ku.koodi
              WHERE k.kohde_id=t.id AND ku.tyyppi='palovaroitin') AS viimeisin_kuittaus
         FROM kohteet t
         ORDER BY t.nimi`
      );
      return sendJson(res, 200, q.rows);
    }
```

---

### V4-2 — `servalo.html`: "📊 Kattavuus" -nappi työkaluriviin

**FIND:**
```
        <button class="btn ghost" type="button" onclick="pullCodes('${c.id}')">⟳ Hae palvelimelta</button>
```

**REPLACE:**
```
        <button class="btn ghost" type="button" onclick="pullCodes('${c.id}')">⟳ Hae palvelimelta</button>
        <button class="btn ghost" type="button" onclick="showCoverage()">📊 Kattavuus</button>
```

---

### V4-3 — `servalo.html`: `showCoverage()` + overlay-renderöinti

`pullCodes` päättyy näihin riveihin. Lisätään raporttifunktiot heti sen perään.

**FIND:**
```
    alert("Palvelimelta haettu: "+added+" uutta, "+updated+" päivitetty.");
  })();
}
```

**REPLACE:**
```
    alert("Palvelimelta haettu: "+added+" uutta, "+updated+" päivitetty.");
  })();
}
function showCoverage(){
  fetch("/api/raportti/kattavuus",{headers:apiHeaders()})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(rows){ if(!rows){ alert("Raportin haku epäonnistui (oletko kirjautunut?)."); return; } renderCoverageOverlay(rows); })
    .catch(function(){ alert("Palvelimeen ei saatu yhteyttä."); });
}
function renderCoverageOverlay(rows){
  var bodyHtml=rows.map(function(r){
    var kuit = r.asukas_lkm>0 ? (r.kuitatut_asukkaat+"/"+r.asukas_lkm) : "–";
    var pct = r.asukas_lkm>0 ? Math.round(100*r.kuitatut_asukkaat/r.asukas_lkm)+"%" : "–";
    var viim = r.viimeisin_kuittaus ? new Date(r.viimeisin_kuittaus).toLocaleDateString("fi-FI") : "–";
    return '<tr>'+
      '<td style="padding:6px"><b>'+esc(r.nimi||"")+'</b><div style="font-size:12px;color:#64748b">'+esc(r.osoite||"")+'</div></td>'+
      '<td style="text-align:center">'+r.koodit_lkm+'</td>'+
      '<td style="text-align:center">'+r.asukas_lkm+'</td>'+
      '<td style="text-align:center">'+r.laite_lkm+'</td>'+
      '<td style="text-align:center">'+r.huolto_lkm+'</td>'+
      '<td style="text-align:center">'+esc(kuit)+' <span style="color:#64748b">('+esc(pct)+')</span></td>'+
      '<td style="text-align:center">'+esc(viim)+'</td>'+
    '</tr>';
  }).join("");
  if(!bodyHtml) bodyHtml='<tr><td colspan="7" style="text-align:center;color:#64748b;padding:20px">Ei kohteita palvelimella. Vie ensin koodeja (☁).</td></tr>';
  var ov=document.createElement("div");
  ov.id="covOverlay";
  ov.style.cssText="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto";
  ov.innerHTML='<div style="background:#fff;border-radius:14px;max-width:860px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.3)">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'+
      '<h2 style="margin:0;font-size:18px">📊 Kattavuusraportti</h2>'+
      '<button class="btn ghost" onclick="closeCoverage()">✕ Sulje</button></div>'+
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">'+
      '<thead><tr style="border-bottom:2px solid var(--line)">'+
        '<th style="padding:6px;text-align:left">Kohde</th><th>Koodit</th><th>Asukas</th><th>Laite</th><th>Huolto</th><th>Palovaroitin kuitattu</th><th>Viimeisin</th>'+
      '</tr></thead><tbody>'+bodyHtml+'</tbody></table></div>'+
    '<p style="font-size:12px;color:#64748b;margin-top:12px">Palovaroitin kuitattu = montako asukaskoodia on saanut vähintään yhden kuittauksen / asukaskoodien määrä. Data haetaan palvelimelta.</p>'+
  '</div>';
  ov.addEventListener("click",function(e){ if(e.target===ov) closeCoverage(); });
  document.body.appendChild(ov);
}
function closeCoverage(){ var o=document.getElementById("covOverlay"); if(o)o.remove(); }
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
for s in "/api/raportti/kattavuus" "kuitatut_asukkaat" "function showCoverage" "function renderCoverageOverlay" "📊 Kattavuus"; do
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
git commit -m "Vaihe 4: kattavuusraportti - kohdistus per kohde + palovaroitin-kuittausten kattavuus"
git push origin main
```

Railway deployaa automaattisesti.

---

## TESTAUS (näin todistat että toimii)

1. Servalossa: valitse asiakas → Koodit & kohteet. Vie muutama koodi palvelimelle (☁), mukana ainakin yksi **asukas**-koodi.
2. Paina **📊 Kattavuus** → avautuu taulukko-overlay, jossa on rivi jokaiselle palvelinkohteelle.
3. Rivillä näkyvät koodit yhteensä + jakauma (asukas/laite/huolto) ja "Palovaroitin kuitattu" -sarake (esim. 0/3 = 0 %).
4. Käy kuittaamassa palovaroitin puhelimella osoitteessa `/k/ASUKASKOODI` → avaa raportti uudelleen → kuitattu-luku ja "Viimeisin" päivittyvät.
5. Sulje overlay ✕-napista tai klikkaamalla taustaa.
