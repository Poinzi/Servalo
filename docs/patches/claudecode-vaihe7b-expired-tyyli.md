# Vaihe 7b — `expired`-tilan väri /k-sivulle (pieni CSS-korjaus)

**Edellytys:** Vaihe 7 ajettu.

Vaihe 7:n tila-skeema käyttää arvoa `state="expired"`. `ohje24.html`:n `statusBlock` asettaa tämän arvon suoraan CSS-luokaksi (`<span class="dot expired">` ja `<span class="pill expired">`), mutta CSS määrittää vain luokat `ok` / `warn` / `bad`. Siksi label näkyy oikein ("Vanhentunut"), mutta pillistä ja pisteestä puuttuu punainen taustaväri.

Korjaus: lisää `expired`-luokka samoilla punaisilla väreillä kuin `bad`. Vain **yksi tiedosto**: `ohje24.html`.

Työskentele kansiossa `~/Desktop/Servalo`. Tee TÄSMÄLLEEN nämä FIND/REPLACE-muutokset.
Jos jokin FIND ei täsmää, PYSÄHDY ja raportoi — älä arvaa.

---

### V7b-1 — `ohje24.html`: `.pill.expired` ja `.dot.expired`

**FIND:**
```
  .pill.bad{background:var(--badbg); color:var(--bad)}
  .dot{width:9px;height:9px;border-radius:50%;flex:none}
  .dot.ok{background:var(--ok)} .dot.warn{background:var(--warn)} .dot.bad{background:var(--bad)}
```

**REPLACE:**
```
  .pill.bad{background:var(--badbg); color:var(--bad)}
  .pill.expired{background:var(--badbg); color:var(--bad)}
  .dot{width:9px;height:9px;border-radius:50%;flex:none}
  .dot.ok{background:var(--ok)} .dot.warn{background:var(--warn)} .dot.bad{background:var(--bad)}
  .dot.expired{background:var(--bad)}
```

---

## VALIDOINTI (aja ennen committia)

```bash
cd ~/Desktop/Servalo

# 1) HTML-tiedoston JS-syntaksi ennallaan
node -e '
const fs=require("fs");
const h=fs.readFileSync("ohje24.html","utf8");
const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
new Function(s);
console.log("ohje24.html JS OK");
' || exit 1

# 2) uudet CSS-säännöt löytyvät
for s in ".pill.expired" ".dot.expired"; do
  grep -q "$s" ohje24.html && echo "OK: $s" || { echo "PUUTTUU: $s"; exit 1; }
done

# 3) kielletyt merkkijonot
if grep -rnE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" ohje24.html; then
  echo "VAROITUS: tarkista osumat"; else echo "Ei kiellettyjä merkkijonoja"; fi
```

Kaikki `OK:` ja `ohje24.html JS OK` → jatka. Muuten pysähdy.

---

## COMMIT & PUSH

```bash
cd ~/Desktop/Servalo
rm -f .git/index.lock
git add -A
git commit -m "Vaihe 7b: expired-tilan punainen vaeri /k-asukas- ja aulanaekymaessae"
git push origin main
```

Railway deployaa automaattisesti.

---

## TESTAUS

1. Servalossa lisää tilarivi tilalla **Vanhentunut** → 💾 Tallenna palvelimelle.
2. Avaa `/k/ASUKASKOODI` → rivin pilli on nyt punainen (aiemmin väritön), label "Vanhentunut".
