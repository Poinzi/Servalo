# Claude Code -prompti: Sanelu (puhe → kentät) kuva-analyysin rinnalle

Aja **Servalo-repon juuressa**. Lisää laitelomakkeen AI-paneeliin **🎤 Sanele tiedot**
-painikkeen kuva-analyysin viereen. Käyttää **selaimen omaa puheentunnistusta** (suomi
`fi-FI`, ilmainen, ei erillistä avainta). Sanelet yhden komennon, esim.
*"merkki Presto, tyyppi jauhe, koko 6 kg, vuosi 2019, sarjanumero AB123"*, ja järjestelmä
**jäsentää arvot kenttiin**. Jos selain ei tue puheentunnistusta (esim. osa iPhoneista),
nappi **piilotetaan** automaattisesti — muu toiminta säilyy.

> **Aja ensin** AI-autofill-patch (`claudecode-servalo-ai-autofill.md`). Tämä olettaa että
> `aiFillFromPhoto`, `aiModel` ja `aiRunBtn` ovat jo paikallaan. Toimii myös ilman
> korostus-pätsiä (kutsuu `aiMarkEmpty`-korostusta vain jos se on olemassa).

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF 'function aiFillFromPhoto' servalo.html || { echo "VIRHE: aiFillFromPhoto puuttuu — aja ensin AI-autofill-patch."; exit 1; }
grep -qF 'id="aiRunBtn"' servalo.html || { echo "VIRHE: aiRunBtn puuttuu — aja ensin AI-autofill-patch."; exit 1; }
grep -qF 'function aiDictate' servalo.html && { echo "Jo asennettu (aiDictate) — keskeytetään."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/ai_sanelu_patch.py <<'PYEOF'
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

# 1) Mikki-nappi Analysoi-napin viereen
rep('<button type="button" class="btn orange" id="aiRunBtn" onclick="aiFillFromPhoto()">Analysoi kuva</button>',
    '<button type="button" class="btn orange" id="aiRunBtn" onclick="aiFillFromPhoto()">Analysoi kuva</button>\n        <button type="button" class="btn ghost" id="aiMicBtn" onclick="aiDictate()" style="margin-left:8px">🎤 Sanele tiedot</button>', 1)

# 2) Sanelufunktiot aiModel-rivin jalkeen
old_js = 'function aiModel(){return localStorage.getItem(AI_MODEL_LS)||"claude-sonnet-4-6";}'
new_js = old_js + '''
function aiSupportsSpeech(){return !!(window.SpeechRecognition||window.webkitSpeechRecognition);}
function aiSetField(id,val){var el=document.getElementById(id);if(el&&val){el.value=val;return true;}return false;}
function aiTitle(s){return s.replace(/\\b\\w/g,function(c){return c.toUpperCase();});}
function aiParseSpeech(text){
  var t=(" "+text+" ").toLowerCase();
  var keys=[
    {re:/\\bmerkki\\b|\\bvalmistaja\\b/g,slot:"brand"},
    {re:/\\btyyppi\\b|\\bsammutelaji\\b|\\blaji\\b/g,slot:"type"},
    {re:/\\bkoko\\b/g,slot:"size"},
    {re:/\\bvalmistusvuosi\\b|\\bvuosi\\b/g,slot:"year"},
    {re:/\\bsarjanumero\\b|\\bsarja\\b/g,slot:"serial"}
  ];
  var hits=[];
  keys.forEach(function(k){var m;while((m=k.re.exec(t))){hits.push({slot:k.slot,start:m.index,end:m.index+m[0].length});}});
  hits.sort(function(a,b){return a.start-b.start;});
  var vals={};
  for(var i=0;i<hits.length;i++){
    var seg=t.slice(hits[i].end, i+1<hits.length?hits[i+1].start:t.length);
    seg=seg.replace(/^[\\s:,\\.]+|[\\s:,\\.]+$/g,"").trim();
    if(seg&&!vals[hits[i].slot])vals[hits[i].slot]=seg;
  }
  var filled=[];
  var brand=vals.brand||"", typ=vals.type||"";
  var makeV=(brand+" "+typ).trim();
  if(makeV){aiSetField("dMake",aiTitle(makeV));filled.push("merkki/tyyppi");}
  if(vals.size){aiSetField("dSize",vals.size);filled.push("koko");}
  if(vals.year){var y=(vals.year.match(/(19|20)\\d{2}/)||[])[0]||vals.year;aiSetField("dYear",y);filled.push("vuosi");}
  if(vals.serial){aiSetField("dSerial",vals.serial.toUpperCase().replace(/\\s+/g,""));filled.push("sarjanro");}
  return filled;
}
function aiDictate(){
  if(!aiSupportsSpeech()){aiSetStatus("Sanelu ei ole tuettu tässä selaimessa.","#c1121f");return;}
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  var rec=new SR();rec.lang="fi-FI";rec.interimResults=false;rec.maxAlternatives=1;
  var btn=document.getElementById("aiMicBtn");
  aiSetStatus("Kuuntelen… sano esim. merkki Presto, tyyppi jauhe, koko 6 kg, vuosi 2019, sarjanumero AB123","#555");
  if(btn){btn.disabled=true;btn.textContent="🎤 Kuuntelen…";}
  rec.onerror=function(e){aiSetStatus("Sanelu epäonnistui: "+((e&&e.error)||""),"#c1121f");if(btn){btn.disabled=false;btn.textContent="🎤 Sanele tiedot";}};
  rec.onend=function(){if(btn){btn.disabled=false;btn.textContent="🎤 Sanele tiedot";}};
  rec.onresult=function(ev){
    var txt="";for(var i=0;i<ev.results.length;i++){txt+=ev.results[i][0].transcript+" ";}
    txt=txt.trim();
    var filled=aiParseSpeech(txt);
    var extra=(typeof aiMarkEmpty==="function")?aiMarkEmpty():[];
    var msg='Kuultu: "'+txt+'". ';
    msg+=filled.length?("Täytetty: "+filled.join(", ")+"."):"Ei tunnistettuja kenttiä — kokeile: merkki, tyyppi, koko, vuosi, sarjanumero.";
    if(extra.length)msg+=" Täytä käsin: "+extra.join(", ")+".";
    aiSetStatus(msg, filled.length?"#1a7f37":"#c1121f");
  };
  try{rec.start();}catch(e){aiSetStatus("Sanelua ei voitu käynnistää.","#c1121f");if(btn){btn.disabled=false;btn.textContent="🎤 Sanele tiedot";}}
}
(function(){function h(){var b=document.getElementById("aiMicBtn");if(b&&!aiSupportsSpeech())b.style.display="none";}if(document.readyState!=="loading")h();else document.addEventListener("DOMContentLoaded",h);})();'''
rep(old_js, new_js, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/ai_sanelu_patch.py

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
for t in 'id="aiMicBtn"' 'function aiDictate' 'function aiParseSpeech' 'function aiSupportsSpeech' 'fi-FI'; do
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
git commit -m "AI-paneeli: sanelu (fi-FI puhe -> kentat) kuva-analyysin rinnalle"
git push origin main
echo "VALMIS."
```

---

## Miten käytät
- Avaa laite → **🎤 Sanele tiedot** → sano yhtenä pätkänä: *"merkki Presto, tyyppi jauhe,
  koko 6 kg, vuosi 2019, sarjanumero AB123"*. Kentät täyttyvät, status näyttää mitä kuuli.
- Voit sanoa vain osan (esim. pelkkä vuosi ja koko) — loput jäävät ennalleen/käsin.

## Huom
- Sanelu ja kuva-analyysi toimivat rinnakkain, kumpi tahansa erikseen.
- Android + Chrome: toimii hyvin. iPhone/Safari: jos tunnistusta ei tueta, nappi piiloutuu.
- Sarjanumero ja tarkat merkkijonot voivat tunnistua puheesta epätarkasti — tarkista aina.
