# Claude Code -prompti: QR per asunto (varoittimet julkiselle sivulle) + massatuonti

Aja **Servalo-repon juuressa**. Kaksi asiaa yhdellä patchilla:

**Vaihe 2 — QR per asunto.** Asukkaan QR-sivu (`/k/KOODI`, ohje24.html) näyttää nyt kortin
**"Tämän asunnon palovaroittimet"**: jokainen varoitin sijainti + virtalähde + vaihtopäivä.
Data tulee asukas-koodin `data.varoittimet`-kentästä (palvelin, jsonb) — ei kosketa jaettuun
taloyhtiön turvallisuustilanteeseen. Jos varoittimia ei ole kirjattu, korttia ei näytetä.

**Vaihe 3 — massatuonti.** CSV-tuonti (`⬆ Tuo CSV` asiakkaan Koodit-paneelissa) osaa nyt:
- laajemmat sarakkeet: `koodi, asunto, kerros, huomio, tyyppi, pin, varoittimet` (myös vanhat
  `nimi/sijainti` kelpaavat aliaksina), sarakejärjestys vapaa, ylimääräiset sarakkeet ohitetaan;
- **autogeneroida koodin** jos `koodi`-sarake on tyhjä (koko taloyhtiö kerralla: pelkkä asuntolista riittää);
- lukea `varoittimet`-sarakkeen muodossa `Sijainti:Teho:Vaihdettu` ja monta putkella eroteltuna,
  esim. `Eteinen:230V:5/2026|Makuuhuone:Paristo:3/2025`.

Kun tuodut koodit viedään palvelimelle (`☁ Vie palvelimelle`), varoittimet menevät mukana ja
näkyvät heti asukkaan QR-sivulla.

Ei kosketa dataan eikä muihin toimintoihin. Muuttaa vain `servalo.html` (2 ankkuria) ja
`ohje24.html` (3 ankkuria).

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
test -f ohje24.html  || { echo "VIRHE: ohje24.html ei löydy."; exit 1; }
cp servalo.html servalo.html.bak
cp ohje24.html  ohje24.html.bak

cat > /tmp/qr_sv.py <<'PYEOF'
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

# S1: asukas-koodin data vie kerroksen + varoittimet palvelimelle
S1_OLD='  else data={apt:x.apt||"",note:x.note||""};'
S1_NEW='  else data={apt:x.apt||"",note:x.note||"",floor:x.floor||"",varoittimet:Array.isArray(x.smokes)?x.smokes:[]};'

# S3: massatuonti — laajennetut sarakkeet + koodin autogenerointi + varoittimet
S3_OLD='''      const head=rows[0].map(h=>h.trim().toLowerCase());
      const ci=head.indexOf("koodi"),ni=head.indexOf("nimi"),si=head.indexOf("sijainti"),ti=head.indexOf("tyyppi"),pii=head.indexOf("pin");
      let added=0;
      for(let i=1;i<rows.length;i++){
        const row=rows[i];if(!row.length)continue;
        const code=(ci>=0&&row[ci]?row[ci]:"").trim();
        const apt=(ni>=0&&row[ni]?row[ni]:"").trim();
        const note=(si>=0&&row[si]?row[si]:"").trim();
        const type=((ti>=0&&row[ti]?row[ti]:"asukas").trim().toLowerCase())||"asukas";
        const pin=(pii>=0&&row[pii]?row[pii]:"").trim();
        if(!code&&!apt)continue;
        db.codes.push({id:uid(),customerId:cid,code,apt,note,type,pin,images:[],created:today()});
        added++;
      }
      save();refreshCodes();'''
S3_NEW='''      const head=rows[0].map(h=>h.trim().toLowerCase());
      const col=(...names)=>{for(const n of names){const k=head.indexOf(n);if(k>=0)return k;}return -1;};
      const ci=col("koodi"),ni=col("asunto","nimi"),si=col("huomio","sijainti"),ti=col("tyyppi"),pii=col("pin"),fi=col("kerros","floor"),vi=col("varoittimet","varoitin");
      const parseSmokes=(s)=>String(s||"").split("|").map(seg=>{const p=seg.split(":").map(x=>x.trim());if(!p[0])return null;return {loc:p[0]||"",power:p[1]||"",last:p[2]||""};}).filter(Boolean);
      let added=0;
      for(let i=1;i<rows.length;i++){
        const row=rows[i];if(!row.length)continue;
        let code=(ci>=0&&row[ci]?row[ci]:"").trim();
        const apt=(ni>=0&&row[ni]?row[ni]:"").trim();
        const note=(si>=0&&row[si]?row[si]:"").trim();
        const type=((ti>=0&&row[ti]?row[ti]:"asukas").trim().toLowerCase())||"asukas";
        const pin=(pii>=0&&row[pii]?row[pii]:"").trim();
        const floor=(fi>=0&&row[fi]?row[fi]:"").trim();
        const smokes=vi>=0?parseSmokes(row[vi]):[];
        if(!code&&!apt)continue;
        if(!code)code=genQrCode();
        db.codes.push({id:uid(),customerId:cid,code,apt,note,type,pin,floor,smokes,images:[],created:today()});
        added++;
      }
      save();refreshCodes();'''

patch(FN,[(S1_OLD,S1_NEW,1),(S3_OLD,S3_NEW,1)])
PYEOF

cat > /tmp/qr_oh.py <<'PYEOF'
import io, sys
FN=sys.argv[1] if len(sys.argv)>1 else "ohje24.html"
def patch(fn,edits):
    s=io.open(fn,encoding="utf-8").read();orig=s
    for old,new,n in edits:
        c=s.count(old)
        if c!=n:
            print("VIRHE: ankkuri %d/%d:\n  %s"%(c,n,old[:90]));sys.exit(1)
        s=s.replace(old,new)
    if s==orig:print("VIRHE: ei muuttunut");sys.exit(1)
    io.open(fn,"w",encoding="utf-8").write(s);print("Patch OK: %s"%fn)

# O1: vie varoittimet palvelimen datasta näkymään
O1_OLD='  if(t==="asukas") return {type:"asukas", apt:d.apt||res.koodi, floor:d.floor||""};'
O1_NEW='  if(t==="asukas") return {type:"asukas", apt:d.apt||res.koodi, floor:d.floor||"", varoittimet:Array.isArray(d.varoittimet)?d.varoittimet:[]};'

# O3: apufunktio joka piirtää asunnon varoitinkortin
O3_OLD='function openDoc(k){toast("Demo: avaisi dokumentin ("+k+")");}'
O3_NEW='''function openDoc(k){toast("Demo: avaisi dokumentin ("+k+")");}
function smokeListCard(c){
  var list=(c&&Array.isArray(c.varoittimet))?c.varoittimet:[];
  if(!list.length) return "";
  var rows=list.map(function(s){
    var meta=[s.power,(s.last?("vaihdettu "+s.last):"")].filter(Boolean).join(" \\u00b7 ");
    return '<div class="status-row"><span style="font-size:20px">\\ud83d\\udd14</span>'+
      '<div class="grow"><div class="name">'+esc(s.loc||"Palovaroitin")+'</div>'+
      (meta?'<div class="meta">'+esc(meta)+'</div>':'')+'</div></div>';
  }).join("");
  return '<div class="card"><h2>T\\u00e4m\\u00e4n asunnon palovaroittimet ('+list.length+')</h2>'+rows+
    '<p class="hint" style="margin:8px 0 0">Palovaroittimet ovat asukkaan vastuulla. Testaa s\\u00e4\\u00e4nn\\u00f6llisesti ja kuittaa alta.</p></div>';
}'''

# O2: kutsu kortti asukasnäkymässä statusBlockin jälkeen
O2_OLD='''    statusBlock()+
    '<div class="card"><h2>Oma palovaroitin</h2>\''''
O2_NEW='''    statusBlock()+
    smokeListCard(c)+
    '<div class="card"><h2>Oma palovaroitin</h2>\''''

patch(FN,[(O1_OLD,O1_NEW,1),(O3_OLD,O3_NEW,1),(O2_OLD,O2_NEW,1)])
PYEOF

python3 /tmp/qr_sv.py servalo.html
python3 /tmp/qr_oh.py ohje24.html

echo "--- JS-syntaksin validointi (servalo + ohje24) ---"
for f in servalo.html ohje24.html; do
node -e '
const fs=require("fs");const h=fs.readFileSync(process.argv[1],"utf8");
const re=/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g;
let m,i=0,ok=true;
while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){ok=false;console.log(process.argv[1]+" lohko "+i+" FAIL: "+e.message);}}
console.log(process.argv[1]+": "+(ok?("JS OK ("+i+" lohkoa)"):"JS FAILED"));process.exit(ok?0:1);
' "$f" || exit 1
done

echo "--- Uudet palaset läsnä ---"
grep -qF 'varoittimet:Array.isArray(x.smokes)' servalo.html && echo "OK: sync vie varoittimet" || { echo "PUUTTUU: sync"; exit 1; }
grep -qF 'if(!code)code=genQrCode();' servalo.html && echo "OK: koodin autogenerointi" || { echo "PUUTTUU: autogen"; exit 1; }
grep -qF 'function smokeListCard(c)' ohje24.html && echo "OK: julkinen varoitinkortti" || { echo "PUUTTUU: kortti"; exit 1; }
grep -qF 'smokeListCard(c)+' ohje24.html && echo "OK: kortti kutsutaan asukasnäkymässä" || { echo "PUUTTUU: kutsu"; exit 1; }

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html ohje24.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak ohje24.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "QR per asunto: asukassivu listaa asunnon varoittimet; massatuonti tukee laajennettuja sarakkeita + koodin autogeneroinnin"
git push origin main
echo "VALMIS."
```

---

## CSV-pohja (massatuonti)

Otsikkorivi (sarakejärjestys vapaa, ylimääräiset sarakkeet ohitetaan):

```
koodi,asunto,kerros,huomio,tyyppi,varoittimet
,A1,1. krs,,asukas,Eteinen:230V:5/2026|Makuuhuone:Paristo:3/2025
,A2,1. krs,,asukas,Eteinen:230V:5/2026
,A3,2. krs,Vaihto tehty,asukas,Keittiö:Paristo:6/2026|Olohuone:Paristo:6/2026
```

- **koodi** tyhjä ⇒ luodaan automaattisesti (`SVL-XXXXX`). Täytä jos tarrassa on valmis koodi.
- **asunto** = asunnon/tilan tunnus (näkyy sivun otsikossa "Asunto A1").
- **varoittimet** = `Sijainti:Teho:Vaihdettu`, monta putkella `|`. Teho ja vaihtopäivä valinnaisia.
- **tyyppi** oletus `asukas`; muut: `aula`, `laite`, `huolto` (huoltolle lisää `pin`-sarake).

## Näin käytät
1. Asiakas → paneeli **Koodit & kohteet** → **⬆ Tuo CSV** → valitse tiedosto.
2. Vahvista "Viedäänkö palvelimelle" → **☁**. (Tai myöhemmin `☁ Vie palvelimelle`.)
3. **🖨 Tulosta QR-tarrat** ja kiinnitä asuntoihin.
4. Skannaa asunnon tarra → julkinen sivu näyttää **"Tämän asunnon palovaroittimet"** + taloyhtiön tilan.

## Testattu
Molemmat patchit ajettu hiekkalaatikossa oikeisiin servalo.html- ja ohje24.html-kopioihin:
ankkurit osuivat (servalo 2×n=1, ohje24 3×n=1), JS-syntaksi OK molemmissa, uudet palaset läsnä,
kielletyt merkkijonot puhtaat. `smokeListCard` palauttaa tyhjän kun varoittimia ei ole, ja
`parseSmokes` jäsentää putkilistan oikein.
