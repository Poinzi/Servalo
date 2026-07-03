# Claude Code -prompti: uuden laitteen "Seuraava huolto/tarkastus" täyttyy automaattisesti

Aja **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutoksen,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

Mitä tämä tekee:
- Laitelomakkeessa **"Seuraava määräaikaishuolto"** täyttyy automaattisesti kun annat
  **huoltovälin** + **viimeisimmän huollon** päivän (kaava: päivä + väli).
- Sama **"Seuraava tarkastus"** -kentälle (tarkastusväli + viimeisin tarkastus).
- Auto-täyttö koskee vain kenttiä jotka ovat **tyhjiä lomaketta avattaessa** (eli uudet
  laitteet, tai vanhat joilla päivää ei ole). Käsin syötettyä päivää **ei ylikirjoiteta**.
- Käyttää samaa `addInterval`-funktiota kuin kuittaukset, joten "1 vuosi" → +1 v,
  "2 vuotta" → +2 v, "6 kk" → +6 kk, tyhjä → oletus 1 vuosi.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/autonext_patch.py <<'PYEOF'
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

old = '''  set("dInspInterval",d?(d.inspInterval||d.interval):"");set("dInspLast",d?.inspLast);set("dInspNext",d?.inspNext);
  document.getElementById("devOverlay").classList.add("show");
}'''

new = '''  set("dInspInterval",d?(d.inspInterval||d.interval):"");set("dInspLast",d?.inspLast);set("dInspNext",d?.inspNext);
  devAutoNextSetup();
  document.getElementById("devOverlay").classList.add("show");
}
// --- automaattinen "seuraava"-paiva valista + edellisesta paivasta ---
let _devAuto={next:{on:false,val:""},inspNext:{on:false,val:""}};
function devAutoRecalc(lastId,ivId,nextId,key){
  var st=_devAuto[key];if(!st||!st.on)return;
  var last=document.getElementById(lastId).value;
  var nx=document.getElementById(nextId);
  if(!last)return;
  if(nx.value && nx.value!==st.val)return; // kasin muutettu -> ei ylikirjoiteta
  var v=addInterval(last,document.getElementById(ivId).value);
  nx.value=v;st.val=v;
}
function devAutoNextSetup(){
  var nEmpty=!document.getElementById("dNext").value;
  var iEmpty=!document.getElementById("dInspNext").value;
  _devAuto={next:{on:nEmpty,val:""},inspNext:{on:iEmpty,val:""}};
  if(devAutoNextSetup._wired)return;
  devAutoNextSetup._wired=true;
  var h=function(){devAutoRecalc("dLast","dInterval","dNext","next");};
  document.getElementById("dLast").addEventListener("input",h);
  document.getElementById("dInterval").addEventListener("input",h);
  var hi=function(){devAutoRecalc("dInspLast","dInspInterval","dInspNext","inspNext");};
  document.getElementById("dInspLast").addEventListener("input",hi);
  document.getElementById("dInspInterval").addEventListener("input",hi);
}'''

rep(old, new, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/autonext_patch.py

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
for t in "devAutoNextSetup" "devAutoRecalc" "_devAuto"; do
  grep -q "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

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
git commit -m "Laitelomake: seuraava huolto/tarkastus tayttyy automaattisesti valista"
git push origin main
echo "VALMIS."
```

---

## Miten se toimii käytännössä

Kun luot uuden laitteen ja annat esim. huoltovälin "1 vuosi" ja viimeisimmän huollon
päivän, "Seuraava määräaikaishuolto" täyttyy heti vuoden päähän. Jos muutat väliä,
päivä päivittyy — kunnes kirjoitat päivän itse käsin, jolloin automaatti lopettaa
sen kentän osalta. Vanhoja laitteita joilla seuraava-päivä on jo asetettu, ei kosketa.
