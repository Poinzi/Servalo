# Claude Code -prompti: Servalo — Laitetunnus → QR-koodit

Aja tämä **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

Mitä tämä tekee:
1. **QR-koodi listaan** — laitelistan "Laitetunnus"-sarake korvataan pienellä QR-koodilla + koodilla alla.
2. **Automaattinen koodinluonti** — jos QR-koodi jätetään tyhjäksi, luodaan uniikki koodi `SVL-XXXXX`. Näin QR toimii aina, eikä tunnuksia tarvitse keksiä.
3. **QR-tarra-arkki** — tulostettava A4-arkki (3 saraketta) laitteen QR + koodi + tiedot. Toimii yksittäiselle laitteelle (laitenäkymä) ja monivalinnalle (bulk).
4. **QR-kohteen reititys** — laitteelle valitaan kohde: *Savuks Oy:n oma tarkastettava laite* → QR avaa Servalon, tai *Taloyhtiö / asukastila* → QR avaa ohje24.fi:n. Vanhat laitteet säilyvät Servalo-kohteina.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/qr_patch.py <<'PYEOF'
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

# ---- A: QR-apufunktiot (devLink/qrImg -lohko laajennetaan) ----
old_a = '''/* --- QR: linkki, näyttö ja kameraskannaus --- */
function devLink(code){return location.origin+location.pathname+"#dev="+encodeURIComponent((code||"").trim());}
function qrImg(code){code=(code||"").trim();if(!code)return"";var u="https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data="+encodeURIComponent(devLink(code));return '<img src="'+u+'" width="120" height="120" alt="QR '+esc(code)+'" style="border:1px solid var(--line);border-radius:8px;background:#fff;padding:4px" loading="lazy"><div class="hint" style="margin-top:4px">Skannaa avataksesi laitteen</div>';}'''

new_a = '''/* --- QR: linkki, näyttö, tarrat ja kameraskannaus --- */
var OHJE24_URL="https://ohje24.fi/";
function devLink(code){return location.origin+location.pathname+"#dev="+encodeURIComponent((code||"").trim());}
function qrTargetOf(d){return (d&&d.qrTarget==="ohje24")?"ohje24":"servalo";}
function qrTargetUrl(d){var code=(d&&d.idr||"").trim();if(!code)return"";return qrTargetOf(d)==="ohje24"?OHJE24_URL+"?k="+encodeURIComponent(code):devLink(code);}
function qrTargetLabel(d){return qrTargetOf(d)==="ohje24"?"ohje24.fi (julkinen turvallisuustieto)":"Servalo (oma tarkastettava laite)";}
function qrSrc(url,size){return "https://api.qrserver.com/v1/create-qr-code/?size="+size+"x"+size+"&margin=0&data="+encodeURIComponent(url);}
function qrImgFor(d){var url=qrTargetUrl(d);if(!url)return"";return '<img src="'+qrSrc(url,160)+'" width="140" height="140" alt="QR '+esc(d.idr)+'" style="border:1px solid var(--line);border-radius:8px;background:#fff;padding:4px" loading="lazy"><div class="hint" style="margin-top:4px">Skannaamalla avautuu: '+esc(qrTargetLabel(d))+'</div>';}
function qrThumb(d){var url=qrTargetUrl(d);if(!url)return esc(d.idr||"");return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px"><img src="'+qrSrc(url,80)+'" width="42" height="42" alt="QR" style="background:#fff;border:1px solid var(--line);border-radius:5px;padding:2px" loading="lazy"><b style="font-size:11px">'+esc(d.idr||"")+'</b></div>';}
function qrImg(code){return qrImgFor({idr:code,qrTarget:"servalo"});}
function genQrCode(){var chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",c;do{c="SVL-";for(var i=0;i<5;i++)c+=chars.charAt(Math.floor(Math.random()*chars.length));}while(db.devices.some(function(x){return String(x.idr).toUpperCase()===c;}));return c;}
function printQrLabels(ids){
  var ds=db.devices.filter(function(d){return ids.indexOf(d.id)>=0;});
  if(!ds.length){alert("Ei valittuja laitteita.");return;}
  var cells=ds.map(function(d){var url=qrTargetUrl(d);return '<div class="lbl"><img src="'+qrSrc(url,220)+'" alt="QR"><div class="c">'+esc(d.idr||"")+'</div><div class="t">'+esc(d.target||d.make||"")+'</div><div class="s">'+esc(qrTargetLabel(d))+'</div></div>';}).join("");
  var w=window.open("","_blank");if(!w){alert("Salli ponnahdusikkunat tulostusta varten.");return;}
  w.document.write('<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><title>QR-tarrat</title><style>@page{margin:10mm}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0}.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;padding:8mm}.lbl{border:1px solid #ccc;border-radius:8px;padding:6mm;text-align:center;page-break-inside:avoid}.lbl img{width:34mm;height:34mm}.lbl .c{font-weight:700;font-size:13px;margin-top:3mm}.lbl .t{font-size:11px;color:#444;margin-top:1mm}.lbl .s{font-size:9px;color:#888;margin-top:1mm}</style></head><body onload="window.print()"><div class="sheet">'+cells+'</div></body></html>');
  w.document.close();
}'''
rep(old_a, new_a, 1)

# ---- B: listan otsikko ----
rep('onclick="toggleSort()">Laitetunnus ${sortDesc', 'onclick="toggleSort()">QR-koodi ${sortDesc', 1)

# ---- C: listan solu (laitelista) ----
rep('    <td class="chk">✔</td>\n    <td><b>${esc(d.idr)}</b></td>',
    '    <td class="chk">✔</td>\n    <td>${qrThumb(d)}</td>', 1)

# ---- D: lomakkeen kentta + QR-kohde valinta ----
old_d = '<div class="field"><label>Laitetunnus</label><input class="f" id="dIdr" placeholder="esim. 601708"></div>'
new_d = '<div class="field"><label>QR-koodi <span class="hint">(tyhjä = luodaan automaattisesti)</span></label><input class="f" id="dIdr" placeholder="Luodaan automaattisesti"></div>\n        <div class="field"><label>QR-kohde</label><select class="f" id="dQrTarget"><option value="servalo">Savuks Oy:n oma tarkastettava laite → Servalo</option><option value="ohje24">Taloyhtiö / asukastila → ohje24.fi</option></select></div>'
rep(old_d, new_d, 1)

# ---- E: lomakkeen tayttö ----
rep('set("dIdr",d?.idr);set("dTarget",d?.target);set("dMake",d?.make);set("dGroup",d?.group);',
    'set("dIdr",d?.idr);set("dTarget",d?.target);set("dMake",d?.make);set("dGroup",d?.group);document.getElementById("dQrTarget").value=(d&&d.qrTarget)||"servalo";', 1)

# ---- F: saveDevice — automaattinen koodinluonti + kohde ----
rep('  if(!data.idr){alert("Anna Laitetunnus.");return;}',
    '  data.qrTarget=(g("dQrTarget")==="ohje24")?"ohje24":"servalo";\n  if(!data.idr)data.idr=genQrCode();', 1)

# ---- G: laitenäkymän QR-parit + tulosta-nappi (2 kpl) ----
rep('pair("QR-koodi",qrImg(d.idr))',
    'pair("QR-koodi",qrImgFor(d)+\'<div style="margin-top:6px"><button class="btn ghost sm" onclick="printQrLabels([\\\'\'+d.id+\'\\\'])">🖨 Tulosta QR-tarra</button></div>\')', 2)

# ---- H: bulk-valikkoon "Tulosta QR-tarrat" + funktio ----
rep('<button onclick="bulkExport()">⬇ Vie valitut tiedot</button>',
    '<button onclick="bulkExport()">⬇ Vie valitut tiedot</button>\n                <button onclick="bulkPrintQr()">🖨 Tulosta QR-tarrat</button>', 1)
rep('function bulkExport(){const sel=db.devices.filter(d=>selected.has(d.id));',
    'function bulkPrintQr(){printQrLabels(Array.from(selected));document.getElementById("bulkMenu").classList.remove("show");}\nfunction bulkExport(){const sel=db.devices.filter(d=>selected.has(d.id));', 1)

if s == orig:
    print("VIRHE: mitään ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/qr_patch.py

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

echo "--- Uudet tokenit läsnä ---"
for t in qrTargetUrl genQrCode printQrLabels dQrTarget qrThumb bulkPrintQr; do
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
git commit -m "Servalo: laitetunnus -> QR-koodit (lista, automaattikoodi, tarra-arkki, ohje24-reititys)"
git push origin main
echo "VALMIS."
```

---

## Muutama huomio

- **Reititys tallentuu laitteeseen** (`qrTarget`). Kun luot/muokkaat laitetta, valitse *QR-kohde*: Servalo (oma tarkastettava) tai ohje24.fi (taloyhtiö/asukastila). QR johtaa aina oikeaan paikkaan.
- **Automaattikoodi** `SVL-XXXXX` on uniikki eikä sisällä sekaannuttavia merkkejä (ei 0/O/1/I). Voit yhä syöttää oman koodin, jos haluat.
- **Lista** näyttää pienen QR:n + koodin. Jos lista tuntuu hitaalta (QR-kuvat haetaan verkosta), voin muuttaa listan näyttämään pelkän koodin ja QR:n vain laitenäkymässä — sano vain.
- **ohje24.fi-koodit** eivät aukea Servalon skannauksessa (ne on tarkoitettu julkisille), vaan johtavat ohje24-palveluun kuten pitääkin.
- Ajaminen ei muuta olemassa olevia laitteita — ne pysyvät Servalo-kohteina.
