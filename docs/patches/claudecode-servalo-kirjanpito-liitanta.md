# Claude Code -prompti: Kirjanpito Servalon rinnalle (vain pääkäyttäjä)

Aja **Servalo-repon juuressa**. Tuo kevytkirjanpito-sovellus **saman palvelimen alle** omana
sivunaan `kirjanpito.html`, ja rajaa pääsy niin että **vain pääkäyttäjä (admin)** näkee
käynnistimen Servalossa. Palvelin ei koskaan tarjoile kirjanpitoa julkisella ohje24-domainilla.

> **Turvallisuus rehellisesti:** Servalon roolikirjautuminen on selainpuolen tarkistus, joten
> käynnistimen piilotus muilta on vain kosmetiikkaa. **Varsinainen lukko on kirjanpidon oma
> salasana + AES-GCM-salaus** (määritelty Vaihe 1:n speksissä). Siksi: kun kirjanpito on julkaistu,
> **pääkäyttäjän tulee avata `/kirjanpito` heti ja luoda salasana ensimmäisenä**, ennen kuin kukaan
> muu ehtii. Ilman salasanaa data on lukukelvotonta.

## Ajojärjestys
1. **Vaihe 1** — rakenna `kirjanpito.html` (alla oleva speksi). Älä committaa vielä.
2. **Vaihe 2** — aja liitäntäpatch (bash-lohko). Se kytkee reitin + admin-käynnistimen,
   validoi ja tekee yhden commitin (myös uusi `kirjanpito.html` mukaan).

---

## Vaihe 1 — Rakenna `kirjanpito.html`

Luo repon juureen **uusi tiedosto `kirjanpito.html`** seuraavan speksin mukaan. Yksi itsenäinen
tiedosto (HTML+CSS+vanilla JS samassa), ei ulkoisia kirjastoja, toimii offline. **Kaikki demodata
fiktiivistä.** Yritys on Savuks Oy. **Älä** käytä merkkijonoja `PAP Group`, `idrcloud`, `Prosero`,
`Kramp`, `jari.mattila@savuks.fi` tai puhelinnumeroa muodossa `0443665638` (jos numero tarvitaan,
kirjoita välilyönnillä `044 3665638`).

### Rooli ja tavoite
Rakenna suomalaiselle pienelle osakeyhtiölle (Savuks Oy) tarkoitettu **kevyt kirjanpito-ohjelma**.
Käyttäjä ei ole kirjanpitäjä ja haluaa mahdollisimman helpon työnkulun: laskut, kulut, palkat ja
raportit napsuttelemalla. **Tärkein rajoite:** ohjelma laskee ja kirjaa, mutta **ei tee virallisia
ilmoituksia puolestasi** — ALV:ia ei lähetetä OmaVeroon eikä palkkoja tulorekisteriin. Yhtiö vastaa
kirjanpidon, tilinpäätöksen ja veroilmoituksen oikeellisuudesta; kirjanpitäjä tarkistaa.

### Tekniset vaatimukset
- **Yksi tiedosto:** `kirjanpito.html` (HTML + CSS + vanilla JS). Ei riippuvuuksia, toimii offline.
- **Tallennus:** `localStorage`, avain `kevytkirjanpito_v2`. Koko tietokanta yksi JSON-objekti, **salattuna levossa**.
- **Kirjautuminen:** salasana kysytään aina avattaessa (ks. Lukitus ja salaus).
- **Varmuuskopio:** vie/tuo koko tietokanta JSON-tiedostona. Varoita käyttäjää tyhjentämään backendin API-token localStoragesta ennen JSON:n jakamista.
- **Kieli:** suomi. Desimaalierotin pilkku, euroformaatti `fi-FI`.
- **Kaksinkertainen kirjanpito:** jokainen tapahtuma tuottaa debet=kredit -tositteen; debetin ja kreditin on aina täsmättävä.

### Lukitus ja salaus (kirjautuminen)
- Ensiavaus: pyydä **luomaan salasana** (väh. 6 merkkiä, kahdesti). Jos localStoragessa on vanhaa salaamatonta dataa, pyydä salasana ja salaa se (migraatio).
- Joka avauskerralla **lukitusnäyttö**, joka peittää kaiken kunnes oikea salasana annetaan. Vasta sitten sovellus renderöityy.
- **Salaus:** johda avain salasanasta `PBKDF2`:lla (SHA-256, ~150 000 kierrosta, satunnainen suola), salaa koko JSON `AES-GCM`illa (WebCrypto `crypto.subtle`, ei kirjastoja). Tallenna localStorageen vain kirjekuori `{enc:1, salt, iv, ct}` (base64).
- Jokainen tallennus salaa uudelleen. Avain vain muistissa istunnon ajan.
- UI: **🔒 Lukitse nyt** (käytännössä `location.reload()`), **Vaihda salasana** (uusi avain + tallennus uudelleen), ja Asetuksissa varoitus: *jos unohdat salasanan, salattuja tietoja ei voi palauttaa — ota varmuuskopio talteen.*
- Jos selain ei tue `crypto.subtle`ä, varoita (avaa HTTPS-osoitteesta / uudemmalla selaimella).

### Tietomalli (JSON)
```
{
  company:{name,ytunnus,address,city,iban,bic,email,terms,fyStart,fyEnd,
           ovt,operatorId,backendUrl,backendToken,apiKey},
  vatRates:[25.5,13.5,10,0],
  accounts:[{code,name,type}],        // type: vastaavaa|vastattavaa|tulot|menot
  customers:[{id,name,ytunnus,vat,country,address,city,email,ovt,operatorId,prices:{}}],
  suppliers:[{...}],
  employees:[{id,name,type,withhold,accrualRate,...}],  // type: kk|tunti
  products:[{id,code,name,price,vat,unit}],   // price = netto à-hinta
  sales:[{id,number,partyId,date,due,rows,paid,vatMode,vatReason}],
  purch:[{id,number,sellerName,businessId,vat,country,date,expAcc,pay,rows,image,paid,due}],
  payroll:[{id,number,empId,empName,type,period,date,gross,withhold,
            empPension,empUnemp,net,erTotal,totalCost,...}],
  travel:[...],
  entries:[{id,num,source,date,desc,lines:[{account,debit,credit}]}],
  counters:{sales,purch,entry,pay,product}
}
```
`rows` (laskurivi): `{desc,qty,price,vat,prodId}`. Rivin summat: `netto=qty*price`, `alv=netto*vat/100`.

### Suomen ALV-kannat 2026
Yleinen **25,5 %**, alennettu **13,5 %** (elintarvikkeet, ravintola), alennettu **10 %** (kirjat, liikunta, majoitus, henkilökuljetus), **0 %** (veroton myynti).

### Vakiotilit (tilikartta)
Vähintään: myyntisaamiset 1700, ALV-saatava 1763, pankki 1900, käteinen 1910, ostovelat 2251, suoritettava ALV 2939, oma pääoma / yksityistili 2960, myyntitili 3000-sarja, ostot/kulut 4000-sarja, palkat 5000-sarja. Anna valmis suomalainen tilikartta, jota voi muokata.

### Toiminnot (välilehdet)
1. **Kojelauta:** tilikauden liikevaihto, kulut, tulos, pankkisaldo, avoimet myynti-/ostosaamiset.
2. **Myynti:** luo myyntilasku, valitse asiakas, lisää rivit. **ALV-valinta laskutasolla:** "ALV" tai "Veroton (ALV 0 %)". 0 %:ssa pakota rivit 0 %:iin ja kysy verottomuuden peruste (AVL-viittaus, esim. 8 c §, 72 a §, 65 §, 70 §, 3 §, 34 §). Tulosta lasku, lataa Finvoice-XML, merkitse maksetuksi.
3. **Tuotteet:** tuotehinnasto (koodi, nimi, netto à-hinta, ALV %, yksikkö) + **asiakaskohtaiset hinnat** (`prices:{tuoteId:hinta}`). Laskuriville tuote pudotusvalikosta → kuvaus, à-hinta ja ALV täyttyvät (asiakaskohtainen voittaa oletuksen). Asiakkaan vaihtuessa rivit hinnoitellaan uudelleen.
4. **Ostot & kuitit:** kirjaa ostolasku/kuitti, valitse kulutili + maksutapa, liitä kuvatiedosto. **Hae verkkolaskut** -nappi hakee saapuvat backendistä. Tuo saapuva Finvoice-XML ostoksi. Chat-tuonti (JSON) kuiteille.
5. **Matkat:** kilometrikorvaukset ja päivärahat.
6. **Palkat:** kk-/tuntipalkka, ennakonpidätys (verokortti-%), työntekijän eläke + työttömyysvakuutus, työnantajan sivukulut, lomapalkka ja lomaraha. Verokortin/palkka-ajon kuvaliitteet. **HUOM:** eläke-/vakuutusprosentit likiarvoja — käyttäjä vahvistaa omasta yhtiöstään, tulorekisteri-ilmoitus käsin.
7. **Tositteet / päiväkirja:** kaikki viennit, käsin lisättävä tosite.
8. **Raportit:** tuloslaskelma, tase, ALV-erittely, tilikohtaiset saldot. Kausi valittavissa. **📊 Vie kirjanpitäjälle (Excel)** -nappi (alla).
9. **Asetukset:** yritystiedot, tilikausi, ALV-kannat, verkkolaskuosoite (OVT + välittäjä), backendin osoite + token, AI-avain.

### Kirjanpitäjän Excel-vienti
Nappi Raporteissa. Tuottaa **yhden .xls-tiedoston** (SpreadsheetML 2003 -XML, ei kirjastoja, selaimessa) välilehdillä: Kansilehti, Päiväkirja, Tilikohtaiset saldot, Myyntilaskut, Ostolaskut, Palkat, ALV-erittely, Avoimet saamiset ja velat, **Jaksotusten tarkistuslista** (poistot, siirtosaamiset/-velat, lomapalkkavaraus, tuloverovelka, varaston muutos, ALV-/pankki-/palkkatäsmäytys). Kansilehdellä yritystiedot, kausi ja vastuunrajaus. Escape erikoismerkit, numerot Number-tyyppinä, välilehtien nimet ≤31 merkkiä ilman `: \ / ? * [ ]`.

### Verkkolasku (Finvoice 3.0)
- **Lähtevät:** myyntilaskusta Finvoice 3.0 -XML. OVT + välittäjä, pilkkudesimaalit, päivämäärät `Format="CCYYMMDD"`, viitenumero (7-3-1-tarkiste). Veroton myynti: peruste `InvoiceFreeText`-kenttään.
- **Saapuvat:** tuo Finvoice-XML ostolaskuksi.
- Savuks Oy: OVT **003734656825**, operaattori/välittäjä **003708599126** (OpenText Oy), Tyyppi 0216. Nämä käyttäjä vahvistaa omalta operaattoriltaan (pidä muokattavina Asetuksissa).

### Verkkolasku-backend (valinnainen, EI osa tätä liitäntää)
Speksin backend (Node/Express, Railway) on erillinen ja valinnainen. Tässä vaiheessa **riittää
pelkkä `kirjanpito.html`** — "Hae verkkolaskut" ja jaettu asiakasrekisteri toimivat vain jos
backend on erikseen pystytetty. Jätä backend-osoite/token tyhjäksi oletuksena.

### Laadunvarmistus (Vaihe 1)
Tarkista JS-syntaksi, varmista debet=kredit, ja että tuotetut XML/Excel ovat hyvin muodostettuja.
Testaa ALV 0 % -lasku (netto=summa, ALV=0, peruste mukana) ja asiakashinnoittelu (asiakaskohtainen voittaa oletuksen).

### Vastuunrajaus (näytä käyttäjälle sovelluksessa)
Työkalu laskee ja välittää; ei korvaa kirjanpitäjää. Yhtiö vastaa oikeellisuudesta. ALV-ilmoitus OmaVeroon ja palkkojen tulorekisteri-ilmoitus tehdään käsin. Sivukuluprosentit vahvistetaan omasta eläke-/vakuutusyhtiöstä.

---

## Vaihe 2 — Liitäntäpatch (aja tämä vasta kun `kirjanpito.html` on luotu)

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
test -f server.js   || { echo "VIRHE: server.js ei löydy."; exit 1; }
test -f kirjanpito.html || { echo "VIRHE: kirjanpito.html puuttuu — tee Vaihe 1 ensin."; exit 1; }
cp servalo.html servalo.html.bak
cp server.js server.js.bak

cat > /tmp/kb_sv.py <<'PYEOF'
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

# SV1: käynnistin-nappi Hallinta-valikkoon (piilossa oletuksena)
SV1_OLD='        <button id="navAdmin" data-go="admin">⚙ Käyttäjät & asetukset</button>'
SV1_NEW=SV1_OLD+'\n        <button id="navKirjanpito" onclick="openKirjanpito()" style="display:none">📒 Kirjanpito</button>'

# SV2: näytä käynnistin vain adminille
SV2_OLD='  show("navAdmin", role()==="admin");'
SV2_NEW=SV2_OLD+'\n  show("navKirjanpito", role()==="admin");'

# SV3: avausfunktio (tarkistaa roolin myös klikattaessa)
SV3_OLD='function toggleMfa(on){currentUser.mfa=on;save();renderSettings();}'
SV3_NEW=SV3_OLD+'\nfunction openKirjanpito(){\n  if(role()!=="admin"){alert("Kirjanpito on vain pääkäyttäjälle.");return;}\n  window.open("/kirjanpito","_blank","noopener");\n}'

patch(FN,[(SV1_OLD,SV1_NEW,1),(SV2_OLD,SV2_NEW,1),(SV3_OLD,SV3_NEW,1)])
PYEOF

cat > /tmp/kb_srv.py <<'PYEOF'
import io, sys
FN=sys.argv[1] if len(sys.argv)>1 else "server.js"
def patch(fn,edits):
    s=io.open(fn,encoding="utf-8").read();orig=s
    for old,new,n in edits:
        c=s.count(old)
        if c!=n:
            print("VIRHE: ankkuri %d/%d:\n  %s"%(c,n,old[:90]));sys.exit(1)
        s=s.replace(old,new)
    if s==orig:print("VIRHE: ei muuttunut");sys.exit(1)
    io.open(fn,"w",encoding="utf-8").write(s);print("Patch OK: %s"%fn)

SRV_OLD='  if (urlPath === "/k" || urlPath.startsWith("/k/")) urlPath = "/ohje24.html";'
SRV_NEW=SRV_OLD+'\n  // Kirjanpito: vain sisainen sovellus, ei koskaan julkisella ohje24-domainilla.\n  if (isPublic && /kirjanpito/i.test(urlPath)) urlPath = "/ohje24.html";\n  else if (urlPath === "/kirjanpito") urlPath = "/kirjanpito.html";'

patch(FN,[(SRV_OLD,SRV_NEW,1)])
PYEOF

python3 /tmp/kb_sv.py servalo.html
python3 /tmp/kb_srv.py server.js

echo "--- JS-syntaksi: servalo.html + kirjanpito.html ---"
for f in servalo.html kirjanpito.html; do
node -e '
const fs=require("fs");const h=fs.readFileSync(process.argv[1],"utf8");
const re=/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g;
let m,i=0,ok=true;
while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){ok=false;console.log(process.argv[1]+" lohko "+i+" FAIL: "+e.message);}}
console.log(process.argv[1]+": "+(ok?("JS OK ("+i+" lohkoa)"):"JS FAILED"));process.exit(ok?0:1);
' "$f" || exit 1
done
echo "--- server.js syntaksi ---"
node --check server.js && echo "server.js: syntax OK"

echo "--- Uudet palaset ---"
grep -qF 'id="navKirjanpito"' servalo.html && echo "OK: käynnistin" || { echo "PUUTTUU"; exit 1; }
grep -qF 'show("navKirjanpito", role()==="admin")' servalo.html && echo "OK: admin-gating" || { echo "PUUTTUU"; exit 1; }
grep -qF 'function openKirjanpito()' servalo.html && echo "OK: avausfunktio" || { echo "PUUTTUU"; exit 1; }
grep -qF 'if (isPublic && /kirjanpito/i.test(urlPath))' server.js && echo "OK: julkinen esto" || { echo "PUUTTUU"; exit 1; }

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" servalo.html server.js kirjanpito.html; then
  echo "VIRHE: kielletty merkkijono löytyi — keskeytetään."; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git commit + push ---"
rm -f servalo.html.bak server.js.bak
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Kirjanpito: erillinen /kirjanpito-sivu Servalon rinnalle, käynnistin vain pääkäyttäjälle; ei julkisella ohje24-domainilla"
git push origin main
echo "VALMIS."
```

---

## Mitä muuttuu
- Uusi tiedosto **`kirjanpito.html`** (oma salasana + AES-salaus), tarjoillaan osoitteessa **`/kirjanpito`** samalla palvelimella.
- Servalon **Hallinta ▾** -valikkoon **📒 Kirjanpito** -käynnistin, joka näkyy **vain admin-roolilla** ja avaa sivun uuteen välilehteen.
- **server.js**: `/kirjanpito` → `kirjanpito.html` sisäisellä domainilla; julkisella **ohje24**-domainilla mikä tahansa `kirjanpito`-polku ohjautuu turvallisesti julkiseen QR-sivuun (ei koskaan näy asukkaille).

## Turvallisuus
Käynnistimen piilotus ei ole todellinen suoja (selainpuolen rooli). **Todellinen lukko on
kirjanpidon salasana + AES-GCM.** Toimi näin heti julkaisun jälkeen:
1. Kirjaudu Servaloon **pääkäyttäjänä** → Hallinta ▾ → 📒 Kirjanpito.
2. **Luo vahva salasana ensimmäisellä avauksella** (ennen muita). Ota talteen — unohtunutta ei voi palauttaa.
3. Ota säännöllinen JSON-varmuuskopio (Asetukset → Varmuuskopio).

## Testattu (liitäntä)
Liitäntäpatch ajettu hiekkalaatikossa oikeisiin `servalo.html`- ja `server.js`-kopioihin:
ankkurit osuivat (servalo 3×n=1, server 1×n=1), servalo JS OK, `node --check server.js` OK,
uudet palaset läsnä, kielletyt merkkijonot puhtaat. `kirjanpito.html` rakennetaan Vaihe 1:ssä ja
sen JS validoidaan Vaihe 2:n bash-lohkossa ennen committia.
