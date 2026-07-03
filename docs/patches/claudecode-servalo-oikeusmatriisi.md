# Claude Code -prompti: muokattava oikeusmatriisi (Käyttäjät & asetukset → Oikeudet)

Aja **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

## Mitä tämä tekee
Nyt roolien oikeudet ovat kovakoodattuja `can()`-funktioon. Tämä patch tekee niistä
**sovelluksesta säädettäviä**:

- Lisää `db.perms`-rakenteen, joka tallentaa roolikohtaiset oikeudet localStorageen.
  Oletusarvot vastaavat **tarkalleen** nykyistä toimintaa (ei muutu käytös ennen kuin
  itse säädät).
- Muuttaa `can()`-funktion lukemaan oikeudet `db.perms`-rakenteesta. **Pääkäyttäjällä
  on aina kaikki oikeudet** (ei voi lukita itseään ulos).
- Lisää *Käyttäjät & asetukset* -näkymään uuden **🔐 Oikeudet** -välilehden, jossa
  kunkin roolin (Työnjohtaja / Asentaja / Asiakas) oikeudet säädetään valintaruuduilla.
  Tallennus päivittää heti nykyisen käyttäjän navigaation.

Säädettävät oikeudet: Laitteiden katselu, Laitteiden muokkaus, Huoltojen ja tarkastusten
kuittaus, Omat työt, Työnjako, Asiakkaat, Raportit, Laskutus, Asiakasportaali.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/oikeus_patch.py <<'PYEOF'
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

# 1) admin-valilehden nappi
rep('        <button data-atab="settings">⚙ Asetukset</button>',
    '        <button data-atab="settings">⚙ Asetukset</button>\n        <button data-atab="perms">\U0001F510 Oikeudet</button>', 1)

# 2) init: varmista db.perms
rep('if(!db){db=seed();save();}',
    'if(!db){db=seed();save();}\nensurePerms();', 1)

# 3) korvaa can() + lisaa oikeusinfra
old_can = '''function can(p){
  const r=role();
  if(r==="admin")return true;
  if(r==="supervisor")return ["mywork","dispatch","customers","reports","devices_edit","view","billing"].includes(p);
  if(r==="worker")return ["mywork","view","complete","devices_edit"].includes(p);
  if(r==="customer")return ["portal"].includes(p);
  return false;
}'''

new_can = '''const PERM_DEFS=[["view","Laitteiden katselu"],["devices_edit","Laitteiden muokkaus"],["complete","Huoltojen ja tarkastusten kuittaus"],["mywork","Omat ty\\u00f6t"],["dispatch","Ty\\u00f6njako"],["customers","Asiakkaat"],["reports","Raportit"],["billing","Laskutus"],["portal","Asiakasportaali (oma kohde)"]];
const PERM_ROLES=[["supervisor","Ty\\u00f6njohtaja"],["worker","Asentaja"],["customer","Asiakas"]];
function defaultPerms(){return {supervisor:{view:true,devices_edit:true,mywork:true,dispatch:true,customers:true,reports:true,billing:true},worker:{view:true,devices_edit:true,complete:true,mywork:true},customer:{portal:true}};}
function ensurePerms(){if(!db.perms||typeof db.perms!=="object")db.perms=defaultPerms();const d=defaultPerms();Object.keys(d).forEach(function(rl){if(!db.perms[rl])db.perms[rl]=d[rl];});}
function can(p){const r=role();if(!r)return false;if(r==="admin")return true;const pm=(db.perms&&db.perms[r])||{};return !!pm[p];}
function savePerms(){PERM_ROLES.forEach(function(r){db.perms[r[0]]=db.perms[r[0]]||{};PERM_DEFS.forEach(function(pd){const el=document.getElementById("perm_"+r[0]+"_"+pd[0]);db.perms[r[0]][pd[0]]=!!(el&&el.checked);});});save();if(currentUser)applyRole();alert("Oikeudet tallennettu.");}'''

rep(old_can, new_can, 1)

# 4) renderAdmin: lisaa "perms"-haara ennen settings-haaraa
old_branch = '''  } else {
    const c=db.settings.company;'''

new_branch = '''  } else if(adminTab==="perms"){
    const rl=PERM_ROLES;
    const head='<th style="text-align:left">Oikeus</th>'+rl.map(function(r){return '<th style="text-align:center">'+esc(r[1])+'</th>';}).join("");
    const prows=PERM_DEFS.map(function(pd){
      const cells=rl.map(function(r){const on=!!(db.perms[r[0]]&&db.perms[r[0]][pd[0]]);return '<td style="text-align:center"><input type="checkbox" id="perm_'+r[0]+'_'+pd[0]+'"'+(on?' checked':'')+'></td>';}).join("");
      return '<tr><td>'+esc(pd[1])+'</td>'+cells+'</tr>';
    }).join("");
    body.innerHTML='<div class="topbar" style="margin-bottom:12px"><span class="hint">Valitse mit\\u00e4 kukin rooli n\\u00e4kee ja voi tehd\\u00e4. P\\u00e4\\u00e4k\\u00e4ytt\\u00e4j\\u00e4ll\\u00e4 on aina kaikki oikeudet.</span><button class="btn orange" onclick="savePerms()">\\ud83d\\udcbe Tallenna oikeudet</button></div>'
      +'<div class="panel"><div class="panel-b" style="padding:0"><div style="overflow-x:auto"><table><thead><tr>'+head+'</tr></thead><tbody>'+prows+'</tbody></table></div></div></div>';
  } else {
    const c=db.settings.company;'''

rep(old_branch, new_branch, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/oikeus_patch.py

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
for t in "PERM_DEFS" "PERM_ROLES" "function ensurePerms" "function savePerms" 'data-atab="perms"' 'adminTab==="perms"'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Vanha kovakoodattu can() poistettu ---"
if grep -qF '["mywork","dispatch","customers","reports","devices_edit","view","billing"].includes(p)' servalo.html; then
  echo "VIRHE: vanha can()-matriisi jäi."; exit 1
else echo "Vanha matriisi poistettu."; fi

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Muokattava oikeusmatriisi: db.perms + admin-valilehti Oikeudet"
git push origin main
echo "VALMIS."
```

---

## Huom
- Oletusoikeudet vastaavat nykyistä toimintaa, joten mikään ei muutu ennen kuin säädät
  oikeuksia Oikeudet-välilehdellä.
- Pääkäyttäjä-rooli ei näy matriisissa — sillä on aina kaikki oikeudet (turvalukko).
- Esimerkiksi asentajan muokkausoikeuden voi nyt poistaa yhdellä klikkauksella
  (poista rasti kohdasta "Laitteiden muokkaus" / Asentaja).
