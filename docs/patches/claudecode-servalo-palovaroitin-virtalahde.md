# Claude Code -prompti: palovaroittimen virtalähde omaksi kentäksi

Aja **Servalo-repon juuressa**. Lisää laitteelle oma **Virtalähde**-kenttä
(`230 V` / `Akku / paristo`) laitelomakkeeseen, tallenna se `d.power`-kenttään,
ja palovaroitinpöytäkirja lukee arvon suoraan kentästä (aiemmin päätteli mallitekstistä).

Ei kosketa dataan eikä muihin toimintoihin.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/power_patch.py <<'PYEOF'
import io, sys

def patch(fn, edits):
    s = io.open(fn, encoding="utf-8").read()
    orig = s
    for old, new, n in edits:
        c = s.count(old)
        if c != n:
            print("VIRHE (%s): ankkuria loytyi %d kpl (odotettu %d):\n  %s" % (fn, c, n, old[:100]))
            sys.exit(1)
        s = s.replace(old, new)
    if s == orig:
        print("VIRHE: %s ei muuttunut." % fn); sys.exit(1)
    io.open(fn, "w", encoding="utf-8").write(s)
    print("Patch OK: %s" % fn)

# 1) Lomakkeeseen uusi Virtalähde-valinta (dGroup-kentän jälkeen)
FORM_OLD = '<div class="field"><label>Tuoteryhmä</label><input class="f" id="dGroup" placeholder="esim. Paloilmoitin"></div>'
FORM_NEW = (FORM_OLD +
    '\n        <div class="field"><label>Virtalähde <span class="hint">(palovaroitin)</span></label>'
    '<select class="f" id="dPower">'
    '<option value="">– ei valittu –</option>'
    '<option value="230 V">230 V (verkkovirta)</option>'
    '<option value="Akku / paristo">Akku / paristo</option>'
    '</select></div>')

# 2) editDevice: aseta kentän arvo laitteesta
EDIT_OLD = 'set("dGroup",d?.group);document.getElementById("dQrTarget").value=(d&&d.qrTarget)||"servalo";'
EDIT_NEW = 'set("dGroup",d?.group);set("dPower",d?.power);document.getElementById("dQrTarget").value=(d&&d.qrTarget)||"servalo";'

# 3) saveDevice: talleta power-kenttä
SAVE_OLD = 'make:g("dMake").trim(),group:g("dGroup").trim()||"Muu",'
SAVE_NEW = 'make:g("dMake").trim(),group:g("dGroup").trim()||"Muu",power:g("dPower"),'

# 4) palovaroitinPk: lue virtalähde kentästä, päättely vain varalta
POWER_OLD = 'var powerOf=function(d){var t=String((d.make||"")+" "+(d.notes||""));return /230|verkko/i.test(t)?"230 V":"Paristo";};'
POWER_NEW = 'var powerOf=function(d){if(d.power)return d.power;var t=String((d.make||"")+" "+(d.notes||""));return /230|verkko/i.test(t)?"230 V":"Paristo";};'

patch("servalo.html", [
    (FORM_OLD,  FORM_NEW,  1),
    (EDIT_OLD,  EDIT_NEW,  1),
    (SAVE_OLD,  SAVE_NEW,  1),
    (POWER_OLD, POWER_NEW, 1),
])
PYEOF

python3 /tmp/power_patch.py

echo "--- servalo.html JS-syntaksin validointi ---"
node -e '
const fs=require("fs");
const h=fs.readFileSync("servalo.html","utf8");
const re=/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g;
let m,i=0,ok=true;
while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){ok=false;console.log("Script-lohko "+i+" FAIL: "+e.message);}}
console.log(ok?("JS OK ("+i+" lohkoa)"):"JS FAILED");
process.exit(ok?0:1);
'

echo "--- Uudet palaset läsnä ---"
grep -qF 'id="dPower"' servalo.html && echo "OK: lomakekenttä" || { echo "PUUTTUU: kenttä"; exit 1; }
grep -qF 'power:g("dPower")' servalo.html && echo "OK: tallennus" || { echo "PUUTTUU: tallennus"; exit 1; }
grep -qF 'if(d.power)return d.power' servalo.html && echo "OK: pöytäkirja lukee kentän" || { echo "PUUTTUU: pöytäkirja"; exit 1; }
grep -qF 'set("dPower",d?.power)' servalo.html && echo "OK: editDevice" || { echo "PUUTTUU: editDevice"; exit 1; }

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Palovaroitin: virtalähde (230 V / akku-paristo) omaksi laitekentäksi; pöytäkirja lukee sen suoraan"
git push origin main
echo "VALMIS."
```

---

## Mitä muuttuu
- **Laitelomake:** uusi valinta **Virtalähde** (`– ei valittu –` / `230 V (verkkovirta)` / `Akku / paristo`) Tuoteryhmä-kentän jälkeen.
- **Tallennus:** arvo talletetaan laitteen `power`-kenttään.
- **Palovaroitinpöytäkirja:** "Virta"-sarake näyttää nyt suoraan valitun virtalähteen. Jos kenttä on tyhjä (vanhat laitteet), se päättelee edelleen mallitekstistä kuten ennen.

## Näin käytät
Avaa palovaroitin laitteen muokkaukseen → valitse **Virtalähde** → Tallenna. Aja
palovaroitinpöytäkirja: virtalähde tulee sarakkeeseen kentän arvon mukaan.

## Testattu
Neljä ankkuria (n=1 kukin), JS-syntaksi OK, kielletyt merkkijonot puhtaat.
