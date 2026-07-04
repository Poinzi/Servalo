# Claude Code -prompti: AI-autofill — korosta käsin täytettävät kentät

Aja **Servalo-repon juuressa**. **Jatkopätsi** AI-autofilliin: kun tekoäly on lukenut kuvan,
ne kentät joita se **ei saanut selvää** (merkki/tyyppi, koko, vuosi, sarjanumero) jäävät
tyhjiksi — tämä patch **korostaa ne keltaisella** ja lisää statukseen tekstin
**"Täytä käsin: …"**. Korostus poistuu heti kun täytät kentän käsin.

> **Aja ensin** AI-autofill-patch (`claudecode-servalo-ai-autofill.md`). Tämä pätsi olettaa
> että `aiFillFromPhoto` ja `dSize`/`dYear`/`dSerial` ovat jo paikallaan.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF 'function aiFillFromPhoto' servalo.html || { echo "VIRHE: aiFillFromPhoto puuttuu — aja ensin AI-autofill-patch."; exit 1; }
grep -qF 'function aiPrepPanel' servalo.html || { echo "VIRHE: aiPrepPanel puuttuu — aja ensin AI-autofill-patch."; exit 1; }
grep -qF 'function aiMarkEmpty' servalo.html && { echo "Jo asennettu (aiMarkEmpty) — keskeytetään."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/ai_korostus_patch.py <<'PYEOF'
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

# 1) Lisaa apufunktiot + laajenna aiPrepPanel (CSS-injektio + tyhjennys + kuuntelijat)
old_prep = '''function aiPrepPanel(){
  var k=localStorage.getItem(AI_KEY_LS)||"";
  var ke=document.getElementById("aiKey");if(ke)ke.value=k;
  var im=document.getElementById("aiImgs");if(im)im.value="";
  aiSetStatus("","#555");
}'''
new_prep = '''function aiFieldDefs(){return [["dMake","merkki/tyyppi"],["dSize","koko"],["dYear","vuosi"],["dSerial","sarjanro"]];}
function aiClearMark(id){var el=document.getElementById(id);if(el)el.classList.remove("ai-need");}
function aiMarkEmpty(){
  var miss=[];
  aiFieldDefs().forEach(function(p){
    var el=document.getElementById(p[0]);if(!el)return;
    if(!((el.value||"").trim())){el.classList.add("ai-need");miss.push(p[1]);}
    else el.classList.remove("ai-need");
  });
  return miss;
}
function aiPrepPanel(){
  if(!document.getElementById("aiNeedCss")){var stl=document.createElement("style");stl.id="aiNeedCss";stl.textContent=".ai-need{border:1.5px solid #e0a800 !important;background:#fffbe6 !important;}";document.head.appendChild(stl);}
  var k=localStorage.getItem(AI_KEY_LS)||"";
  var ke=document.getElementById("aiKey");if(ke)ke.value=k;
  var im=document.getElementById("aiImgs");if(im)im.value="";
  aiSetStatus("","#555");
  aiFieldDefs().forEach(function(p){var el=document.getElementById(p[0]);if(!el)return;el.classList.remove("ai-need");if(!el._aiWired){el._aiWired=true;el.addEventListener("input",function(){aiClearMark(p[0]);});}});
}'''
rep(old_prep, new_prep, 1)

# 2) Statusrivi: korosta tyhjat + kerro mita taytetaan kasin
old_status = '''    var filled=[];if(makeV)filled.push("merkki/tyyppi");if(koko)filled.push("koko");if(vuosi)filled.push("vuosi");if(sarja)filled.push("sarjanro");
    aiSetStatus(filled.length?("Täytetty: "+filled.join(", ")+". Tarkista arvot."):"Ei luettavia arvoja kuvasta.", filled.length?"#1a7f37":"#c1121f");'''
new_status = '''    var filled=[];if(makeV)filled.push("merkki/tyyppi");if(koko)filled.push("koko");if(vuosi)filled.push("vuosi");if(sarja)filled.push("sarjanro");
    var miss=aiMarkEmpty();
    var msg=filled.length?("Täytetty: "+filled.join(", ")+"."):"Ei luettavia arvoja kuvasta.";
    if(miss.length)msg+=" Täytä käsin: "+miss.join(", ")+".";
    else if(filled.length)msg+=" Tarkista arvot.";
    aiSetStatus(msg, miss.length?"#e0a800":(filled.length?"#1a7f37":"#c1121f"));'''
rep(old_status, new_status, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/ai_korostus_patch.py

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

echo "--- Uudet palaset läsnä ---"
for t in 'function aiMarkEmpty' 'function aiFieldDefs' 'ai-need' 'Täytä käsin: ' 'aiNeedCss'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "AI-autofill: korosta kasin taytettavat tyhjat kentat (keltainen + status)"
git push origin main
echo "VALMIS."
```

---

## Huom
- Korostus koskee vain AI:n täytettäviä kenttiä: merkki/tyyppi, koko, vuosi, sarjanumero.
- Keltainen reunus + "Täytä käsin: …" -teksti ilmestyy heti analyysin jälkeen; poistuu kun
  kirjoitat kenttään. Modaalin avaus nollaa korostukset.
- Ei muuta dataa eikä pöytäkirjafunktioita.
