# Claude Code -prompti: Servalo → Savuks ulkoasu (punainen / valkoinen / musta + logo)

Aja tämä **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

Mitä tämä tekee (kevyt viilaus, rakenne säilyy):
1. **Uusi väripaletti** — teal/vihreä vaihtuu punainen/valkoinen/musta -linjaan. Taustа pysyy vaaleana (ei musta).
2. **Keltaiset/vaaleat taulukko-otsikot → lähes mustat**, valkoisella tekstillä. Tämä oli tunnistettavin IDR-henkinen elementti.
3. **Logo:** SERVALO → **SAVUKS** (inline-SVG-liekki punaisella + valkoinen SAVUKS-teksti). Sivun otsikko ja footer päivittyvät myös.
4. Napit, aktiiviset välilehdet, kalenterimerkinnät, kirjautumisnäkymä ja tulostettava raporttisivu siirtyvät samaan punainen/musta-teemaan.

> Huom: demodata (esim. "Servalo Oy" ja info@servalo.fi asetuksissa) jätetään ennalleen — sen voi vaihtaa sovelluksen Hallinta → Asetukset -sivulta. Näin ei tuoda oikeaa sähköpostiosoitetta koodiin.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/ilme_patch.py <<'PYEOF'
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

# ---- A: :root-paletti ----
old_a = '''    --navy:#0f2b30; --navy2:#0d9488; --orange:#0d9488; --orange-d:#0b7d72;
    --yellow:#d6efe9; --headtext:#0d5b53; --bg:#eef2f1; --card:#fff; --ink:#192227; --muted:#64748b;
    --line:#e3e8e8; --red:#e2574c; --redbg:#e2574c; --green:#16a06b;
    --shadow:0 2px 10px rgba(15,43,48,.08);'''
new_a = '''    --navy:#1a1a1c; --navy2:#d42a2a; --orange:#d42a2a; --orange-d:#b31f1f;
    --yellow:#fbeaea; --headtext:#9a1c1c; --bg:#f6f5f4; --card:#fff; --ink:#1a1a1a; --muted:#6b6b70;
    --line:#e5e3e3; --red:#e2574c; --redbg:#e2574c; --green:#16a06b;
    --shadow:0 2px 10px rgba(0,0,0,.08);'''
rep(old_a, new_a, 1)

# ---- B: meta theme-color ----
rep('<meta name="theme-color" content="#0f2b30">',
    '<meta name="theme-color" content="#1a1a1c">', 1)

# ---- C: sivun otsikko ----
rep('<title>Servalo – Huolto- ja asiakashallinta</title>',
    '<title>Savuks – Huolto- ja asiakashallinta</title>', 1)

# ---- D: taulukko-otsikot (thead) → lähes musta + valkoinen teksti ----
rep('thead th{background:var(--yellow);text-align:left;padding:13px 16px;font-size:14px;font-weight:800;color:var(--headtext)}',
    'thead th{background:#1f1f22;text-align:left;padding:13px 16px;font-size:14px;font-weight:800;color:#fff}', 1)

# ---- E: paneelin otsikko / välilehdet vaaleat teal-sävyt → vaalea punasävy ----
rep('.panel-h{background:#f1f7f6;color:var(--headtext);',
    '.panel-h{background:#f7f0f0;color:var(--headtext);', 1)
rep('.tabs button:hover{background:#f1f7f6;color:var(--headtext)}',
    '.tabs button:hover{background:#f7f0f0;color:var(--headtext)}', 1)
rep('.tabs button.active{background:#e6f4f1;color:var(--headtext);border-bottom-color:var(--orange)}',
    '.tabs button.active{background:#f9eaea;color:var(--headtext);border-bottom-color:var(--orange)}', 1)

# ---- F: kirjautumisnäkymän tausta (gradientti) ----
rep('.login{position:fixed;inset:0;background:linear-gradient(160deg,#0f2b30,#0d5b53);',
    '.login{position:fixed;inset:0;background:linear-gradient(160deg,#1a1a1c,#b31f1f);', 1)

# ---- G: rooli-merkki (asentaja) vaalea chip ----
rep('.rb-worker{background:#d6efe9;color:#0d5b53}',
    '.rb-worker{background:#fde7e7;color:#b31f1f}', 1)

# ---- H: kalenterin "tulevat" -merkinnät teal → punainen ----
rep('.calchip.future,.dot.future{background:#0d9488}',
    '.calchip.future,.dot.future{background:#d42a2a}', 1)

# ---- I: kirjautumiskortin logo (väri + nimi) ----
rep('<rect x="1" y="1" width="30" height="30" rx="9" fill="#0d9488"/>',
    '<rect x="1" y="1" width="30" height="30" rx="9" fill="#d42a2a"/>', 1)
rep('/></svg> Servalo</h1>',
    '/></svg> Savuks</h1>', 1)

# ---- J: header-logo SERVALO → SAVUKS + liekki-SVG ----
old_j = '<div class="logo"><span class="name">SERVALO<small>HUOLTOHALLINTA</small></span></div>'
new_j = '<div class="logo"><svg class="mark" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M14 2c.5 3.2-1.4 5-3 6.6C9.3 10.4 7.4 12.2 7.4 15A6.6 6.6 0 0 0 20.6 15c0-2.4-1.1-4.2-2.4-5.8-.4 1.1-1.2 1.9-2.3 2.1 1-1.7 1.1-4.2-.6-6.4C14.6 3.9 14.3 3.3 14 2Z" fill="#d42a2a"/></svg><span class="name">SAVUKS<small>HUOLTOHALLINTA</small></span></div>'
rep(old_j, new_j, 1)

# ---- K: footer-brändi ----
rep('© 2026 Servalo | Tietosuoja | Evästeasetukset',
    '© 2026 Savuks | Tietosuoja | Evästeasetukset', 1)

# ---- L: tulostettava raporttisivu (teal → punainen/musta) ----
rep('h1{color:#0d5b53;margin:0 0 4px}',
    'h1{color:#1a1a1c;margin:0 0 4px}', 1)
rep('th{background:#0d9488;color:#fff;text-align:left;padding:8px}',
    'th{background:#1f1f22;color:#fff;text-align:left;padding:8px}', 1)
rep('.box{background:#f1f7f6;border-left:4px solid #0d9488;padding:10px 14px;margin:0 0 18px;border-radius:6px}',
    '.box{background:#fbeaea;border-left:4px solid #d42a2a;padding:10px 14px;margin:0 0 18px;border-radius:6px}', 1)
rep('background:#0d9488;color:#fff;border:0;padding:10px 18px',
    'background:#d42a2a;color:#fff;border:0;padding:10px 18px', 1)

# ---- M: laitehistorian "uusi arvo" -korostus teal → vihreä ----
rep('<span style="color:#0d9488;font-weight:600">${esc(c.to)}</span>',
    '<span style="color:#16a06b;font-weight:600">${esc(c.to)}</span>', 1)

if s == orig:
    print("VIRHE: mitään ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/ilme_patch.py

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

echo "--- Uudet arvot läsnä ---"
for t in "SAVUKS" "class=\"mark\"" "#d42a2a" "background:#1f1f22"; do
  grep -q "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Vanha teal pois pääpaletista ---"
if grep -q "#0d9488; --orange:#0d9488" servalo.html; then echo "VIRHE: vanha teal-paletti jäi."; exit 1; else echo "Paletti vaihdettu."; fi

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
git commit -m "Savuks: uusi ilme (punainen/valkoinen/musta), tummat taulukko-otsikot, SAVUKS-logo"
git push origin main
echo "VALMIS."
```

---

## Muutama huomio

- **Logo on inline-SVG** (punainen liekki + valkoinen SAVUKS), joten se skaalautuu terävänä eikä vaadi erillistä kuvatiedostoa. Jos haluat käyttää täsmälleen lähettämääsi PNG-logoa, pudota tiedosto repoon (esim. `assets/savuks-logo.png`) ja sano, niin teen patchin joka käyttää sitä `<img>`-elementtinä.
- **Taulukko-otsikot** ovat nyt lähes mustat (#1f1f22) valkoisella tekstillä — tämä poistaa selkeimmän IDR-henkisen elementin.
- **Tausta pysyy vaaleana** (#f6f5f4) toiveesi mukaan, ei mustaa. Punainen on pääkorostusväri (napit, aktiiviset välilehdet, linkit), musta otsikoissa ja logossa.
- Demodatan "Servalo Oy" / info@servalo.fi jätettiin ennalleen tarkoituksella (vaihdettavissa sovelluksessa), jottei koodiin tuoda oikeaa yhteystietoa.

Aja Servalo-repon juuressa Claude Codella. En pushaa mitään itse.
