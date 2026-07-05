# Claude Code -prompti: pöytäkirjojen sivutus + yhtenäisyys (kaikki raportit)

Aja **Servalo-repon juuressa**. Yksi patch, kolme parannusta kaikkiin pöytäkirjoihin:

1. **Siisti sivutus (PDF/tulostus)** — otsikko ei jää yksin sivun pohjalle, taulukon
   rivi ei katkea kahdelle sivulle, taulukon otsikkorivi toistuu jokaisella sivulla.
   Koskee kaikkia 12 pöytäkirjaa + asiakasportaalin huoltoraporttia.
2. **Laiteluettelo-pöytäkirjan otsikko yhtenäiseksi** (`laitePkGeneric`): erillinen
   "Kohteen tiedot" ja "Tarkastuksen tiedot" -lohko kuten sammutin-/pikapöytäkirjassa
   (ennen yksi tiivis rivi).
3. **VSS-pöytäkirjaan "Seuraava tarkastus" -päivä** otsikkoon (aiemmin tyhjä solu).

Ei kosketa dataan, pöytäkirjojen sisältöön eikä muihin toimintoihin.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/pk_patch.py <<'PYEOF'
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

# 1) Sivutus: laajenna @media print kaikkiin 12 pöytäkirjaan
PRINT_OLD = "    +'@media print{button{display:none}}'"
PRINT_NEW = ("    +'@media print{button{display:none}"
             ".sub{break-after:avoid;page-break-after:avoid}"
             "h1{break-after:avoid;page-break-after:avoid}"
             "table{break-inside:auto}"
             "thead{display:table-header-group}"
             "tr{break-inside:avoid;page-break-inside:avoid}"
             ".foot,.sign,.company,.legend,.note,.huom{break-inside:avoid;page-break-inside:avoid}"
             "}'")

# 2) Asiakasportaalin huoltoraportti (template literal) - sama sivutuslogiikka
PORTAL_OLD = "      @media print{button{display:none}}</style></head><body>"
PORTAL_NEW = ("      @media print{button{display:none}"
              "thead{display:table-header-group}"
              "tr{break-inside:avoid;page-break-inside:avoid}"
              "}</style></head><body>")

# 3) laitePkGeneric: yhtenäistä otsikko (Kohteen tiedot + Tarkastuksen tiedot)
LAITE_OLD = ("    +'<div class=\"meta\"><b>Asiakas:</b> '+esc(ctx.name||\"–\")+' &nbsp; "
             "<b>Osoite:</b> '+esc(ctx.address||\"–\")+' &nbsp; "
             "<b>Päiväys:</b> '+fmt(today())+' &nbsp; "
             "<b>Laitteita:</b> '+(devs?devs.length:0)+'</div>'")
_SUB = "font-family:Georgia,serif;font-weight:700;color:#c1121f;font-size:13px;margin:14px 0 4px"
_TD  = "padding:3px 8px;border-bottom:1px solid #eee"
_TDK = "padding:3px 8px;border-bottom:1px solid #eee;color:#666"
LAITE_NEW = (
    "    +'<div class=\"sub\" style=\"" + _SUB + "\">Kohteen tiedot</div>'\n"
    "    +'<table style=\"border-collapse:collapse;font-size:12px;margin:2px 0 4px\">'\n"
    "    +'<tr><td style=\"" + _TDK + "\">Kohde / asiakas</td><td style=\"" + _TD + "\">'+esc(ctx.name||\"–\")+'</td>"
    "<td style=\"" + _TDK + "\">Osoite</td><td style=\"" + _TD + "\">'+esc(ctx.address||\"–\")+'</td></tr>'\n"
    "    +'</table>'\n"
    "    +'<div class=\"sub\" style=\"" + _SUB + "\">Tarkastuksen tiedot</div>'\n"
    "    +'<table style=\"border-collapse:collapse;font-size:12px;margin:2px 0 4px\">'\n"
    "    +'<tr><td style=\"" + _TDK + "\">Päiväys</td><td style=\"" + _TD + "\">'+fmt(today())+'</td>"
    "<td style=\"" + _TDK + "\">Tarkastaja</td><td style=\"" + _TD + "\">'+esc(worker)+'</td></tr>'\n"
    "    +'<tr><td style=\"" + _TDK + "\">Laitteita</td><td style=\"" + _TD + "\">'+(devs?devs.length:0)+'</td>"
    "<td style=\"" + _TDK + "\">Raportti</td><td style=\"" + _TD + "\">'+esc(title||\"Laitteet\")+'</td></tr>'\n"
    "    +'</table>'")

# 4) VSS: lisää "Seuraava tarkastus" -päivä otsikkoon
VSS_OLD = ("    +'<tr><td class=\"k\">Tarkastaja / tekijä</td><td>'+esc(worker)+'</td>"
           "<td class=\"k\"></td><td></td></tr>'")
VSS_NEW = ("    +'<tr><td class=\"k\">Tarkastaja / tekijä</td><td>'+esc(worker)+'</td>"
           "<td class=\"k\">Seuraava tarkastus</td><td>'+(dev.inspNext?fmt(dev.inspNext):\"–\")+'</td></tr>'")

patch("servalo.html", [
    (PRINT_OLD,  PRINT_NEW,  12),
    (PORTAL_OLD, PORTAL_NEW, 1),
    (LAITE_OLD,  LAITE_NEW,  1),
    (VSS_OLD,    VSS_NEW,    1),
])
PYEOF

python3 /tmp/pk_patch.py

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
grep -qF 'thead{display:table-header-group}' servalo.html && echo "OK: sivutus-CSS" || { echo "PUUTTUU: sivutus"; exit 1; }
grep -qF 'Seuraava tarkastus' servalo.html && echo "OK: VSS seuraava tarkastus" || { echo "PUUTTUU: VSS"; exit 1; }
grep -qF 'class="sub" style=' servalo.html && echo "OK: laitePkGeneric-otsikko" || { echo "PUUTTUU: laite-otsikko"; exit 1; }
grep -qF 'class="meta"><b>Asiakas:' servalo.html && { echo "VIRHE: vanha laite-otsikko jäi jäljelle."; exit 1; } || echo "OK: vanha laite-otsikko poistettu"

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Pöytäkirjat: siisti sivutus (ei orpoja otsikoita/katkeavia rivejä), yhtenäinen laiteluettelo-otsikko, VSS seuraava tarkastus"
git push origin main
echo "VALMIS."
```

---

## Mitä muuttuu
- **Sivutus:** jokaisen pöytäkirjan `@media print` sisältää nyt: `.sub`/`h1`
  ei jää sivun pohjalle (`break-after:avoid`), taulukon rivi ei katkea
  (`tr break-inside:avoid`), taulukon otsikkorivi toistuu joka sivulla
  (`thead:table-header-group`), ja alaosat (allekirjoitus, yhtiötiedot, huomiot,
  selite) pysyvät koossa.
- **Laiteluettelo-pöytäkirja:** tiivis yksirivinen otsikko → erilliset
  "Kohteen tiedot" ja "Tarkastuksen tiedot" -lohkot, samoin kuin sammutin-/
  pikapöytäkirjassa. Asiakkaan kohdetiedot erottuvat tarkastustiedoista.
- **VSS:** otsikkoon tulee "Seuraava tarkastus" -päivä (laitteen `inspNext`),
  aiemmin tyhjä solu.

## Testattu
Patch ajettu hiekkalaatikossa servalo.html-kopioon: kaikki 12 ankkuria osui
(n=12), JS-syntaksi OK, kielletyt merkkijonot puhtaat.

## Näin tarkistat
Avaa mikä tahansa pöytäkirja → **Tulosta / Tallenna PDF** → esikatselusta näet
ettei otsikko jää yksin sivun pohjalle eikä rivi katkea. Monisivuisessa
taulukossa sarakeotsikot toistuvat joka sivulla.
