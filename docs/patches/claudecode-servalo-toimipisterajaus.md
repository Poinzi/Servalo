# Claude Code -prompti: toimipisterajaus henkilöstölle (käyttäjä näkee vain omat kohteensa)

Aja **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

## Mitä tämä tekee
Lisää käyttäjälle valinnaisen **toimipisterajauksen** (`u.locs`). Kun käyttäjälle on
valittu yksi tai useampi kohde (yhtiö/kiinteistö/toimipiste), hän näkee **vain niiden
alaisuudessa** olevat laitteet — kaikkialla: laitelista, raportit, kalenteri ja työnjako.

- **Tyhjä valinta = kaikki kohteet** (nykyinen toiminta säilyy — vanhat käyttäjät eivät
  muutu).
- **Pääkäyttäjää ei rajata** koskaan (näkee aina kaikki).
- Rajaus lisätään yhteen keskitettyyn kohtaan (`devicesInScope()`), joka syöttää jo nyt
  laitelistan, kaikki raportit, QR-tarrat ja kalenterin. Lisäksi työnjako-näkymä
  rajataan erikseen.
- Käyttäjän muokkauslomakkeeseen tulee **kohdevalinta** (valintaruudut kiinteistöistä ja
  toimipisteistä).

> Huom: sivupalkin sijaintipuu näyttää edelleen kaikki solmut, mutta rajatulle
> käyttäjälle vieraan kohteen valinta näyttää tyhjän listan (laitteet on rajattu).
> Yksittäisen laitteen suora avaus (QR-skannaus / syvälinkki) ei ole tämän patchin
> piirissä — halutessasi lisätään erikseen.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/toimipiste_patch.py <<'PYEOF'
import io, sys

f = "servalo.html"
s = io.open(f, encoding="utf-8").read()
orig = s

def rep(old, new, n):
    global s
    c = s.count(old)
    if c != n:
        print("VIRHE: ankkuria loytyi %d kpl (odotettu %d):\n  %s" % (c, n, old[:80]))
        sys.exit(1)
    s = s.replace(old, new)

# 1) HTML: kohdevalinta kayttajalomakkeeseen
rep('''      <label class="rtoggle" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="uActiveF" checked> Aktiivinen (voi kirjautua)</label>
      <div id="uCertsWrap"></div>''',
    '''      <label class="rtoggle" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="uActiveF" checked> Aktiivinen (voi kirjautua)</label>
      <div class="field"><label>Toimipisterajaus</label><div id="uLocsWrap" style="max-height:160px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:8px"></div><p class="hint">Valitse kohteet joihin k\\u00e4ytt\\u00e4j\\u00e4 p\\u00e4\\u00e4see. Tyhj\\u00e4 valinta = kaikki kohteet. P\\u00e4\\u00e4k\\u00e4ytt\\u00e4j\\u00e4\\u00e4 ei rajata.</p></div>
      <div id="uCertsWrap"></div>''', 1)

# 2) apufunktiot descendants():n peraan
rep('function descendants(id){if(!id)return null;const set=new Set([id]);let added=true;while(added){added=false;db.locs.forEach(l=>{if(l.parent&&set.has(l.parent)&&!set.has(l.id)){set.add(l.id);added=true;}});}return set;}',
    '''function descendants(id){if(!id)return null;const set=new Set([id]);let added=true;while(added){added=false;db.locs.forEach(l=>{if(l.parent&&set.has(l.parent)&&!set.has(l.id)){set.add(l.id);added=true;}});}return set;}
function userLocSet(){const u=currentUser;if(!u||u.role==="admin")return null;const ls=(u.locs||[]).filter(Boolean);if(!ls.length)return null;const set=new Set();ls.forEach(function(id){const d=descendants(id);if(d)d.forEach(function(x){set.add(x);});});return set.size?set:null;}
function inUserScope(d){const us=userLocSet();return !us||us.has(d.locId);}
function renderUserLocs(sel){const w=document.getElementById("uLocsWrap");if(!w)return;const chosen=new Set(sel||[]);const nodes=db.locs.filter(function(l){return l.type!=="company";});w.innerHTML=nodes.map(function(l){const depth=l.type==="site"?1:0;return '<label style="display:flex;align-items:center;gap:8px;padding:2px 0;margin-left:'+(depth*16)+'px"><input type="checkbox" value="'+l.id+'"'+(chosen.has(l.id)?' checked':'')+'> '+esc(l.name)+'</label>';}).join("")||'<span class="hint">Ei kohteita.</span>';}''', 1)

# 3) devicesInScope(): lisaa kayttajarajaus
rep('''function devicesInScope(){
  let list=db.devices.filter(d=>!d.deleted);
  if(selLoc){const set=descendants(selLoc);list=list.filter(d=>set.has(d.locId)||set.has(locById(d.locId)?.parent));}
  return list;
}''',
    '''function devicesInScope(){
  let list=db.devices.filter(d=>!d.deleted);
  const us=userLocSet();
  if(us)list=list.filter(d=>us.has(d.locId));
  if(selLoc){const set=descendants(selLoc);list=list.filter(d=>set.has(d.locId)||set.has(locById(d.locId)?.parent));}
  return list;
}''', 1)

# 4) Tyonjako: laitelistan rajaus
rep('''let list=db.devices.filter(d=>!d.deleted)
    .filter(d=>(d.tag+d.make+d.target+siteName(d.locId)).toLowerCase().includes(q));''',
    '''let list=db.devices.filter(d=>!d.deleted&&inUserScope(d))
    .filter(d=>(d.tag+d.make+d.target+siteName(d.locId)).toLowerCase().includes(q));''', 1)

# 5) Tyonjako: laskurien rajaus
rep('db.devices.filter(d=>!d.deleted).forEach(d=>{if(d.assignedTo&&counts[d.assignedTo]!=null)counts[d.assignedTo]++;else un++;});',
    'db.devices.filter(d=>!d.deleted&&inUserScope(d)).forEach(d=>{if(d.assignedTo&&counts[d.assignedTo]!=null)counts[d.assignedTo]++;else un++;});', 1)

# 6) editUser: tayta kohdevalinta
rep('''  editCerts=u&&u.certs?JSON.parse(JSON.stringify(u.certs)):[];
  renderCertList();
  document.getElementById("userOverlay").classList.add("show");''',
    '''  editCerts=u&&u.certs?JSON.parse(JSON.stringify(u.certs)):[];
  renderCertList();
  renderUserLocs(u?u.locs:[]);
  document.getElementById("userOverlay").classList.add("show");''', 1)

# 7) saveUser: tallenna valitut kohteet
rep('  const data={name,role:g("uRoleF"),email:g("uEmailF").trim(),active:document.getElementById("uActiveF").checked,certs:editCerts.slice()};',
    '  const locs=Array.from(document.querySelectorAll("#uLocsWrap input:checked")).map(function(x){return x.value;});\n  const data={name,role:g("uRoleF"),email:g("uEmailF").trim(),active:document.getElementById("uActiveF").checked,certs:editCerts.slice(),locs};', 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/toimipiste_patch.py

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

echo "--- Uudet rakenteet läsnä ---"
for t in "function userLocSet" "function inUserScope" "function renderUserLocs" "uLocsWrap" "inUserScope(d)"; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Rajaus kytketty devicesInScopeen ---"
grep -qF "const us=userLocSet();" servalo.html && echo "OK: devicesInScope-rajaus" || { echo "PUUTTUU"; exit 1; }

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Toimipisterajaus henkilostolle: u.locs + scope-suodatus (lista/raportit/kalenteri/tyonjako)"
git push origin main
echo "VALMIS."
```

---

## Huom
- Rajaus on **valinnainen** ja **taaksepäin yhteensopiva**: käyttäjät joilla ei ole
  valittuja kohteita näkevät kaiken kuten ennen.
- Kohteen valinta kattaa sen **kaikki alakohteet** (esim. kiinteistön valinta → kaikki
  sen toimipisteet ja niiden laitteet).
- Yhdistyy oikeusmatriisiin: rooli määrää *mitä* saa tehdä, toimipisterajaus *missä*.
