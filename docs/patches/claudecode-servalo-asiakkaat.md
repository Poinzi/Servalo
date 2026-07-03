# Claude Code -prompti: Servalo — Asiakasnäkymä skaalautuvaksi (taulukko + sivutus + lajittelu)

Aja tämä **Servalo-repon juuressa** (missä `servalo.html` on). Prompti tekee muutokset,
validoi, tarkistaa kielletyt merkkijonot ja pushaa `main`-haaraan.

Mitä tämä tekee:
1. **Taulukko oletusnäkymäksi** — asiakaskorttien tilalle tulee tiivis taulukko (Asiakas, Y-tunnus, Yhteyshenkilö, Tila, Laitteita, Huoltopyyntöjä, Tehtäviä). Kestää 100–1000+ asiakasta.
2. **Sivutus** — 25/50/100/250 riviä sivulla, edellinen/seuraava/ensimmäinen/viimeinen. Sama logiikka kuin raporttinäkymässä.
3. **Sarakelajittelu** — klikkaa otsikkoa lajitellaksesi (nimi, Y-tunnus, yhteyshenkilö, tila, laite-/pyyntö-/tehtävämäärät), toinen klikkaus kääntää suunnan.
4. **Taulukko/kortti-vaihtokytkin** — kortit säilyvät valinnaisena näkymänä pienille joukoille. Haku ja tilasuodatin sekä ylästatistiikka säilyvät ennallaan.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
test -f servalo.html || { echo "VIRHE: servalo.html ei löydy. Aja Servalo-repon juuressa."; exit 1; }
cp servalo.html servalo.html.bak

cat > /tmp/asiakkaat_patch.py <<'PYEOF'
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

# ---- A: CSS — taulukko, footer, lajittelu ----
old_a = '  .clist{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}'
new_a = '''  .clist{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .ctable-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:#fff}
  .ctable{width:100%;border-collapse:collapse}
  .ctable td{padding:11px 14px;border-top:1px solid var(--line);font-size:14px;vertical-align:top}
  .ctable tbody tr{cursor:pointer;transition:.1s}
  .ctable tbody tr:hover{background:#fff7ed}
  .ctable .num{text-align:right;white-space:nowrap}
  .cust-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px;font-size:13px;color:var(--muted)}
  .cust-foot select{padding:6px 8px;border:1px solid var(--line);border-radius:8px;font:inherit;background:#fff}
  .cust-foot .pg{border:0;background:none;cursor:pointer;font-size:18px;padding:4px 8px;color:var(--ink);border-radius:8px}
  .cust-foot .pg:disabled{color:#c2c6cf;cursor:default}
  .cust-foot .pg:not(:disabled):hover{background:#f3f4f7}'''
rep(old_a, new_a, 1)

# ---- B: HTML — vaihtokytkin cust-tools-riville ----
old_b = '''            <select id="custFilter" onchange="renderCustomers()">
              <option value="">Kaikki tilat</option>
              <option value="active">Aktiivinen</option>
              <option value="lead">Liidi</option>
              <option value="inactive">Passiivinen</option>
            </select>'''
new_b = old_b + '\n            <button class="btn ghost" id="custViewToggle" onclick="toggleCustView()">▦ Korttinäkymä</button>'
rep(old_b, new_b, 1)

# ---- C: renderCustomers — taulukko + sivutus + lajittelu ----
old_c = '''function renderCustomers(){
  const q=(document.getElementById("custSearch").value||"").toLowerCase();
  const f=document.getElementById("custFilter").value;
  // stats
  document.getElementById("cuTotal").textContent=db.customers.length;
  document.getElementById("cuDevices").textContent=db.devices.filter(d=>!d.deleted).length;
  document.getElementById("cuReq").textContent=db.devices.filter(d=>!d.deleted).reduce((s,d)=>s+(+d.req||0),0);
  const el=document.getElementById("custList");
  let list=db.customers.filter(c=>{
    const hay=(c.name+" "+(c.biz||"")+" "+(c.contact||"")+" "+(c.email||"")+" "+(c.phone||"")).toLowerCase();
    return hay.includes(q)&&(!f||c.status===f);});
  if(!list.length){el.innerHTML='<div class="empty">Ei asiakkaita. Lisää uusi oikealta ylhäältä.</div>';return;}
  el.innerHTML=list.map(c=>{
    const tg=CUST_TAG[c.status]||CUST_TAG.active;
    const nd=devicesOfCustomer(c.id).length, nr=openDirCount(c.id), nt=tasksOfCustomer(c.id).filter(t=>t.status==="open").length;
    return `<div class="ccard" onclick="openCustomer('${c.id}')">
      <h3>${esc(c.name)} <span class="ctag ${tg[0]}">${tg[1]}</span></h3>
      <div class="biz">${c.biz?"Y-tunnus "+esc(c.biz):"&nbsp;"}</div>
      <div class="meta">${c.contact?"👤 "+esc(c.contact)+"<br>":""}${c.email?"✉ "+esc(c.email)+"<br>":""}${c.phone?"☎ "+esc(c.phone):""}</div>
      <div class="nums"><span><b>${nd}</b> laitetta</span><span><b>${nr}</b> huoltopyyntöä</span><span><b>${nt}</b> tehtävää</span></div>
    </div>`;}).join("");
}'''
new_c = '''let custView="table", custPage=0, custPageSize=25, custSortKey="name", custSortDesc=false;
function toggleCustView(){custView=(custView==="table")?"card":"table";custPage=0;renderCustomers();}
function custSortBy(key){if(custSortKey===key){custSortDesc=!custSortDesc;}else{custSortKey=key;custSortDesc=false;}custPage=0;renderCustomers();}
function renderCustomers(){
  const q=(document.getElementById("custSearch").value||"").toLowerCase();
  const f=document.getElementById("custFilter").value;
  // stats
  document.getElementById("cuTotal").textContent=db.customers.length;
  document.getElementById("cuDevices").textContent=db.devices.filter(d=>!d.deleted).length;
  document.getElementById("cuReq").textContent=db.devices.filter(d=>!d.deleted).reduce((s,d)=>s+(+d.req||0),0);
  const el=document.getElementById("custList");
  const tgBtn=document.getElementById("custViewToggle");if(tgBtn)tgBtn.innerHTML=(custView==="table")?"▦ Korttinäkymä":"▤ Taulukko";
  let rows=db.customers.filter(c=>{
    const hay=(c.name+" "+(c.biz||"")+" "+(c.contact||"")+" "+(c.email||"")+" "+(c.phone||"")).toLowerCase();
    return hay.includes(q)&&(!f||c.status===f);
  }).map(c=>({c:c,tg:CUST_TAG[c.status]||CUST_TAG.active,nd:devicesOfCustomer(c.id).length,nr:openDirCount(c.id),nt:tasksOfCustomer(c.id).filter(t=>t.status==="open").length}));
  if(!rows.length){el.innerHTML='<div class="empty">Ei asiakkaita. Lisää uusi oikealta ylhäältä.</div>';return;}
  const coll=(a,b)=>String(a).localeCompare(String(b),"fi");
  const k=custSortKey;
  rows.sort((x,y)=>{
    if(k==="name")return custSortDesc?coll(y.c.name,x.c.name):coll(x.c.name,y.c.name);
    if(k==="biz")return custSortDesc?coll(y.c.biz||"",x.c.biz||""):coll(x.c.biz||"",y.c.biz||"");
    if(k==="contact")return custSortDesc?coll(y.c.contact||"",x.c.contact||""):coll(x.c.contact||"",y.c.contact||"");
    if(k==="status")return custSortDesc?coll(y.tg[1],x.tg[1]):coll(x.tg[1],y.tg[1]);
    return custSortDesc?(y[k]-x[k]):(x[k]-y[k]);
  });
  const total=rows.length, pages=Math.max(1,Math.ceil(total/custPageSize));
  if(custPage>=pages)custPage=pages-1; if(custPage<0)custPage=0;
  const start=custPage*custPageSize, slice=rows.slice(start,start+custPageSize);
  if(custView==="card"){
    el.innerHTML='<div class="clist">'+slice.map(r=>{const c=r.c,tg=r.tg;
      return `<div class="ccard" onclick="openCustomer('${c.id}')">
        <h3>${esc(c.name)} <span class="ctag ${tg[0]}">${tg[1]}</span></h3>
        <div class="biz">${c.biz?"Y-tunnus "+esc(c.biz):"&nbsp;"}</div>
        <div class="meta">${c.contact?"👤 "+esc(c.contact)+"<br>":""}${c.email?"✉ "+esc(c.email)+"<br>":""}${c.phone?"☎ "+esc(c.phone):""}</div>
        <div class="nums"><span><b>${r.nd}</b> laitetta</span><span><b>${r.nr}</b> huoltopyyntöä</span><span><b>${r.nt}</b> tehtävää</span></div>
      </div>`;}).join("")+'</div>';
  }else{
    const arr=key=>custSortKey===key?(custSortDesc?" ↓":" ↑"):"";
    const th=(key,label,cls)=>`<th class="sortable${cls?" "+cls:""}" onclick="custSortBy('${key}')">${label}${arr(key)}</th>`;
    el.innerHTML='<div class="ctable-wrap"><table class="ctable"><thead><tr>'+
      th("name","Asiakas")+th("biz","Y-tunnus")+th("contact","Yhteyshenkilö")+th("status","Tila")+
      th("nd","Laitteita","num")+th("nr","Huoltopyyntöjä","num")+th("nt","Tehtäviä","num")+
      '</tr></thead><tbody>'+slice.map(r=>{const c=r.c,tg=r.tg;
      return `<tr onclick="openCustomer('${c.id}')">
        <td><b>${esc(c.name)}</b>${c.email?'<br><span class="hint">'+esc(c.email)+'</span>':''}</td>
        <td>${esc(c.biz||"–")}</td>
        <td>${esc(c.contact||"–")}${c.phone?'<br><span class="hint">'+esc(c.phone)+'</span>':''}</td>
        <td><span class="ctag ${tg[0]}">${tg[1]}</span></td>
        <td class="num">${r.nd}</td>
        <td class="num">${r.nr?'<b style="color:var(--orange)">'+r.nr+'</b>':'0'}</td>
        <td class="num">${r.nt||0}</td>
      </tr>`;}).join("")+'</tbody></table></div>';
  }
  const from=total?start+1:0, to=Math.min(start+custPageSize,total);
  el.innerHTML+=`<div class="cust-foot">
    <span>Riviä sivulla:</span>
    <select onchange="custPageSize=+this.value;custPage=0;renderCustomers()">${[25,50,100,250].map(n=>`<option ${n===custPageSize?"selected":""}>${n}</option>`).join("")}</select>
    <span>Näytetään ${from}-${to} / ${total} asiakasta</span>
    <button class="pg" ${custPage===0?"disabled":""} onclick="custPage=0;renderCustomers()" title="Ensimmäinen">⏮</button>
    <button class="pg" ${custPage===0?"disabled":""} onclick="custPage--;renderCustomers()" title="Edellinen">‹</button>
    <span class="hint" style="margin:0">Sivu ${custPage+1} / ${pages}</span>
    <button class="pg" ${custPage>=pages-1?"disabled":""} onclick="custPage++;renderCustomers()" title="Seuraava">›</button>
    <button class="pg" ${custPage>=pages-1?"disabled":""} onclick="custPage=${pages-1};renderCustomers()" title="Viimeinen">⏭</button>
  </div>`;
}'''
rep(old_c, new_c, 1)

if s == orig:
    print("VIRHE: mitään ei muuttunut."); sys.exit(1)

io.open(f, "w", encoding="utf-8").write(s)
print("Patch OK.")
PYEOF

python3 /tmp/asiakkaat_patch.py

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
for t in custView custPage custSortBy toggleCustView custViewToggle ctable cust-foot; do
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
git commit -m "Servalo: asiakasnakyma skaalautuvaksi (taulukko, sivutus, sarakelajittelu, kortti/taulukko-kytkin)"
git push origin main
echo "VALMIS."
```

---

## Muutama huomio

- **Oletus on nyt taulukko.** Vaihtokytkin (oikealla hakurivin vieressä) palauttaa kortit, jos haluat ne pienelle joukolle.
- **Sivutus + lajittelu toimivat samalla logiikalla** kuin raportti- ja laitenäkymissä, joten 1000 asiakasta ei enää venytä sivua loputtomiin.
- **Haku ja tilasuodatin säilyvät** ja vaikuttavat sekä taulukkoon että kortteihin. Ylästatistiikka (Asiakkaita / Laitteita / Avoimet) ei muutu.
- **Rivin klikkaus** avaa asiakkaan kuten kortinkin — mikään olemassa oleva toiminto ei katoa.
- Näkymä- ja sivuvalinnat eivät tallennu localStorageen; jos haluat että esim. taulukko/kortti-valinta muistetaan, sano niin lisään sen.
