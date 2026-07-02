# Vaihe 0 — palovaroitin-kuittaus Postgresiin (aja tämä Claude Codella)

Postgres on jo lisätty Railwayhin ja `DATABASE_URL` toimii (`[db] initSchema: ok` näkyy logeissa).
Tämä prompti kytkee palovaroitin-kuittauksen tietokantaan.

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

---

### MUUTOS 1 — `api.js`: julkinen reitti viimeisimmän kuittauksen lukuun

**FIND:**
```
      return sendJson(res, 200, { ok: true, id: ins.rows[0].id, aikaleima: ins.rows[0].aikaleima });
    }

    // Kirjautuneiden reitit alla
```

**REPLACE:**
```
      return sendJson(res, 200, { ok: true, id: ins.rows[0].id, aikaleima: ins.rows[0].aikaleima });
    }

    // GET /api/kuittaukset/:koodi (julkinen: viimeisin palovaroitin-kuittaus + lkm)
    if (method === "GET" && p.startsWith("/api/kuittaukset/")) {
      const koodi = decodeURIComponent(p.slice("/api/kuittaukset/".length)).trim().toUpperCase();
      if (!koodi) return sendJson(res, 400, { error: "empty koodi" });
      const q = await db.query(
        "SELECT count(*)::int AS lkm, max(aikaleima) AS viimeisin FROM kuittaukset WHERE koodi=$1 AND tyyppi='palovaroitin'",
        [koodi]
      );
      return sendJson(res, 200, { koodi, lkm: q.rows[0].lkm, viimeisin: q.rows[0].viimeisin });
    }

    // Kirjautuneiden reitit alla
```

---

### MUUTOS 2 — `db.js`: demo-siemen (yksi fiktiivinen kohde + koodi 82FA66)

Luodaan yksi fiktiivinen kohde ja asukaskoodi **vain jos taulu on tyhjä**, jotta kuittausta voi testata heti.

**FIND:**
```
  const client = await pool.connect();
  try {
    await client.query(sql);
    return { ok: true };
  } finally {
    client.release();
  }
```

**REPLACE:**
```
  const client = await pool.connect();
  try {
    await client.query(sql);
    // Demo-siemen: yksi fiktiivinen kohde + asukaskoodi, jotta kuittausta voi testata heti.
    const cnt = await client.query("SELECT count(*)::int AS n FROM koodit");
    if (cnt.rows[0].n === 0) {
      const k = await client.query(
        "INSERT INTO kohteet (nimi, osoite) VALUES ($1,$2) RETURNING id",
        ["Asunto Oy Esimerkkitie 4", "Esimerkkitie 4, 00100 Helsinki"]
      );
      await client.query(
        "INSERT INTO koodit (koodi, kohde_id, nakymatyyppi, data, kohdistettu_pvm, kohdistaja) VALUES ($1,$2,'asukas',$3::jsonb,now(),'seed') ON CONFLICT (koodi) DO NOTHING",
        ["82FA66", k.rows[0].id, JSON.stringify({ apt: "A12", floor: "1. krs" })]
      );
    }
    return { ok: true };
  } finally {
    client.release();
  }
```

---

### MUUTOS 3 — `ohje24.html`: nappi lähettää kuittauksen palvelimelle

**FIND:**
```
function markSmoke(){
  var b=el("pvBtn"), n=el("pvNote");
  b.disabled=true; b.textContent="✓ Kuitattu tänään";
  var d=new Date(); var s=d.getDate()+"."+(d.getMonth()+1)+"."+d.getFullYear();
  n.style.display="block";
  n.innerHTML='Kiitos! Merkitty '+esc(s)+'. Tämä on muistutuskuittaus — ei virallinen tarkastus.';
  toast("Palovaroitin kuitattu");
}
```

**REPLACE:**
```
function markSmoke(){
  var b=el("pvBtn"), n=el("pvNote");
  b.disabled=true; b.textContent="✓ Kuitattu tänään";
  var d=new Date(); var s=d.getDate()+"."+(d.getMonth()+1)+"."+d.getFullYear();
  n.style.display="block";
  n.innerHTML='Kiitos! Merkitty '+esc(s)+'. Tämä on muistutuskuittaus — ei virallinen tarkastus.';
  toast("Palovaroitin kuitattu");
  // Tallenna kuittaus palvelimelle. Jos DB:tä ei ole, jää paikalliseksi (fallback).
  try{
    fetch("/api/kuittaus",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({koodi:currentCode,tyyppi:"palovaroitin"})})
      .then(function(r){return r.ok?r.json():null;})
      .then(function(res){ if(res&&res.aikaleima){ loadSmokeStatus(currentCode); } })
      .catch(function(){});
  }catch(e){}
}
function loadSmokeStatus(code){
  var box=el("pvStatus"); if(!box) return;
  fetch("/api/kuittaukset/"+encodeURIComponent(code))
    .then(function(r){return r.ok?r.json():null;})
    .then(function(res){
      if(res&&res.viimeisin){
        var d=new Date(res.viimeisin);
        var s=d.getDate()+"."+(d.getMonth()+1)+"."+d.getFullYear();
        box.style.display="block";
        box.innerHTML='🛰️ Viimeksi kuitattu '+esc(s)+' — tallennettu palvelimelle, näkyy kaikille laitteille. Yhteensä '+res.lkm+' kuittausta.';
      }
    })
    .catch(function(){});
}
```

---

### MUUTOS 4 — `ohje24.html`: lisää tilarivi asukasnäkymään

**FIND:**
```
      '<button class="btn primary" id="pvBtn" onclick="markSmoke()">✓ Palovaroitin testattu ja kunnossa</button>'+
      '<div class="note" id="pvNote" style="display:none"></div>'+
    '</div>'+
```

**REPLACE:**
```
      '<button class="btn primary" id="pvBtn" onclick="markSmoke()">✓ Palovaroitin testattu ja kunnossa</button>'+
      '<div class="note" id="pvNote" style="display:none"></div>'+
      '<div class="note" id="pvStatus" style="display:none;margin-top:8px"></div>'+
    '</div>'+
```

---

### MUUTOS 5 — `ohje24.html`: hae palvelintila kun asukasnäkymä avautuu

**FIND:**
```
  el("app").innerHTML=html;
  document.querySelectorAll(".chip").forEach(function(ch){
    ch.classList.toggle("active", ch.getAttribute("data-code")===code);
  });
  window.scrollTo(0,0);
```

**REPLACE:**
```
  el("app").innerHTML=html;
  if(c && c.type==="asukas"){ try{ loadSmokeStatus(code); }catch(e){} }
  document.querySelectorAll(".chip").forEach(function(ch){
    ch.classList.toggle("active", ch.getAttribute("data-code")===code);
  });
  window.scrollTo(0,0);
```

---

## VALIDOINTI (aja ennen committia)

```bash
cd ~/Desktop/Servalo

# 1) palvelinkoodin syntaksi
node --check server.js && node --check api.js && node --check db.js && echo "NODE OK"

# 2) ohje24.html JS-syntaksi
node -e '
const fs=require("fs");
const h=fs.readFileSync("ohje24.html","utf8");
const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
new Function(s);
console.log("OHJE24 JS OK");
'

# 3) uudet palaset löytyvät
for s in "/api/kuittaukset/" "function loadSmokeStatus" "pvStatus" "Demo-siemen"; do
  grep -rq "$s" ohje24.html api.js db.js && echo "OK: $s" || { echo "PUUTTUU: $s"; exit 1; }
done

# 4) kielletyt merkkijonot
if grep -rnE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" ohje24.html api.js db.js server.js; then
  echo "VAROITUS: tarkista osumat"; else echo "Ei kiellettyjä merkkijonoja"; fi
```

Kaikki `OK:` ja molemmat `... JS OK` → jatka. Muuten pysähdy.

---

## COMMIT & PUSH

```bash
cd ~/Desktop/Servalo
rm -f .git/index.lock
git add -A
git commit -m "Vaihe 0: palovaroitin-kuittaus tallentuu Postgresiin + näkyy kaikille laitteille"
git push origin main
```

Railway deployaa automaattisesti. Odota että logeissa lukee `[db] initSchema: ok`.

---

## TESTAUS (näin todistat että toimii)

1. Avaa puhelimella `https://servalo-production-8fdd.up.railway.app/k/82FA66` → asukasnäkymä.
2. Paina **✓ Palovaroitin testattu ja kunnossa**.
3. Hetken päästä ilmestyy rivi: *"🛰️ Viimeksi kuitattu … näkyy kaikille laitteille. Yhteensä 1 kuittausta."*
4. **Avaa sama osoite toisella laitteella tai incognitossa** → sama rivi näkyy heti. Tämä todistaa että tieto tuli palvelimelta.
5. Paina uudelleen toisella laitteella → laskuri kasvaa (2 kuittausta). Data on yhteinen.
