# Vaihe 3 — kaksisuuntainen synkka (Servalo hakee koodit palvelimelta + poisto synkkaa)

**Edellytys:** Vaihe 1 ja Vaihe 2 ajettu. servalo.html sisältää `apiHeaders`, `ensureKohde`, `pushCode`, `syncAllCodes`, `custById`, ja koodeilla on `type`/`pin`/`synced`-kentät.

Tähän asti synkka oli yksisuuntainen: Servalo **työnsi** koodit palvelimelle. Nyt Servalo osaa myös **hakea** ne palvelimelta (`GET /api/kohteet/:id`), joten toisella laitteella tehdyt kohdistukset näkyvät — ja paikallinen poisto vapauttaa koodin myös palvelimella (`DELETE /api/kohdista/:koodi`). Palvelinreitit ovat jo olemassa; tämä patch on pelkkää `servalo.html`-muutosta.

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

---

### V3-1 — `servalo.html`: lisää `serverToLocal()` + `pullCodes()` (nouto + merge)

`syncAllCodes` päättyy näihin riveihin. Lisätään uudet funktiot heti sen perään.

**FIND:**
```
    alert("Palvelimelle viety: "+ok+(fail?(" · epäonnistui: "+fail):"")+".\nJokainen viety koodi toimii nyt osoitteessa /k/KOODI.");
  })();
}
```

**REPLACE:**
```
    alert("Palvelimelle viety: "+ok+(fail?(" · epäonnistui: "+fail):"")+".\nJokainen viety koodi toimii nyt osoitteessa /k/KOODI.");
  })();
}
// Palvelimen data-muoto -> paikalliset kentät (käänteinen pushCode:lle)
function serverToLocal(t,d){
  d=d||{};
  if(t==="laite")  return {apt:d.device||"",note:d.loc||"",pin:""};
  if(t==="huolto") return {apt:d.room||"",note:d.loc||"",pin:d.pin||""};
  if(t==="aula")   return {apt:"",note:""};
  return {apt:d.apt||"",note:d.note||"",pin:""};
}
// Hae kohteen koodit palvelimelta ja yhdistä paikalliseen listaan.
// Palvelin on auktoriteetti niille koodeille jotka siellä ovat; paikalliset
// (vielä viemättömät) koodit jäävät koskematta.
function pullCodes(cid){
  const c=custById(cid); if(!c){return;}
  if(!c.kohdeId){ alert("Tälle asiakkaalle ei ole vielä palvelinkohdetta. Vie ensin koodeja palvelimelle (☁)."); return; }
  (async function(){
    let r;
    try{ r=await fetch("/api/kohteet/"+encodeURIComponent(c.kohdeId),{headers:apiHeaders()}); }
    catch(e){ alert("Palvelimeen ei saatu yhteyttä."); return; }
    if(!r.ok){ alert("Haku epäonnistui ("+r.status+")."); return; }
    const j=await r.json();
    const rows=(j&&j.koodit)||[];
    let added=0,updated=0;
    for(const sc of rows){
      const code=(sc.koodi||"").trim(); if(!code)continue;
      const t=sc.nakymatyyppi||"asukas";
      const m=serverToLocal(t, sc.data);
      let x=(db.codes||[]).find(o=>o.customerId===cid && (o.code||"").toUpperCase()===code.toUpperCase());
      if(x){ x.code=code; x.type=t; x.apt=m.apt; x.note=m.note; x.pin=m.pin; x.synced=true; updated++; }
      else { db.codes.push({id:uid(),customerId:cid,code:code,apt:m.apt,note:m.note,type:t,pin:m.pin,images:[],synced:true,created:today()}); added++; }
    }
    save(); refreshCodes();
    alert("Palvelimelta haettu: "+added+" uutta, "+updated+" päivitetty.");
  })();
}
```

---

### V3-2 — `servalo.html`: "⟳ Hae palvelimelta" -nappi työkaluriviin

**FIND:**
```
        <button class="btn ghost" type="button" onclick="syncAllCodes('${c.id}')">☁ Vie palvelimelle</button>
```

**REPLACE:**
```
        <button class="btn ghost" type="button" onclick="syncAllCodes('${c.id}')">☁ Vie palvelimelle</button>
        <button class="btn ghost" type="button" onclick="pullCodes('${c.id}')">⟳ Hae palvelimelta</button>
```

---

### V3-3 — `servalo.html`: poisto vapauttaa koodin myös palvelimella

**FIND:**
```
function deleteCode(id){
  if(!confirm("Poistetaanko koodi?"))return;
  db.codes=(db.codes||[]).filter(c=>c.id!==id);
  save();refreshCodes();
}
```

**REPLACE:**
```
function deleteCode(id){
  const x=(db.codes||[]).find(c=>c.id===id);
  if(!confirm("Poistetaanko koodi?"))return;
  db.codes=(db.codes||[]).filter(c=>c.id!==id);
  save();refreshCodes();
  if(x && x.synced){
    fetch("/api/kohdista/"+encodeURIComponent(x.code),{method:"DELETE",headers:apiHeaders()}).catch(function(){});
  }
}
```

---

## VALIDOINTI (aja ennen committia)

```bash
cd ~/Desktop/Servalo

# 1) palvelinkoodin syntaksi (ei muuttunut, mutta varmistetaan ettei mitään rikkoutunut)
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
for s in "function pullCodes" "function serverToLocal" "Hae palvelimelta" 'method:"DELETE"' "/api/kohteet/"; do
  grep -rq "$s" servalo.html && echo "OK: $s" || { echo "PUUTTUU: $s"; exit 1; }
done

# 4) kielletyt merkkijonot
if grep -rnE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html ohje24.html api.js db.js server.js; then
  echo "VAROITUS: tarkista osumat"; else echo "Ei kiellettyjä merkkijonoja"; fi
```

Kaikki `OK:` ja `servalo.html JS OK` → jatka. Muuten pysähdy.

---

## COMMIT & PUSH

```bash
cd ~/Desktop/Servalo
rm -f .git/index.lock
git add -A
git commit -m "Vaihe 3: kaksisuuntainen synkka - hae koodit palvelimelta + poisto vapauttaa palvelimella"
git push origin main
```

Railway deployaa automaattisesti.

---

## TESTAUS (näin todistat että toimii)

1. **Laite A:** valitse asiakas → Koodit & kohteet. Lisää pari koodia ja paina **☁ Vie palvelimelle**.
2. **Laite B** (tai toinen selain / incognito, sama Servalo-URL, kirjaudu sisään): valitse **sama asiakas** → paina **⟳ Hae palvelimelta**.
   - Huom: asiakkaan täytyy olla sama tietue (`kohdeId` tallessa). Jos laite B:llä on tyhjä paikallistila, tee ensin yksi vienti laite B:ltäkin niin `kohdeId` syntyy — tai testaa samalla laitteella kahdessa vaiheessa.
3. Koodit ilmestyvät listaan ☁-merkillä ja oikeilla tyypeillä. Alert kertoo "X uutta, Y päivitetty".
4. Muuta koodin tietoja laite A:lla (✎) → **⟳ Hae palvelimelta** laite B:llä → muutos päivittyy.
5. **Poista** synkattu koodi (🗑) → avaa `https://servalo-production-8fdd.up.railway.app/k/KOODI` → sivu näyttää "Koodi ei ole vielä käytössä" (vapautettu palvelimella).
