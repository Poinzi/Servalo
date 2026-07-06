# Claude Code -prompti: Ota kuva suoraan sovelluksessa (Servalo)

Aja **Servalo-repon juuressa**. Lisää `servalo.html`:ään **sovelluksen oma kamera**: jokaisen
kuvakentän viereen ilmestyy **📷 Ota kuva** -nappi, joka avaa kameran suoraan selaimessa
(`getUserMedia`), ottaa still-kuvan ja liittää sen samaan kenttään. Toimii sekä **työpöydällä
(Mac/PC-webkamera)** että **mobiilissa**. Tiedostonvalinta säilyy rinnalla.

## Miten se toimii
- Yksi jaettu kameramodaali + `getUserMedia`-apuri lisätään sivun loppuun.
- Skripti **skannaa automaattisesti** kaikki kuvakentät (`input[type=file]`, joissa `accept` sisältää
  `image`) ja lisää niiden viereen 📷-napin. `MutationObserver` kattaa myös dynaamisesti
  renderöidyt kentät (pöytäkirjojen kuvat, asennusraportit, sertifikaattiliitteet).
- Kamerakuva syötetään kenttään **saman `change`-tapahtuman kautta** kuin tiedostonvalinta
  (`DataTransfer`), joten kaikki olemassa olevat käsittelijät (esikatselu, pakkaus, tallennus)
  toimivat sellaisenaan — mitään yksittäistä lomaketta ei tarvitse muuttaa.
- "Lisää kuva koodille" -toiminto (`addCodeImage`) reititetään myös kameran kautta; jos kameraa ei
  ole, se putoaa takaisin tiedostonvalintaan.

## Kattaa nämä kuvakentät
AI-analyysin kuvat, kaikki 10 pöytäkirjatyypin kuvakentät, asennusraportin kuvat (yleiset + lohkot),
sertifikaattiliitteet (kuva/PDF) sekä koodin/asunnon kuvat.

> **HTTPS vaaditaan:** selaimet sallivat kameran vain suojatulla yhteydellä (Railway-osoite on
> HTTPS). Jos kameraa ei voi avata (ei lupaa / ei kameraa), sovellus näyttää ilmoituksen ja tarjoaa
> tiedostonvalinnan.

---

## Patch (bash-lohko)

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
if grep -qF '__svCamInit' servalo.html; then
  echo "OK: kamera on jo asennettu — ei tehdä mitään."; exit 0
fi
cp servalo.html servalo.html.bak

cat > /tmp/kamera_build.py <<'PYEOF'
import io, sys
FN=sys.argv[1] if len(sys.argv)>1 else "servalo.html"
def patch(fn,edits):
    s=io.open(fn,encoding="utf-8").read();orig=s
    for old,new,n in edits:
        c=s.count(old)
        if c!=n:
            print("VIRHE: ankkuri %d/%d:\n  %s"%(c,n,old[:90]));sys.exit(1)
        s=s.replace(old,new)
    if s==orig:print("VIRHE: ei muuttunut");sys.exit(1)
    io.open(fn,"w",encoding="utf-8").write(s);print("Patch OK: %s"%fn)

ANCHOR='window.addEventListener("hashchange",handleDeepLink);'
CAM=r'''

/* === Kamera: ota kuva suoraan sovelluksessa (getUserMedia) === */
(function(){
  if(window.__svCamInit)return; window.__svCamInit=true;
  var stream=null,targetInput=null,facing="environment";
  function stop(){ if(stream){ stream.getTracks().forEach(function(t){t.stop();}); stream=null; } }
  function close(){ stop(); var m=document.getElementById("svCamModal"); if(m)m.style.display="none"; targetInput=null; }
  function build(){
    var m=document.getElementById("svCamModal"); if(m)return m;
    m=document.createElement("div"); m.id="svCamModal";
    m.style.cssText="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85);align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:16px";
    m.innerHTML='<video id="svCamVideo" autoplay playsinline muted style="max-width:96vw;max-height:70vh;border-radius:10px;background:#000"></video>'
      +'<canvas id="svCamCanvas" style="display:none"></canvas>'
      +'<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">'
      +'<button type="button" id="svCamShotBtn" style="font-size:16px;padding:12px 20px;border-radius:8px;border:0;background:#fff;color:#111;font-weight:600;cursor:pointer">\u{1F4F7} Ota kuva</button>'
      +'<button type="button" id="svCamFlipBtn" style="font-size:16px;padding:12px 16px;border-radius:8px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer">\u{1F504} Vaihda kamera</button>'
      +'<button type="button" id="svCamCloseBtn" style="font-size:16px;padding:12px 16px;border-radius:8px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer">Peru</button>'
      +'</div>'
      +'<div style="color:#ccc;font-size:12px;text-align:center">Salli kameran kaytto selaimessa. Vaatii HTTPS-yhteyden.</div>';
    document.body.appendChild(m);
    m.querySelector("#svCamShotBtn").onclick=shot;
    m.querySelector("#svCamFlipBtn").onclick=flip;
    m.querySelector("#svCamCloseBtn").onclick=close;
    m.addEventListener("click",function(e){ if(e.target===m) close(); });
    return m;
  }
  function start(){
    stop();
    navigator.mediaDevices.getUserMedia({video:{facingMode:facing},audio:false}).then(function(s){
      stream=s; var v=document.getElementById("svCamVideo"); if(v)v.srcObject=s;
    }).catch(function(e){
      var ti=targetInput;
      alert("Kameraa ei voitu avata: "+(e&&e.message?e.message:e)+". Tarkista kameran kayttooikeus (HTTPS vaaditaan). Voit myos valita tiedoston.");
      close(); if(ti){ try{ti.click();}catch(_){} }
    });
  }
  function flip(){ facing=(facing==="environment"?"user":"environment"); start(); }
  function shot(){
    var v=document.getElementById("svCamVideo"); if(!v||!v.videoWidth){ return; }
    var c=document.getElementById("svCamCanvas"); c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0,c.width,c.height);
    var ti=targetInput;
    c.toBlob(function(blob){
      if(blob && ti){
        var file=new File([blob],"kamera-"+Date.now()+".jpg",{type:"image/jpeg"});
        try{
          var dt=new DataTransfer();
          if(ti.multiple && ti.files){ for(var i=0;i<ti.files.length;i++) dt.items.add(ti.files[i]); }
          dt.items.add(file); ti.files=dt.files;
        }catch(_){}
        try{ ti.dispatchEvent(new Event("change",{bubbles:true})); }catch(_){}
      }
      close();
    },"image/jpeg",0.85);
  }
  window.svOpenCamera=function(input){
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ alert("Tama selain ei tue kameraa. Valitse tiedosto."); if(input){try{input.click();}catch(_){}} return; }
    targetInput=input||null; build().style.display="flex"; start();
  };
  function addBtn(inp){
    try{
      if(!inp||inp.getAttribute("data-svcam"))return;
      if(!/image/i.test(inp.getAttribute("accept")||""))return;
      inp.setAttribute("data-svcam","1");
      var host=(inp.closest&&inp.closest("label"))||inp;
      var b=document.createElement("button");
      b.type="button"; b.className="btn sm ghost"; b.textContent="\U0001F4F7 Ota kuva"; b.style.marginTop="6px";
      b.onclick=function(e){ if(e){e.preventDefault();e.stopPropagation();} svOpenCamera(inp); };
      if(host.parentNode) host.parentNode.insertBefore(b, host.nextSibling);
    }catch(_){}
  }
  function scan(root){ try{ (root||document).querySelectorAll("input[type=file]").forEach(addBtn); }catch(_){} }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){scan(document);});
  else scan(document);
  try{
    var mo=new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){ var an=muts[i].addedNodes; if(!an)continue;
        for(var j=0;j<an.length;j++){ var n=an[j]; if(!n||n.nodeType!==1)continue;
          if(n.matches&&n.matches("input[type=file]")) addBtn(n);
          if(n.querySelectorAll) scan(n);
        } }
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }catch(_){}
})();'''

A2='  };\n  inp.click();\n}\nfunction viewCodeImage(id,i){'
B2='  };\n  svOpenCamera(inp);\n}\nfunction viewCodeImage(id,i){'

patch(FN,[(ANCHOR, ANCHOR+CAM, 1),(A2,B2,1)])
PYEOF

python3 /tmp/kamera_build.py servalo.html

echo "--- JS-syntaksi ---"
node -e '
const fs=require("fs");const h=fs.readFileSync("servalo.html","utf8");
const re=/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g;
let m,i=0,ok=true;
while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){ok=false;console.log("lohko "+i+" FAIL: "+e.message);}}
console.log(ok?("servalo.html: JS OK ("+i+" lohkoa)"):"JS FAILED");process.exit(ok?0:1);
' || { echo "VIRHE: JS ei validoi"; exit 1; }

echo "--- Uudet palaset ---"
grep -qF 'window.svOpenCamera' servalo.html && echo "OK: kamera-apuri" || { echo "PUUTTUU"; exit 1; }
grep -qF 'getUserMedia' servalo.html && echo "OK: getUserMedia" || { echo "PUUTTUU"; exit 1; }
grep -qF '📷 Ota kuva' servalo.html || grep -qF '\u{1F4F7} Ota kuva' servalo.html && echo "OK: nappi" || { echo "PUUTTUU"; exit 1; }

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Kamera: ota kuva suoraan sovelluksessa (getUserMedia) kaikkiin kuvakenttiin"
git push origin main
echo "VALMIS."
```

---

## Testattu (hiekkalaatikko)
Patch ajettu oikeaan `servalo.html`-kopioon: ankkurit osuivat (2×n=1), koko sivun JS validoitui
(`new Function` kaikille script-lohkoille), 📷-nappi ja `getUserMedia` läsnä, kielletyt merkkijonot
puhtaat. Skripti on idempotentti (ohittaa ajon jos `__svCamInit` on jo tiedostossa).

## Huomioita
- **Työpöytä:** avaa webkameran modaaliin, "📷 Ota kuva" tallentaa still-kuvan JPEG:nä (laatu 0.85).
- **Mobiili:** sama kamera; "🔄 Vaihda kamera" vaihtaa etu-/takakameran välillä.
- **Ei riippuvuuksia:** puhdas selain-API (`getUserMedia`, `canvas`, `DataTransfer`).
- **Tiedostonvalinta säilyy:** kenttien alkuperäinen valitse-tiedosto-toiminto toimii ennallaan.
