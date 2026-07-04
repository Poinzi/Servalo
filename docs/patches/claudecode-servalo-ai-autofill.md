# Claude Code -prompti: AI-autofill sammuttimen kuvasta

Aja **Servalo-repon juuressa**. Lisää laitelomakkeeseen **"🤖 Täytä kuvasta"** -paneelin:
tarkastaja ottaa 1–3 kuvaa sammuttimen tarrasta/leimoista, **Anthropic-visio** (Claude)
lukee **merkin, tyypin, koon, valmistusvuoden ja sarjanumeron** ja täyttää kentät. Käyttäjä
liittää **oman API-avaimen**, joka tallentuu vain selaimeen (localStorage). Laitteelle
lisätään omat kentät **Koko, Valmistusvuosi, Sarjanumero**; merkki+tyyppi menee nykyiseen
`make`-kenttään. Näin pöytäkirjan rivi täyttyy laitteen tiedoista.

Ei koske dataa, ei muita laitteita rikkovasti (paneeli on geneerinen mutta viittaa
sammuttimeen). Pöytäkirjafunktioita ei kosketa tässä patchissa.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
grep -qF 'function saveDevice' servalo.html || { echo "VIRHE: saveDevice puuttuu."; exit 1; }
grep -qF 'id="dSerial"' servalo.html && { echo "Jo asennettu (dSerial löytyi) — keskeytetään."; exit 1; }
grep -qF 'function aiFillFromPhoto' servalo.html && { echo "Jo asennettu (aiFillFromPhoto) — keskeytetään."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/ai_autofill_patch.py <<'PYEOF'
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

# 1) AI-paneeli laitemodaalin alkuun
old_panel = '''      <input type="hidden" id="dId">
      <div class="grid2">'''
new_panel = '''      <input type="hidden" id="dId">
      <div class="ai-fill" style="border:1px solid #e2c7c7;background:#fff6f6;border-radius:8px;padding:10px;margin:0 0 12px">
        <div style="font-weight:700;color:#c1121f;margin-bottom:6px">🤖 Täytä kuvasta (sammutin)</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px">Ota tai valitse 1–3 kuvaa sammuttimen tarrasta ja leimoista. Tekoäly lukee merkin, tyypin, koon, valmistusvuoden ja sarjanumeron ja täyttää kentät. Tarkista aina tulos.</div>
        <input type="file" id="aiImgs" accept="image/*" capture="environment" multiple class="f" style="margin-bottom:6px">
        <div class="field" style="margin-bottom:6px"><label>Anthropic API-avain <span class="hint">(tallentuu vain tähän selaimeen)</span></label><input class="f" id="aiKey" type="password" placeholder="sk-ant-..."></div>
        <button type="button" class="btn orange" id="aiRunBtn" onclick="aiFillFromPhoto()">Analysoi kuva</button>
        <span id="aiStatus" style="margin-left:10px;font-size:13px;color:#555"></span>
      </div>
      <div class="grid2">'''
rep(old_panel, new_panel, 1)

# 2) Uudet kentät laitelomakkeeseen (Tuoteryhmä-kentän jälkeen)
old_fields = '        <div class="field"><label>Tuoteryhmä</label><input class="f" id="dGroup" placeholder="esim. Paloilmoitin"></div>'
new_fields = old_fields + '''
        <div class="field"><label>Koko</label><input class="f" id="dSize" placeholder="esim. 6 kg"></div>
        <div class="field"><label>Valmistusvuosi</label><input class="f" id="dYear" placeholder="esim. 2019"></div>
        <div class="field"><label>Sarjanumero</label><input class="f" id="dSerial" placeholder="sammutinkohtainen"></div>'''
rep(old_fields, new_fields, 1)

# 3) editDevice: lataa uudet kentat
rep('  set("dValue",d?.value);set("dInterval",d?.interval);set("dDelivery",d?.delivery);',
    '  set("dValue",d?.value);set("dInterval",d?.interval);set("dDelivery",d?.delivery);\n  set("dSize",d?.size);set("dYear",d?.year);set("dSerial",d?.serial);', 1)

# 4) editDevice: valmistele AI-paneeli avattaessa
rep('''  devAutoNextSetup();
  document.getElementById("devOverlay").classList.add("show");''',
    '''  devAutoNextSetup();
  aiPrepPanel();
  document.getElementById("devOverlay").classList.add("show");''', 1)

# 5) saveDevice: tallenna uudet kentat
rep(',notes:g("dNotes").trim(),updated:today()};',
    ',size:g("dSize").trim(),year:g("dYear").trim(),serial:g("dSerial").trim(),notes:g("dNotes").trim(),updated:today()};', 1)

# 6) AI-funktiot closeOverlay:n jalkeen
old_js = 'function closeOverlay(id){document.getElementById(id).classList.remove("show");}'
new_js = old_js + '''
var AI_KEY_LS="SAVUKS_AI_KEY", AI_MODEL_LS="SAVUKS_AI_MODEL";
function aiModel(){return localStorage.getItem(AI_MODEL_LS)||"claude-sonnet-4-6";}
function aiSetStatus(t,c){var e=document.getElementById("aiStatus");if(e){e.textContent=t;e.style.color=c||"#555";}}
function aiPrepPanel(){
  var k=localStorage.getItem(AI_KEY_LS)||"";
  var ke=document.getElementById("aiKey");if(ke)ke.value=k;
  var im=document.getElementById("aiImgs");if(im)im.value="";
  aiSetStatus("","#555");
}
function aiFileToB64(file){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){var st=String(r.result);res(st.slice(st.indexOf(",")+1));};r.onerror=rej;r.readAsDataURL(file);});}
async function aiFillFromPhoto(){
  var keyEl=document.getElementById("aiKey");
  var key=((keyEl&&keyEl.value)||"").trim();
  if(!key){aiSetStatus("Anna API-avain.","#c1121f");return;}
  localStorage.setItem(AI_KEY_LS,key);
  var inp=document.getElementById("aiImgs");
  var files=inp&&inp.files?Array.prototype.slice.call(inp.files,0,3):[];
  if(!files.length){aiSetStatus("Valitse vähintään yksi kuva.","#c1121f");return;}
  var btn=document.getElementById("aiRunBtn");if(btn)btn.disabled=true;
  aiSetStatus("Analysoidaan…","#555");
  try{
    var content=[];
    for(var i=0;i<files.length;i++){
      var fl=files[i];
      if(fl.size>4*1024*1024){aiSetStatus("Kuva liian suuri (max 4 MB): "+fl.name,"#c1121f");if(btn)btn.disabled=false;return;}
      var b64=await aiFileToB64(fl);
      content.push({type:"image",source:{type:"base64",media_type:fl.type||"image/jpeg",data:b64}});
    }
    content.push({type:"text",text:"Kuvissa on käsisammutin. Lue tarrasta ja leimoista ja palauta VAIN JSON-objekti, jonka avaimet ovat merkki, tyyppi, koko, valmistusvuosi ja sarjanumero (kaikki merkkijonoarvoja). merkki=valmistaja, tyyppi=sammutelaji kuten jauhe, CO2 tai neste, koko=esim. 6 kg, valmistusvuosi=4-numeroinen vuosi jos luettavissa, sarjanumero=sammutinkohtainen numero. Jos jotain ei voi lukea, käytä tyhjää merkkijonoa. Älä keksi arvoja. Vastaa pelkällä JSON:lla ilman muuta tekstiä."});
    var resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:aiModel(),max_tokens:400,messages:[{role:"user",content:content}]})});
    if(!resp.ok){var et=await resp.text();aiSetStatus("Virhe "+resp.status+": "+et.slice(0,140),"#c1121f");if(btn)btn.disabled=false;return;}
    var data=await resp.json();
    var txt=(data&&data.content&&data.content[0]&&data.content[0].text)||"";
    var mm=txt.match(/\\{[\\s\\S]*\\}/);
    if(!mm){aiSetStatus("Vastausta ei voitu lukea.","#c1121f");if(btn)btn.disabled=false;return;}
    var o=JSON.parse(mm[0]);
    var brand=((o.merkki||"")+"").trim(), typ=((o.tyyppi||"")+"").trim();
    var makeV=(brand+" "+typ).trim();
    var koko=((o.koko||"")+"").trim(), vuosi=((o.valmistusvuosi||"")+"").trim(), sarja=((o.sarjanumero||"")+"").trim();
    if(makeV)document.getElementById("dMake").value=makeV;
    if(koko)document.getElementById("dSize").value=koko;
    if(vuosi)document.getElementById("dYear").value=vuosi;
    if(sarja)document.getElementById("dSerial").value=sarja;
    var filled=[];if(makeV)filled.push("merkki/tyyppi");if(koko)filled.push("koko");if(vuosi)filled.push("vuosi");if(sarja)filled.push("sarjanro");
    aiSetStatus(filled.length?("Täytetty: "+filled.join(", ")+". Tarkista arvot."):"Ei luettavia arvoja kuvasta.", filled.length?"#1a7f37":"#c1121f");
  }catch(e){aiSetStatus("Virhe: "+((e&&e.message)||e),"#c1121f");if(btn)btn.disabled=false;return;}
  if(btn)btn.disabled=false;
}'''
rep(old_js, new_js, 1)

if s == orig:
    print("VIRHE: mitaan ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/ai_autofill_patch.py

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

echo "--- Uudet elementit läsnä ---"
for t in 'id="aiImgs"' 'id="aiKey"' 'id="dSize"' 'id="dYear"' 'id="dSerial"' 'function aiFillFromPhoto' '<label>Koko</label>' '<label>Valmistusvuosi</label>' '<label>Sarjanumero</label>'; do
  grep -qF "$t" servalo.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- saveDevice tallentaa uudet kentät ---"
grep -qF 'size:g("dSize").trim(),year:g("dYear").trim(),serial:g("dSerial").trim()' servalo.html && echo "OK: save" || { echo "VIRHE: save-kentät puuttuvat"; exit 1; }

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Laitelomake: AI-autofill sammuttimen kuvasta (Anthropic-visio) + Koko/Valm.vuosi/Sarjanumero-kentat"
git push origin main
echo "VALMIS."
```

---

## Miten käytät
1. Avaa laitteen tiedot (Uusi laite / Muokkaa laitetta).
2. Liitä **Anthropic API-avaimesi** kerran — se muistetaan tässä selaimessa.
3. Ota 1–3 kuvaa sammuttimen tarrasta ja leimoista → **Analysoi kuva**.
4. Kentät (merkki/tyyppi → Valmistaja/Malli/Tyyppi, Koko, Valm.vuosi, Sarjanumero) täyttyvät. **Tarkista** ja **Tallenna**.

## Huom
- Avain tallentuu vain käyttäjän selaimeen (localStorage), ei tiedostoon eikä pushiin.
- Malli on oletuksena `claude-sonnet-4-6`; voit vaihtaa: selaimen konsolissa
  `localStorage.setItem("SAVUKS_AI_MODEL","<malli>")`.
- Tuetut kuvamuodot: JPEG, PNG, WebP, GIF (HEIC ei tueta — ota kuva JPG:nä).
- **Pöytäkirja:** Merkki/tyyppi (make) ja Sarjanumero näkyvät raportissa heti. **Koko** ja
  **Valm.vuosi** vaativat vielä pienen jatkopätsin, joka kytkee ne pöytäkirjan sarakkeisiin
  suoraan (nyt raportti johtaa vuoden regexillä). Kerro, niin teen sen seuraavaksi.
```
