# Claude Code -prompti: Pelastussuunnitelma-työkalu (päivitys)
Aja tämä **Servalo-repon juuressa**. Kirjoittaa `pelastussuunnitelma-tyokalu.html` kokonaan uusiksi, validoi ja pushaa.

Uutta tässä versiossa:
- **Tontin opaste / pelastuskaavio** -kuvapaikka (oma lataus + tallennus).
- **Varahenkilö** (nimi + puhelin) yhteystietoihin ja raportin yhteenvetoon.
- **Alkusammutuskaluston sijainnit** ja **defibrillaattori (AED)** kohtaan 2 (näkyvät vain jos täytetty).
- **Ylläpito- ja tarkastusloki** (pvm / vastuuhenkilö / muutos) — taulukko kohdassa 7, tyhjä loki ei näy.

---

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
cat > pelastussuunnitelma-tyokalu.html <<'PELSU_EOF'
<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pelastussuunnitelma-työkalu</title>
<style>
  :root{
    --bg:#f4f6f9; --panel:#fff; --line:#e2e7ee; --ink:#1f2733; --muted:#6b7684;
    --brand:#c8471f; --brand2:#e2632f; --ok:#1f8f4e; --okbg:#e6f5ec;
    --warn:#c9820a; --warnbg:#fbf1dc; --bad:#c62828; --badbg:#fbe6e6;
    --crit:#8e1414; --critbg:#f7d9d9; --grey:#9aa4b1; --greybg:#eef1f5;
  }
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink)}
  header.app{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;padding:16px 22px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  header.app .logo{width:34px;height:34px;border-radius:9px;background:#fff;color:var(--brand);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px}
  header.app h1{font-size:18px;margin:0;font-weight:700}
  header.app .sub{font-size:12px;opacity:.85;margin-top:2px}
  header.app .tools{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
  .btn{border:0;border-radius:8px;padding:9px 13px;font-weight:600;font-size:13px;cursor:pointer;background:#eef1f5;color:var(--ink)}
  .btn:hover{filter:brightness(.97)}
  .btn.primary{background:var(--brand);color:#fff}
  .btn.ghost{background:rgba(255,255,255,.16);color:#fff}
  .btn.sm{padding:5px 9px;font-size:12px}
  .btn.danger{background:var(--badbg);color:var(--bad)}
  .wrap{max-width:1080px;margin:0 auto;padding:18px}
  nav.tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
  nav.tabs button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:10px 14px;font-weight:600;cursor:pointer;color:var(--muted)}
  nav.tabs button.active{background:var(--brand);color:#fff;border-color:var(--brand)}
  .view{display:none}
  .view.active{display:block}
  .panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:16px;overflow:hidden}
  .panel-h{padding:12px 16px;font-weight:700;border-bottom:1px solid var(--line);background:#fbfcfd}
  .panel-b{padding:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:640px){.grid{grid-template-columns:1fr}}
  .field{display:flex;flex-direction:column;gap:4px}
  .field label{font-size:12px;font-weight:600;color:var(--muted)}
  .field input,.field select,.field textarea{padding:9px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;background:#fff;color:var(--ink)}
  .field textarea{min-height:52px;resize:vertical}
  .hint{color:var(--muted);font-size:12px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px 9px;border-bottom:1px solid var(--line);vertical-align:top}
  th{background:#fbfcfd;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);position:sticky;top:0}
  .tblwrap{overflow-x:auto}
  .cat{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--greybg);color:var(--muted);white-space:nowrap}
  td.num input{width:52px;text-align:center;padding:6px;border:1px solid var(--line);border-radius:6px;font:inherit}
  td.tot{font-weight:800;text-align:center;min-width:44px}
  td.ok input{width:20px;height:20px}
  td.hav textarea{width:100%;min-width:150px;min-height:34px;border:1px solid var(--line);border-radius:6px;padding:6px;font:inherit;resize:vertical}
  /* --- kuvat --- */
  .imgrow{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}
  .imgprev{width:150px;height:100px;border:1px dashed var(--line);border-radius:8px;background:#fbfcfd center/cover no-repeat;flex:none}
  .imggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px}
  .imgcard{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fbfcfd}
  .imgcard .thumb{width:100%;height:100px;background:#fff center/cover no-repeat;display:block}
  .imgcard .cap{display:flex;gap:6px;padding:6px}
  .imgcard .cap input{flex:1;min-width:0;border:1px solid var(--line);border-radius:6px;padding:5px 7px;font:inherit;font-size:12px}
  /* --- riskikortit (mobiiliystävällinen syöttö) --- */
  .rcards{display:flex;flex-direction:column;gap:12px}
  .rcard{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff}
  .rc-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .rc-top .rc-title{flex:1;min-width:160px;font-size:15px}
  .rc-ok{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--muted);white-space:nowrap}
  .rc-ok input{width:22px;height:22px}
  .rc-desc{color:var(--muted);font-size:12px;margin:6px 0 10px}
  .rc-desc b{color:var(--ink)}
  .rc-catinput{width:110px;border:1px solid var(--line);border-radius:6px;padding:4px 7px;font:inherit;font-size:12px;font-weight:700}
  .rc-titleinput{flex:1;min-width:160px;border:1px solid var(--line);border-radius:6px;padding:5px 8px;font:inherit;font-size:14px;font-weight:600}
  .rc-descinput{width:100%;border:1px solid var(--line);border-radius:6px;padding:5px 8px;font:inherit;font-size:12px;margin-top:4px}
  .rc-score{display:flex;align-items:center;gap:10px;margin:6px 0}
  .scorelbl{width:64px;font-size:12px;font-weight:700;color:var(--muted)}
  .seg{display:flex;gap:6px;flex-wrap:wrap}
  .segb{width:42px;height:42px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font-size:16px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  .segb:active{transform:scale(.94)}
  .segb.on{background:var(--brand);border-color:var(--brand);color:#fff}
  .rc-bottom{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}
  .rc-bottom .tot{min-width:40px;height:34px;display:inline-flex;align-items:center;justify-content:center;padding:0 10px;border-radius:8px}
  .totlabel{font-size:12px;color:var(--muted);font-weight:600}
  .rc-bottom textarea{flex:1;min-width:180px;min-height:38px;border:1px solid var(--line);border-radius:8px;padding:8px;font:inherit;resize:vertical}
  .tot-0{background:var(--greybg);color:var(--grey)}
  .tot-low{background:var(--okbg);color:var(--ok)}
  .tot-med{background:var(--warnbg);color:var(--warn)}
  .tot-high{background:var(--badbg);color:var(--bad)}
  .tot-crit{background:var(--critbg);color:var(--crit)}
  .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-bottom:10px}
  .legend span{display:inline-flex;align-items:center;gap:6px}
  .dot{width:12px;height:12px;border-radius:3px;display:inline-block}
  .summary{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px}
  .stat{background:#fbfcfd;border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:120px}
  .stat b{display:block;font-size:22px}
  .stat span{font-size:12px;color:var(--muted)}
  /* --- tekniset järjestelmät (valinnaiset) --- */
  .teknsub{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;margin:14px 0 8px}
  .teknsub:first-child{margin-top:0}
  .teknlist{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media(max-width:640px){.teknlist{grid-template-columns:1fr}}
  .teknitem{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff}
  .teknitem.on{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}
  .teknitem .teknhead{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;cursor:pointer;margin:0}
  .teknitem .teknhead input{width:18px;height:18px;flex:none}
  .teknitem .teknfield{width:100%;margin-top:8px;border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:inherit;font-size:13px}
  /* --- generoitu suunnitelma --- */
  .plan{background:#fff;border:1px solid var(--line);border-radius:12px;padding:34px 40px;line-height:1.6}
  .plan .planhead{display:flex;justify-content:flex-end;align-items:center;min-height:10px;margin-bottom:6px}
  .plan .brandlogo{max-height:54px;max-width:230px;object-fit:contain;display:block}
  .plan h1{font-size:24px;border-bottom:3px solid var(--brand);padding-bottom:8px;margin:0 0 4px}
  .plan .planmeta{color:var(--muted);font-size:13px;margin-bottom:22px}
  .plan h2{font-size:18px;color:var(--brand);margin:26px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
  .plan h3{font-size:15px;margin:16px 0 4px}
  .plan ul{margin:6px 0 12px;padding-left:20px}
  .plan li{margin:2px 0}
  .plan .todo{background:#fff3cd;color:#8a6d00;padding:0 5px;border-radius:4px;font-style:italic}
  .plan table{font-size:12px;margin:10px 0}
  .plan .kv{display:grid;grid-template-columns:200px 1fr;gap:2px 12px;margin:6px 0}
  .plan .kv div:nth-child(odd){color:var(--muted)}
  .plan .cover{width:100%;max-height:340px;object-fit:cover;border-radius:10px;margin:6px 0 20px;display:block}
  .plan .liitefigs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:10px 0}
  .plan figure{margin:0}
  .plan figure img{width:100%;border:1px solid var(--line);border-radius:8px;display:block}
  .plan .mapfig img{width:auto;max-width:100%;max-height:480px;margin:0 auto}
  .plan figure figcaption{font-size:12px;color:var(--muted);margin-top:4px}
  .plan .loktbl{width:100%;border-collapse:collapse;margin:8px 0}
  .plan .loktbl th,.plan .loktbl td{border:1px solid #d0d0d0;padding:6px 8px;text-align:left;font-size:13px;vertical-align:top}
  .plan .loktbl th{background:#f3f3f3}
  .lokirow{display:grid;grid-template-columns:160px 1fr 1.6fr auto;gap:8px;align-items:center;margin-bottom:8px}
  @media(max-width:620px){.lokirow{grid-template-columns:1fr 1fr;}}
  .plan .note{font-size:12px;color:var(--muted);margin-top:30px;border-top:1px solid var(--line);padding-top:10px}
  .printfoot{display:none}
  @media print{
    header.app,nav.tabs,.noprint{display:none!important}
    html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .wrap{max-width:none;padding:0;margin:0}
    .view{display:none!important}
    #v-plan{display:block!important}
    .plan{border:0;border-radius:0;padding:0}
    /* toistuva alatunniste jokaisella tulostetulla sivulla */
    .printfoot{display:block;position:fixed;bottom:0;left:0;right:0;height:10mm;
      font-size:9px;color:var(--muted);text-align:center;padding-top:3mm;
      border-top:1px solid var(--line);background:#fff}
    /* otsikko pysyy seuraavan sisällön kanssa, ei jää sivun pohjalle */
    .plan h1,.plan h2,.plan h3{break-after:avoid;page-break-after:avoid;break-inside:avoid;page-break-inside:avoid}
    /* lyhyet lohkot eivät katkea kesken sivun */
    .plan .kv,.plan ul,.plan figure,.plan .liitefigs,.plan .cover{break-inside:avoid;page-break-inside:avoid}
    .plan p,.plan li{orphans:3;widows:3}
    /* taulukko saa katketa, mutta rivit pysyvät ehjinä ja otsikko toistuu */
    .plan table{font-size:10px}
    .plan thead{display:table-header-group}
    .plan tr{break-inside:avoid;page-break-inside:avoid}
    @page{margin:18mm 16mm 24mm}
  }
</style>
</head>
<body>
<header class="app">
  <div class="logo">P</div>
  <div>
    <h1>Pelastussuunnitelma-työkalu</h1>
    <div class="sub">Täytä kohteen tiedot ja riskiarvio → valmis pelastussuunnitelma (pelastuslaki 379/2011)</div>
  </div>
  <div class="tools">
    <button class="btn ghost sm" onclick="saveJson()">💾 Tallenna (JSON)</button>
    <button class="btn ghost sm" onclick="document.getElementById('loadFile').click()">📂 Lataa</button>
    <input type="file" id="loadFile" accept="application/json" style="display:none" onchange="loadJson(this)">
    <button class="btn ghost sm" onclick="clearAll()">🗑 Tyhjennä</button>
    <button class="btn primary sm" onclick="switchTab('plan');setTimeout(function(){window.print();},250)">🖨 Tulosta / PDF</button>
  </div>
</header>

<div class="wrap">
  <nav class="tabs">
    <button id="tab-kohde" class="active" onclick="switchTab('kohde')">1. Kohteen tiedot</button>
    <button id="tab-riski" onclick="switchTab('riski')">2. Riskiarvio</button>
    <button id="tab-plan" onclick="switchTab('plan')">3. Valmis pelastussuunnitelma</button>
  </nav>

  <!-- ===== TAB 1: KOHTEEN TIEDOT ===== -->
  <section id="v-kohde" class="view active">
    <div class="panel">
      <div class="panel-h">Yhtiön perustiedot</div>
      <div class="panel-b">
        <div class="grid">
          <div class="field"><label>Yhtiön / kiinteistön nimi</label><input data-k="nimi" placeholder="Esim. As Oy Esimerkkipiha"></div>
          <div class="field"><label>Y-tunnus</label><input data-k="ytunnus" placeholder="esim. 1234567-8"></div>
          <div class="field"><label>Osoite</label><input data-k="osoite" placeholder="Katu 1, 00000 Kaupunki"></div>
          <div class="field"><label>Kiinteistötyyppi</label>
            <select data-k="tyyppi"><option value="">– valitse –</option><option>Rivitalo</option><option>Kerrostalo</option><option>Luhtitalo</option><option>Paritalo</option><option>Liike-/toimitila</option><option>Muu</option></select>
          </div>
          <div class="field"><label>Rakennusvuosi</label><input data-k="rakennusvuosi" placeholder="esim. 2005"></div>
          <div class="field"><label>Huoneistojen lukumäärä</label><input data-k="huoneistot" placeholder="esim. 13"></div>
          <div class="field"><label>Kerrosten / rakennusten määrä</label><input data-k="kerrokset" placeholder="esim. 2 rakennusta"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h">Yhteystiedot ja vastuuhenkilöt</div>
      <div class="panel-b">
        <div class="grid">
          <div class="field"><label>Isännöinti</label><input data-k="isannointi" placeholder="Isännöintiyritys Oy"></div>
          <div class="field"><label>Huoltoyhtiö</label><input data-k="huoltoyhtio" placeholder="Huolto Oy"></div>
          <div class="field"><label>Turvallisuusvastaava (nimi)</label><input data-k="vastuuhenkilo" placeholder="Etunimi Sukunimi"></div>
          <div class="field"><label>Titteli / rooli</label><input data-k="vastuutitteli" placeholder="Isännöitsijä / hallituksen pj."></div>
          <div class="field"><label>Vastuuhenkilön puhelin</label><input data-k="vastuupuhelin" placeholder="0XX XXX XXXX"></div>
          <div class="field"><label>Varahenkilö (nimi)</label><input data-k="varahenkilo" placeholder="Etunimi Sukunimi"></div>
          <div class="field"><label>Varahenkilön puhelin</label><input data-k="varapuhelin" placeholder="0XX XXX XXXX"></div>
          <div class="field"><label>Hätänumero</label><input data-k="hatanumero" value="112"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h">Turvallisuusjärjestelyt ja kalusto</div>
      <div class="panel-b">
        <div class="grid">
          <div class="field"><label>Kokoontumispaikka</label><input data-k="kokoontuminen" placeholder="Esim. pihan pohjoislaita, ilmoitustaulun luona"></div>
          <div class="field"><label>Väestönsuoja (sijainti)</label><input data-k="vaestonsuoja" placeholder="Esim. varastorakennus / ei väestönsuojaa"></div>
          <div class="field"><label>Sammutuskalusto</label><input data-k="sammutus" placeholder="Esim. jauhesammuttimet A-rappu / suositellaan hankittavaksi"></div>
          <div class="field"><label>Alkusammutuskaluston sijainnit</label><input data-k="sammutussijainti" placeholder="Esim. jokaisen rapun eteinen, tekninen tila"></div>
          <div class="field"><label>Ensiapuvälineet</label><input data-k="ensiapu" placeholder="Esim. EA-piste teknisessä tilassa / suositellaan"></div>
          <div class="field"><label>Defibrillaattori (AED) sijainti</label><input data-k="aed" placeholder="Esim. ei ole / aulan seinä 1. krs"></div>
          <div class="field"><label>Sähkön pääsulku (sijainti)</label><input data-k="sahkosulku" placeholder="Esim. teknisen tilan keskus"></div>
          <div class="field"><label>Veden pääsulku (sijainti)</label><input data-k="vesisulku" placeholder="Esim. lämmönjakohuone"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h">Tekniset järjestelmät ja erityisriskit</div>
      <div class="panel-b">
        <p class="hint">Rastita vain ne, joita kohteessa on (esim. hallit ja liikekiinteistöt). <b>Valitsemattomat eivät näy valmiissa suunnitelmassa</b>, joten pienten kohteiden raportti pysyy siistinä. Palokunnalle tärkeät tiedot (aurinkopaneelit, kaasut, kemikaalit, sammutusvesi…) merkitään tähän.</p>
        <div id="teknLista"></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h">Tarkastuksen tiedot</div>
      <div class="panel-b">
        <div class="grid">
          <div class="field"><label>Tarkastuspäivämäärä</label><input data-k="tarkastuspvm" placeholder="pp.kk.vvvv"></div>
          <div class="field"><label>Tarkastajan nimi</label><input data-k="tarkastaja" placeholder="Etunimi Sukunimi"></div>
        </div>
        <p class="hint" style="margin-top:12px">Kentät, jotka jätät tyhjäksi, näkyvät valmiissa suunnitelmassa keltaisena muistutuksena (<span class="todo">[täytä: …]</span>).</p>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h">Ylläpito- ja tarkastusloki</div>
      <div class="panel-b">
        <p class="hint">Kirjaa tähän suunnitelman tarkastukset ja muutokset: vuosittainen tarkastus, vastuuhenkilön vaihdos, remontin jälkeinen päivitys tms. Merkinnät näkyvät valmiin suunnitelman kohdassa 7. Tyhjä loki ei näy raportissa.</p>
        <div id="lokilista"></div>
        <button class="btn sm" onclick="addLoki()">＋ Lisää merkintä</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h">Kuvat</div>
      <div class="panel-b">
        <div class="field" style="margin-bottom:18px">
          <label>Etusivun kuva (rakennus ulkoa)</label>
          <div class="imgrow">
            <div class="imgprev" id="prev-kansi"></div>
            <div>
              <button class="btn sm" onclick="document.getElementById('coverCam').click()">📷 Kamera</button>
              <button class="btn sm" onclick="document.getElementById('coverFile').click()">🖼 Galleria</button>
              <button class="btn sm danger" onclick="removeCover()">Poista</button>
              <input type="file" id="coverFile" accept="image/*" style="display:none" onchange="pickCover(this)">
              <input type="file" id="coverCam" accept="image/*" capture="environment" style="display:none" onchange="pickCover(this)">
              <p class="hint" style="margin:6px 0 0">Näkyy pelastussuunnitelman etusivulla otsikon alla.</p>
            </div>
          </div>
        </div>

        <div class="field" style="margin-bottom:18px">
          <label>Pohjakartta / asemapiirros</label>
          <div class="imgrow">
            <div class="imgprev" id="prev-pohja"></div>
            <div>
              <button class="btn sm" onclick="document.getElementById('pohjaCam').click()">📷 Kamera</button>
              <button class="btn sm" onclick="document.getElementById('pohjaFile').click()">🖼 Galleria</button>
              <button class="btn sm" id="pohja-dl" style="display:none" onclick="downloadPohja()">⬇ Lataa kuva</button>
              <button class="btn sm danger" onclick="removePohja()">Poista</button>
              <input type="file" id="pohjaFile" accept="image/*" style="display:none" onchange="pickPohja(this)">
              <input type="file" id="pohjaCam" accept="image/*" capture="environment" style="display:none" onchange="pickPohja(this)">
              <p class="hint" style="margin:6px 0 0">Kuvaa piirros kännykällä tai valitse tiedosto. Tallennetaan tarkkana (PNG). Näkyy suunnitelman kohdassa 5 ja on ladattavissa erillisenä kuvana.</p>
            </div>
          </div>
        </div>

        <div class="field" style="margin-bottom:18px">
          <label>Tontin opaste / pelastuskaavio</label>
          <div class="imgrow">
            <div class="imgprev" id="prev-opaste"></div>
            <div>
              <button class="btn sm" onclick="document.getElementById('opasteCam').click()">📷 Kamera</button>
              <button class="btn sm" onclick="document.getElementById('opasteFile').click()">🖼 Galleria</button>
              <button class="btn sm" id="opaste-dl" style="display:none" onclick="downloadOpaste()">⬇ Lataa kuva</button>
              <button class="btn sm danger" onclick="removeOpaste()">Poista</button>
              <input type="file" id="opasteFile" accept="image/*" style="display:none" onchange="pickOpaste(this)">
              <input type="file" id="opasteCam" accept="image/*" capture="environment" style="display:none" onchange="pickOpaste(this)">
              <p class="hint" style="margin:6px 0 0">Tontin opastetaulu / pelastuskaavio: rakennusten numerointi, pelastustie, palopostit, kokoontumispaikka. Tallennetaan tarkkana (PNG), näkyy kohdassa 5 ja on ladattavissa erillisenä kuvana. Voi jättää tyhjäksi pienissä kohteissa.</p>
            </div>
          </div>
        </div>

        <div class="field">
          <label>Liitekuvat (poistumistiekartta, kokoontumispaikka, muut…)</label>
          <div>
            <button class="btn sm" onclick="document.getElementById('liiteCam').click()">📷 Kamera</button>
            <button class="btn sm" onclick="document.getElementById('liiteFile').click()">🖼 Galleria</button>
            <input type="file" id="liiteFile" accept="image/*" style="display:none" onchange="pickLiite(this)">
            <input type="file" id="liiteCam" accept="image/*" capture="environment" style="display:none" onchange="pickLiite(this)">
          </div>
          <div class="imggrid" id="liitegrid"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h">Laatija / palveluntarjoaja</div>
      <div class="panel-b">
        <div class="field" style="margin-bottom:18px">
          <label>Laatijan logo</label>
          <div class="imgrow">
            <div class="imgprev" id="prev-logo" style="background:#fff;background-size:contain;background-position:center;background-repeat:no-repeat"></div>
            <div>
              <button class="btn sm" onclick="document.getElementById('logoCam').click()">📷 Kamera</button>
              <button class="btn sm" onclick="document.getElementById('logoFile').click()">🖼 Galleria</button>
              <button class="btn sm danger" onclick="removeLogo()">Poista</button>
              <input type="file" id="logoFile" accept="image/*" style="display:none" onchange="pickLogo(this)">
              <input type="file" id="logoCam" accept="image/*" capture="environment" style="display:none" onchange="pickLogo(this)">
              <p class="hint" style="margin:6px 0 0">Näkyy suunnitelman ylätunnisteessa (kirjelomake) ja alatunnisteessa. Tallennetaan tarkkana (PNG). Mielellään läpinäkyvä tai valkoinen tausta.</p>
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="field"><label>Laatijan nimi / yritys</label><input id="laatija-nimi" placeholder="Esim. Savuks Oy" onchange="setLaatija('nimi',this.value)"></div>
          <div class="field"><label>Yhteystiedot (näkyy alatunnisteessa)</label><input id="laatija-yhteys" placeholder="Esim. puhelin · sähköposti · www" onchange="setLaatija('yhteys',this.value)"></div>
        </div>
        <p class="hint" style="margin-top:12px">Nämä tallentuvat selaimeen ja tulevat automaattisesti jokaiseen suunnitelmaan – logoa ei tarvitse ladata joka kerta uudelleen.</p>
      </div>
    </div>
  </section>

  <!-- ===== TAB 2: RISKIARVIO ===== -->
  <section id="v-riski" class="view">
    <div class="panel">
      <div class="panel-h">Riskiarviolomake (turvallisuuskävely)</div>
      <div class="panel-b">
        <p class="hint">Napauta jokaiselle kohdalle <b>Uhka</b> (0–5) = seurauksen vakavuus ja <b>Paino</b> (0–5) = todennäköisyys. <b>TOT = Uhka × Paino</b> laskee automaattisesti. Rastita <b>OK</b> kun kohta on tarkastettu. Jätä Uhka/Paino nollaan, jos kohta ei koske tätä kiinteistöä.</p>
        <div class="legend">
          <span><i class="dot" style="background:var(--greybg)"></i> 0 ei arvioitu</span>
          <span><i class="dot" style="background:var(--ok)"></i> 1–3 matala</span>
          <span><i class="dot" style="background:var(--warn)"></i> 4–8 kohtalainen</span>
          <span><i class="dot" style="background:var(--bad)"></i> 9–14 korkea</span>
          <span><i class="dot" style="background:var(--crit)"></i> 15–25 kriittinen</span>
        </div>
        <div class="summary" id="summary"></div>
        <div style="margin:8px 0"><button class="btn sm" onclick="addRow()">＋ Lisää oma rivi</button></div>
        <div id="riskBody" class="rcards"></div>
      </div>
    </div>
  </section>

  <!-- ===== TAB 3: VALMIS SUUNNITELMA ===== -->
  <section id="v-plan" class="view">
    <div class="noprint" style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="renderPlan()">⟳ Päivitä esikatselu</button>
      <button class="btn primary" onclick="window.print()">🖨 Tulosta / Tallenna PDF</button>
    </div>
    <div id="plan" class="plan"></div>
  </section>
</div>

<div class="printfoot" id="printfoot"></div>

<script type="application/json" id="riskdata">
[
 {"aihe":"Palo","riski":"Roskakatoksen tuhopoltto","kuvaus":"Tulipalo / murto","toimet":"Älä säilytä palavaa materiaalia lähellä rakennusta (väh. 8 m). Ulko-ovet ja roskakatokset lukittava. Hyvä valaistus."},
 {"aihe":"Sähkö","riski":"Sähkökeskukset","kuvaus":"Tulipalon vaara","toimet":"Keskukset hyvässä järjestyksessä, selkeästi merkitty. Yli 35 A pääsulake vaatii määräaikaistarkastuksen. Ohjeistus sähkölaista saatavilla."},
 {"aihe":"Sähkö","riski":"Sähköasennukset, johdot ja pistokkeet","kuvaus":"Sähköiskut, tulipalo","toimet":"Laitteet tulee asentaa pätevän sähköurakoitsijan toimesta. Määräaikaistarkastuksia suositellaan 15–30 vuoden välein. Lisätietoa: www.tukes.fi"},
 {"aihe":"Sähkö","riski":"Vialliset valaisimet tai loisteputket","kuvaus":"Tulipalo","toimet":"Vaihdetaan vialliset polttimot viipymättä tai estetään valaisimen käyttö."},
 {"aihe":"Sähkö","riski":"Vialliset sähkölaitteet tai virheellinen käyttö","kuvaus":"Tulipalo","toimet":"Huono kunto tai huoltamattomuus aiheuttavat riskin. Viallisia laitteita ei saa käyttää – poistetaan käytöstä heti, korjataan tai vaihdetaan. Ei sisäkäyttöön tarkoitettuja laitteita ulos. Pidä sähkölaitteet puhtaina."},
 {"aihe":"Tilat","riski":"Lieden päällä tavaraa","kuvaus":"Tulipalo","toimet":"Liedellä ei säilytetä mitään. Pidä syttyvät materiaalit poissa lieden läheisyydestä. Jos liesi ei ole käytössä, voidaan irrottaa sulakkeet tai käyttää lapsilukkoa."},
 {"aihe":"Palo","riski":"Tuhopoltto","kuvaus":"Tulipalo","toimet":"Älä säilytä palavaa materiaalia lähellä rakennusta (väh. 8 m). Ulko-ovet ja roskakatokset lukittava. Hyvä valaistus."},
 {"aihe":"Piha","riski":"Pihan hiekoitus puutteellinen","kuvaus":"Kaatumisvaara","toimet":"Väylät hiekoitettu hyvin, ohjeet selvästi huollon sopimuksessa. Asukkailla mahdollisuus lisähiekoitukseen."},
 {"aihe":"Palo","riski":"Läpiviennit","kuvaus":"Tulipalo leviää palo-osastojen välillä","toimet":"Läpiviennit palo-osastojen välillä tiivistetty asianmukaisesti."},
 {"aihe":"Palo","riski":"Tulityöt","kuvaus":"Tulipalo","toimet":"Tulityöluvan myöntäjällä tulee olla voimassa oleva tulityökortti. Isännöitsijä voi myöntää luvan, jos hänellä on kortti ja tehtävä liittyy tulityösuunnitelmaan. Muutoin kortillinen asiantuntija myöntää luvan. Tulitöiden tekijällä on aina oltava voimassa oleva tulityökortti."},
 {"aihe":"Palo","riski":"Käsisammuttimet ja palopostit","kuvaus":"Tulipalon sammutus estyy","toimet":"Riittävä määrä sammuttimia, sijoittelu oikein, merkityt paikat. Huollettu ja testattu säännöllisesti."},
 {"aihe":"Piha","riski":"Katolta putoavat lumet ja jäät","kuvaus":"Tapaturmat, kuolema","toimet":"Lumien ja jäiden tarkkailu sekä poisto huoltosopimuksessa. Tarvittaessa kulku alueilla estetään."},
 {"aihe":"Tilat","riski":"Valaistus yleisissä tiloissa","kuvaus":"Kaatuminen, tapaturmat","toimet":"Valaistus riittävää yleisissä tiloissa. Polttimot vaihdetaan ajoissa."},
 {"aihe":"Vesi","riski":"Vesipisteiden ilkivalta","kuvaus":"Vesivuodot, kosteusvahingot","toimet":"Vesipisteiden avaimet/kahvat säilytetään pois ulkopuolisten ulottuvilta. Jäätymisen suojauksen tarkistus syksyisin."},
 {"aihe":"Viat","riski":"Koneiden ja laitteiden huolto","kuvaus":"Vioittuvat laitteet, tulipalot, huono ilmanlaatu","toimet":"Huoltosopimuksiin sisällytetään: ilmastokanavien puhdistus 10 v välein, suodattimien ja lämmönvaihtimien vaihto vuosittain, savupiiput nuohotaan vuosittain."},
 {"aihe":"EA","riski":"Ensiapuvälineet","kuvaus":"Puuttuvat tai vanhentuneet","toimet":"Ensiapupisteet päivitetty, merkitty ja järjestyksessä (esim. yhteistiloissa tai huoneistoissa)."},
 {"aihe":"Tilat","riski":"Kattilahuone ja polttoaineet","kuvaus":"Tulipalo","toimet":"Laitteet huolletaan ja pidetään toimintakunnossa. Kattilahuone ja polttoainevarasto muodostavat oman palo-osastonsa; niissä ei säilytetä palavaa materiaalia. Palo-ovien tulee olla itsestään sulkeutuvia ja salpautuvia."},
 {"aihe":"Piha","riski":"Pelastustie tukittu","kuvaus":"Avun saaminen viivästyy","toimet":"Pelastustiet aina vapaana, ei pysäköintiä. Talvikunnossapito varmistettava."},
 {"aihe":"Palo","riski":"Palovaroittimet","kuvaus":"Eivät toimi tai puuttuvat","toimet":"Asuinhuoneistossa oltava palovaroitin jokaista alkavaa 60 m² kohti ja jokaisessa asuinkerroksessa. Paristot ja varoitin vaihdetaan valmistajan ohjeen mukaisin välein."},
 {"aihe":"Opaste","riski":"Poistumisreitit","kuvaus":"Tulipalotilanteessa loukkaantuminen, kuolema","toimet":"Reitit vapaat, ovet avattavissa sisältä ilman avainta. Portaissa ei säilytetä mitään: ei lastenvaunuja, kukkia, mattoja tms."},
 {"aihe":"Palo","riski":"Palo-ovet","kuvaus":"Tulipalo leviää koko kiinteistöön","toimet":"Palo-ovet itsestään sulkeutuvia ja salpautuvia. Niitä ei saa pitää auki. Merkitään tarroin. Valvotaan ja huolletaan säännöllisesti."},
 {"aihe":"Tilat","riski":"Märkien kenkien puhdistus sisään tullessa","kuvaus":"Kaatumisvaara sisätiloissa","toimet":"Sisääntulossa oltava matot tai ritilät, joihin voi pyyhkiä kengät."},
 {"aihe":"Tilat","riski":"Lattiat, luiskat, portaat","kuvaus":"Liukastuminen, kompastuminen, tapaturma","toimet":"Lattioiden tulee olla tasaisia ja oikeasta materiaalista. Käytetään liukuesteitä askelmien reunoissa. Kaltevat pinnat varustetaan kaitein."},
 {"aihe":"Tilat","riski":"Yleinen siisteys ja järjestys","kuvaus":"Tapaturmat, tulipalot","toimet":"Jokainen huolehtii omista jäljistään. Yhteiset säännöt varastointiin ja tilojen käyttöön."},
 {"aihe":"Yleiset","riski":"Sairaskohtaukset","kuvaus":"Apu ei saavu ajoissa","toimet":"Jokaisen hyvä osata hätäensiapu. Kartoitetaan taloyhtiön ensiaputaitoiset. Hälytetään 112 ajoissa."},
 {"aihe":"Tilat","riski":"Alaportaikon kuramatto","kuvaus":"Syttyvyysriski, kulkueste","toimet":"Kuramatto ei saa tukkia poistumisreittiä."},
 {"aihe":"Tilat","riski":"Matot yleisissä tiloissa","kuvaus":"Kompastumisriski, palovaara","toimet":"Porraskäytävissä ei käytetä mattoja. Ulko-oven edessä sallittu matto, jos se pysyy paikallaan ja suorana."},
 {"aihe":"Piha","riski":"Kokoontumispaikka","kuvaus":"Evakuoinnin onnistuminen","toimet":"Sovittu paikka on kaikkien tiedossa. Ei saa sijaita pelastushenkilökunnan tiellä. Mahdollisuus siirtyä sisätiloihin lähistöllä."},
 {"aihe":"Tilat","riski":"Lasirakenteet","kuvaus":"Törmäys, loukkaantuminen","toimet":"Lasiseinät, ovet ja ikkunat merkitään helposti havaittaviksi."},
 {"aihe":"Yleiset","riski":"Myrskyt, trombit, syöksyvirtaukset","kuvaus":"Sähkökatkot, kaatuvat puut, lentävät tavarat","toimet":"Lahot tai helposti kaatuvat puut poistetaan. Irtonaiset tavarat siirretään sisätiloihin sään mukaan."},
 {"aihe":"Murto","riski":"Lukitukset","kuvaus":"Vialliset tai jäätyvät lukot","toimet":"Ilkivalta, varkaudet, tuhopoltot ehkäistään lukituksen säännöllisellä huollolla ja tarvittaessa korjauksilla."},
 {"aihe":"Murto","riski":"Avaimia ulkopuolisilla","kuvaus":"Ilkivalta, varkaudet, tuhopoltot","toimet":"Avainten luovutuksesta pidetään kirjaa. Huoneiston luovutuksen jälkeen avaimet palautetaan. Ulkopuoliset eivät voi teettää avaimia (sentraaliavaimet). Tarvittaessa lukot tai sarjoitus uusitaan."},
 {"aihe":"Opaste","riski":"Osoitemerkinnät puutteelliset tai pimeät","kuvaus":"Avun saaminen viivästyy","toimet":"Talo- ja porrasnumerointi riittävän isolla ja kontrastilla. Näkyvyys kaikkiin tulosuuntiin myös pimeällä."},
 {"aihe":"Opaste","riski":"Pysäköinti ja ajojärjestelyt huonot","kuvaus":"Tapaturmat, pelastustoimet vaikeutuvat","toimet":"Selkeät järjestelyt, pysäköinti vain sallituille paikoille. Näkyvyys liittymästä."},
 {"aihe":"Palo","riski":"Tupakointi sisällä","kuvaus":"Tulipalo","toimet":"Ei suositeltavaa. Erityisen vaarallista vuoteessa, sohvalla tai päihtyneenä. Tupakointi ainoastaan ulkona merkityillä paikoilla."},
 {"aihe":"Palo","riski":"Elävät kynttilät, avotuli ja grillaus","kuvaus":"Tulipalo","toimet":"Parvekkeella ei suositella elävää tulta. Grillaus voidaan kieltää järjestyssäännöissä. Kynttilää ei jätetä valvomatta; turvallinen astia, etäisyys palavaan materiaaliin, varaudu sammuttamiseen."},
 {"aihe":"Piha","riski":"Liukkaat paikat pihalla","kuvaus":"Kaatumisvaara","toimet":"Poistetaan liukkauden syy (esim. rännit, öljyvuodot). Jos poistoa ei voida tehdä, estetään kulku alueelle."},
 {"aihe":"Piha","riski":"Vaaralliset puut ja oksat","kuvaus":"Tapaturmat","toimet":"Lahot ja helposti kaatuvat puut sekä oksat poistetaan. Tykkylumivaarat tunnistetaan talvisin."},
 {"aihe":"Sähkö","riski":"Sähkökatkot","kuvaus":"Lämpötilan lasku, laitteet ja puhelin eivät toimi","toimet":"Taskulamppu, radio, varaparistot ja kynttilät saataville. Tulisija varalämmönlähteenä. Autoa ei saa pitää käynnissä autotallissa (häkävaara)."},
 {"aihe":"Sulut","riski":"Sähkön pääsulku","kuvaus":"Vaara- ja sähköiskutilanteiden paheneminen","toimet":"Pääsulku helposti saavutettavassa paikassa, merkitty ja turvallisuusorganisaation tiedossa."},
 {"aihe":"Sulut","riski":"Veden pääsulku","kuvaus":"Vesivahinko tai sen paheneminen","toimet":"Pääsulun sijainti merkitty selkeästi, turvallisuusorganisaation tiedossa. Merkitty asennon mukaan (päällä/pois)."},
 {"aihe":"Sulut","riski":"Ilmastoinnin hätäpainike","kuvaus":"Vaarallisten aineiden leviäminen sisätiloihin","toimet":"Pääkatkaisija ja hätäpainike selkeästi merkittyinä ja helposti käytettävissä."},
 {"aihe":"Tilat","riski":"Väestönsuojan kunto","kuvaus":"Suojautuminen estyy","toimet":"Väestönsuoja pidettävä toimintakunnossa. Tarkastettava vähintään 10 vuoden välein. Käyttöönotettavissa 72 tunnissa."},
 {"aihe":"Tilat","riski":"Parvekekaiteet","kuvaus":"Putoaminen, tapaturma","toimet":"Kaiteet tukevia ja turvallisia. Suositeltavaa, että suojaava osa on läpinäkyvä tai varustettu kurkistusrajoittimella."},
 {"aihe":"Vesi","riski":"Vesikatkot tai saastunut vesi","kuvaus":"Sairastuminen","toimet":"Asukkaita tiedotetaan saastuneesta vedestä. Säilytysastiat puhtaalle vedelle. Puhtaan veden jakelu esim. paloasemilta."},
 {"aihe":"Yleiset","riski":"Yleinen vaaramerkki","kuvaus":"Tapaturmat, sairastuminen","toimet":"Suunniteltu sisälle suojautuminen. Kaikilla asukkailla ohjeet toiminnasta vaaratilanteessa (turvallisuusohje huoneistoissa). Ilmanvaihdon pysäytys osattava."},
 {"aihe":"Yleiset","riski":"Tulvat","kuvaus":"Kiinteistö- ja henkilövahingot","toimet":"Jos kiinteistö on tulvariskialueella, laaditaan tulvasuunnitelma. Varautuminen ennen tulvaa ja sen aikana."},
 {"aihe":"Tilat","riski":"Raput ja kaiteet","kuvaus":"Kompastuminen, putoaminen","toimet":"Portaat valaistaan ja varustetaan jälkiheijastavilla opasteilla. Kaiteet asennetaan, jos putoamiskorkeus > 500 mm."},
 {"aihe":"Palo","riski":"Tulisijat ja lämmittäminen","kuvaus":"Häkämyrkytys, tulipalo","toimet":"Hiillos palanut ennen pellin sulkemista. Liiallinen lämmittäminen voi vaurioittaa hormia. Tuhkat poistetaan ja varastoidaan turvallisesti. Lattiasuojaus min. 40 cm eteen, 10 cm sivuille. Nuohous vuosittain."},
 {"aihe":"Piha","riski":"Leikki- ja oleskelualueiden kasvillisuus","kuvaus":"Myrkyllisyys, allergiat, tapaturmat","toimet":"Käytetään vain kasveja, joiden turvallisuus- ja terveysriski on pieni."},
 {"aihe":"Piha","riski":"Leikkialueet talvella","kuvaus":"Lumien ja jäiden putoaminen","toimet":"Talvella käytettävät alueet suojataan katolta putoavalta lumelta ja jäältä."},
 {"aihe":"Sähkö","riski":"Hissin hätäpuhelin","kuvaus":"Hissistä pelastaminen viivästyy","toimet":"Hississä ja sen ulkopuolella selkeä merkintä hätäpuhelinnumerosta (24/7)."},
 {"aihe":"Sähkö","riski":"Aurinkopaneelit ja invertteri","kuvaus":"Tulipalo, sähköisku sammutustyössä","toimet":"Paneelit tuottavat DC-jännitettä valossa myös pääkytkimen ollessa pois päältä. DC-turvakytkimen ja invertterin sijainti merkitään ja opastetaan palokunnalle (katolla oleva järjestelmä). Asennus ja määräaikaistarkastus pätevällä urakoitsijalla."},
 {"aihe":"Sähkö","riski":"Akusto / energiavarasto","kuvaus":"Tulipalo, lämpökarkaaminen, myrkylliset kaasut","toimet":"Litiumakusto sijoitetaan omaan palo-osastoon; ilmanvaihto ja lämpötilan valvonta kunnossa. Sijainti ja akkutyyppi merkitään palokunnalle. Ei säilytystä poistumisreiteillä."},
 {"aihe":"Sähkö","riski":"Sähköauton latauspisteet","kuvaus":"Tulipalo latauksen aikana","toimet":"Latauslaitteet pätevän asentajan asentamia, oma syöttö ja suojaus. Sijainti merkitään, palokuormaa ei varastoida lähelle. Vikatilanteiden valvonta."},
 {"aihe":"Sähkö","riski":"Trukkien ja akkujen latauspaikka","kuvaus":"Tulipalo, räjähtävät kaasut (vety)","toimet":"Latauspaikka tuuletetaan, ei syttymislähteitä. Erotetaan palavasta materiaalista. Latureiden ja johtojen kunto tarkastetaan."},
 {"aihe":"Palo","riski":"Automaattinen paloilmoitin ja keskukset","kuvaus":"Hälytys ei välity, sammutus viivästyy","toimet":"Paloilmoitinkeskusten (pää- ja alakeskukset) sijainti merkitään. Paloilmoittimen hoitajalla pätevyys; määräaikaishuollot ja kokeilut tehdään. Erheellisiä hälytyksiä seurataan."},
 {"aihe":"Palo","riski":"Automaattinen sammutuslaitteisto (sprinkleri)","kuvaus":"Sammutus ei toimi","toimet":"Venttiiliryhmät merkitään, painetasot ja hälytykset valvotaan. Määräaikaishuolto ja tarkastus tehdään. Vesilähde varmistetaan."},
 {"aihe":"Palo","riski":"Savunpoisto","kuvaus":"Savu estää poistumisen ja sammutuksen","toimet":"Savunpoistoluukut ja -laukaisimet merkitään ja huolletaan. Laukaisun toiminta testataan säännöllisesti; luukut pidetään toimintakuntoisina."},
 {"aihe":"Palo","riski":"Palo-osastointi ja palo-ovet","kuvaus":"Palo ja savu leviävät osastojen välillä","toimet":"Palo-ovet pidetään suljettuina tai itsestään sulkeutuvina, ei kiilata auki. Osastoivat rakenteet ja läpiviennit pidetään ehjinä."},
 {"aihe":"Kemikaalit","riski":"Kemikaalien varastointi","kuvaus":"Tulipalo, myrkylliset päästöt, ympäristövahinko","toimet":"Kemikaaliluettelo ja käyttöturvallisuustiedotteet pidetään ajan tasalla. Varastointi ohjeiden mukaan, yhteensopimattomat aineet erillään. Imeytysaine ja vuotojen keräys saatavilla."},
 {"aihe":"Kemikaalit","riski":"Nestekaasu / kaasujärjestelmä","kuvaus":"Kaasuvuoto, räjähdys","toimet":"Pullot ja säiliöt sijoitetaan ohjeiden mukaan, tuuletus varmistetaan. Vuodonilmaisu ja sulkuventtiilit merkitään. Ei syttymislähteitä lähelle."},
 {"aihe":"Kemikaalit","riski":"Öljy- ja polttoainesäiliöt","kuvaus":"Vuoto, ympäristövahinko, tulipalo","toimet":"Säiliöt tarkastetaan määräajoin; suoja-allas ja ylitäytön esto kunnossa. Sijainti ja tilavuus dokumentoidaan."},
 {"aihe":"Kemikaalit","riski":"Kylmäainejärjestelmä (esim. ammoniakki)","kuvaus":"Kaasuvuoto, myrkytys","toimet":"Konehuoneen ilmanvaihto ja kaasuvaroittimet kunnossa. Sijainti ja hätäpysäytys merkitään. Huolto pätevällä kylmäasentajalla."},
 {"aihe":"Tilat","riski":"Lastauslaiturit ja nostolaitteet","kuvaus":"Puristuminen, putoaminen, tapaturma","toimet":"Nosto-ovet ja laiturit huolletaan, turvarajat toimivat. Käyttäjillä perehdytys. Ajoneuvoliikenne erotellaan jalankulusta."},
 {"aihe":"Tilat","riski":"Korkeavarasto ja hyllystöt","kuvaus":"Sortuminen, putoavat tavarat","toimet":"Hyllyt kiinnitetään ja kuormitusrajoja noudatetaan. Törmäyssuojat asennetaan ja kunto tarkastetaan säännöllisesti."},
 {"aihe":"Poistuminen","riski":"Poistumisreitit ja henkilömäärä","kuvaus":"Ruuhkautuminen, poistuminen estyy","toimet":"Poistumisreitit mitoitetaan henkilömäärälle; merkki- ja turvavalaistus toimii. Reitit pidetään vapaina, ovet avattavissa sisältä ilman avainta."}
]
</script>

<script>
var LS_KEY="pelsu_tyokalu_v1";
var BASE=JSON.parse(document.getElementById("riskdata").textContent);
var M={kohde:{},rows:[]};

function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function todo(t){return '<span class="todo">[täytä: '+esc(t)+']</span>';}
function val(k,label){var v=(M.kohde[k]||"").trim();return v?esc(v):todo(label);}

function initRows(){
  M.rows=BASE.map(function(r){return {aihe:r.aihe,riski:r.riski,kuvaus:r.kuvaus,toimet:r.toimet,ok:false,uhka:0,paino:0,hav:""};});
}
function totOf(r){return (Number(r.uhka)||0)*(Number(r.paino)||0);}
function totClass(t){return t<=0?"tot-0":t<=3?"tot-low":t<=8?"tot-med":t<=14?"tot-high":"tot-crit";}
function totLabel(t){return t<=0?"–":t<=3?"matala":t<=8?"kohtalainen":t<=14?"korkea":"kriittinen";}

function save(){try{localStorage.setItem(LS_KEY,JSON.stringify(M));return true;}catch(e){return false;}}
function normM(){if(!M.kohde)M.kohde={};if(!Array.isArray(M.rows)||!M.rows.length)initRows();if(!Array.isArray(M.liitteet))M.liitteet=[];if(!Array.isArray(M.loki))M.loki=[];if(typeof M.kansi!=="string")M.kansi=M.kansi||"";if(typeof M.pohjakartta!=="string")M.pohjakartta=M.pohjakartta||"";if(typeof M.opaste!=="string")M.opaste=M.opaste||"";if(!M.laatija||typeof M.laatija!=="object")M.laatija={};if(typeof M.laatija.logo!=="string")M.laatija.logo="";if(typeof M.laatija.nimi!=="string")M.laatija.nimi="";if(typeof M.laatija.yhteys!=="string")M.laatija.yhteys="";if(!M.tekniset||typeof M.tekniset!=="object")M.tekniset={};}
function load(){try{var s=localStorage.getItem(LS_KEY);if(s){M=JSON.parse(s);normM();return true;}}catch(e){}return false;}

// --- kuvat: pienennä canvasilla ja tallenna data-URLina ---
// mime "image/jpeg" (valokuvat, pieni koko) tai "image/png" (kartat/piirrokset, terävä teksti)
function resizeImage(file,maxDim,quality,mime,cb){
  var rd=new FileReader();
  rd.onload=function(){
    var img=new Image();
    img.onload=function(){
      var w=img.width,h=img.height,s=Math.min(1,maxDim/Math.max(w,h));
      var cw=Math.round(w*s),ch=Math.round(h*s);
      var c=document.createElement("canvas");c.width=cw;c.height=ch;
      var ctx=c.getContext("2d");
      if((mime||"")==="image/png"){ctx.fillStyle="#fff";ctx.fillRect(0,0,cw,ch);}
      ctx.drawImage(img,0,0,cw,ch);
      cb(c.toDataURL(mime||"image/jpeg",quality));
    };
    img.onerror=function(){alert("Kuvaa ei voitu lukea.");};
    img.src=rd.result;
  };
  rd.onerror=function(){alert("Kuvaa ei voitu lukea.");};
  rd.readAsDataURL(file);
}
function pickCover(input){
  var f=input.files&&input.files[0];input.value="";if(!f)return;
  resizeImage(f,1000,0.82,"image/jpeg",function(url){
    M.kansi=url;
    if(!save()){M.kansi="";alert("Kuva on liian suuri selaimen muistiin. Kokeile pienempää kuvaa.");}
    renderCover();
  });
}
function removeCover(){M.kansi="";save();renderCover();}
function renderCover(){
  var p=document.getElementById("prev-kansi");if(!p)return;
  p.style.backgroundImage=M.kansi?("url("+M.kansi+")"):"";
}
// --- laatijan logo + tiedot (kirjelomake / branding) ---
function pickLogo(input){
  var f=input.files&&input.files[0];input.value="";if(!f)return;
  resizeImage(f,600,0.92,"image/png",function(url){
    M.laatija.logo=url;
    if(!save()){M.laatija.logo="";alert("Logo on liian suuri selaimen muistiin. Kokeile pienempää kuvaa.");}
    renderLogo();
  });
}
function removeLogo(){M.laatija.logo="";save();renderLogo();}
function renderLogo(){var p=document.getElementById("prev-logo");if(p)p.style.backgroundImage=M.laatija.logo?("url("+M.laatija.logo+")"):"";}
function setLaatija(k,v){M.laatija[k]=v;save();}
function bindLaatija(){
  var n=document.getElementById("laatija-nimi");if(n)n.value=M.laatija.nimi||"";
  var y=document.getElementById("laatija-yhteys");if(y)y.value=M.laatija.yhteys||"";
  renderLogo();
}

// --- tekniset järjestelmät ja erityisriskit (valinnaiset, näkyvät raportissa vain jos rastittu) ---
var TEKN=[
  {k:"aurinko",g:"jarj",label:"Aurinkopaneelit ja invertteri",ph:"Sijainti (esim. katto), invertterin ja DC-turvakytkimen paikka",warn:"Tuottaa DC-jännitettä valossa myös pääkytkimen ollessa pois päältä – palokunnan huomioitava."},
  {k:"akusto",g:"jarj",label:"Akusto / energiavarasto",ph:"Tyyppi (esim. litium) ja sijainti",warn:"Litiumakuston lämpökarkaamisriski; sijainti merkittävä palokunnalle."},
  {k:"paloilmoitin",g:"jarj",label:"Automaattinen paloilmoitin ja keskukset",ph:"Paloilmoitinkeskuksen (pää- ja alakeskukset) sijainti, paloilmoittimen hoitaja",warn:"Paloilmoitinkeskuksen sijainti merkittävä palokunnalle; hoitajan pätevyys ja huolto pidettävä ajan tasalla."},
  {k:"sprinkleri",g:"jarj",label:"Automaattinen sammutuslaitteisto (sprinkleri)",ph:"Venttiiliryhmän sijainti, huoltoyhtiö"},
  {k:"savunpoisto",g:"jarj",label:"Savunpoistojärjestelmä",ph:"Luukkujen sijainti ja laukaisu"},
  {k:"ivpysaytys",g:"jarj",label:"Ilmanvaihdon hätäpysäytys",ph:"Pysäytyspainikkeen sijainti"},
  {k:"paloosastointi",g:"jarj",label:"Palo-osastointi ja palo-ovet",ph:"Osastoivat rakenteet, palo-ovien sijainti"},
  {k:"muuntamo",g:"jarj",label:"Muuntamo / sähköpääkeskus",ph:"Sijainti"},
  {k:"varavoima",g:"jarj",label:"Varavoima (aggregaatti / UPS)",ph:"Tyyppi ja sijainti"},
  {k:"evlataus",g:"jarj",label:"Sähköauton latauspisteet",ph:"Sijainti ja määrä"},
  {k:"akkulataus",g:"jarj",label:"Trukkien / akkujen latauspaikka",ph:"Sijainti; latauksen paloriski"},
  {k:"kaasu",g:"jarj",label:"Nestekaasu / kaasujärjestelmä",ph:"Kaasun tyyppi, säiliön/pullojen sijainti",warn:"Kaasuvuodon ja räjähdyksen vaara; syttymislähteet pois."},
  {k:"oljysailio",g:"jarj",label:"Öljy- / polttoainesäiliö",ph:"Sijainti ja tilavuus"},
  {k:"kemikaalit",g:"jarj",label:"Kemikaalien varastointi",ph:"Aineet ja määrät",warn:"Kemikaaliluettelo ja käyttöturvallisuustiedotteet (KTT) pidettävä ajan tasalla."},
  {k:"kylmaaine",g:"jarj",label:"Kylmäainejärjestelmä",ph:"Kylmäaine (esim. ammoniakki), konehuoneen sijainti"},
  {k:"tulityot",g:"jarj",label:"Tulityöt",ph:"Tulityöpaikat, tulityölupakäytäntö ja luvanmyöntäjä"},
  {k:"pelastustie",g:"palo",label:"Pelastustie ja nostopaikat",ph:"Sijainti; pidettävä esteettömänä"},
  {k:"sammutusvesi",g:"palo",label:"Sammutusveden saanti",ph:"Palopostit / palovesiasema / avovesi, sijainti"},
  {k:"avainsailo",g:"palo",label:"Palokunnan avainsäilö / putkilukko",ph:"Sijainti sisäänkäynnillä"},
  {k:"kohdekortti",g:"palo",label:"Kohdekortti / opastaulu",ph:"Sijainti ja sisältö"}
];
function teknState(k){var t=M.tekniset[k];return (t&&typeof t==="object")?t:{on:false,tieto:""};}
function setTeknOn(k,on){var t=teknState(k);M.tekniset[k]={on:!!on,tieto:t.tieto||""};save();renderTekn();}
function setTeknInfo(k,v){var t=teknState(k);M.tekniset[k]={on:t.on,tieto:v};save();}
function av(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function renderTekn(){
  var box=document.getElementById("teknLista");if(!box)return;
  function group(g,title){
    var items=TEKN.filter(function(x){return x.g===g;});
    var cards=items.map(function(x){
      var st=teknState(x.k);
      return '<div class="teknitem'+(st.on?' on':'')+'">'+
        '<label class="teknhead"><input type="checkbox"'+(st.on?' checked':'')+' onchange="setTeknOn(\''+x.k+'\',this.checked)"><span>'+av(x.label)+'</span></label>'+
        (st.on?'<input class="teknfield" value="'+av(st.tieto)+'" placeholder="'+av(x.ph)+'" onchange="setTeknInfo(\''+x.k+'\',this.value)">':'')+
      '</div>';
    }).join("");
    return '<div class="teknsub">'+title+'</div><div class="teknlist">'+cards+'</div>';
  }
  box.innerHTML=group("jarj","Tekniset järjestelmät ja erityisriskit")+group("palo","Palokunnan tiedot ja sammutusreitit");
}
function teknPlanHtml(){
  var html='';
  function sect(g,title){
    var on=TEKN.filter(function(x){return x.g===g&&teknState(x.k).on;});
    if(!on.length)return '';
    var s='<h3>'+title+'</h3><ul>';
    on.forEach(function(x){
      var t=teknState(x.k);
      s+='<li><b>'+esc(x.label)+':</b> '+(t.tieto?esc(t.tieto):'—')+(x.warn?(' <i>'+esc(x.warn)+'</i>'):'')+'</li>';
    });
    return s+'</ul>';
  }
  html+=sect("jarj","Tekniset järjestelmät ja erityisriskit");
  html+=sect("palo","Palokunnan tiedot ja sammutusreitit");
  return html;
}
// --- pohjakartta / asemapiirros (PNG, terävä) ---
function pickPohja(input){
  var f=input.files&&input.files[0];input.value="";if(!f)return;
  resizeImage(f,1600,0.92,"image/png",function(url){
    M.pohjakartta=url;
    if(!save()){M.pohjakartta="";alert("Kartta on liian suuri selaimen muistiin. Kokeile pienempää kuvaa.");}
    renderPohja();
  });
}
function removePohja(){M.pohjakartta="";save();renderPohja();}
function renderPohja(){
  var p=document.getElementById("prev-pohja");if(p)p.style.backgroundImage=M.pohjakartta?("url("+M.pohjakartta+")"):"";
  var dl=document.getElementById("pohja-dl");if(dl)dl.style.display=M.pohjakartta?"":"none";
}
function downloadPohja(){
  if(!M.pohjakartta){alert("Lisää ensin pohjakartta.");return;}
  var nimi=(M.kohde.nimi||"pohjakartta").replace(/[^\wÀ-ſ -]/g,"").trim()||"pohjakartta";
  var a=document.createElement("a");a.href=M.pohjakartta;a.download=nimi+"-pohjakartta.png";a.click();
}
// --- tontin opaste / pelastuskaavio (PNG, terävä) ---
function pickOpaste(input){
  var f=input.files&&input.files[0];input.value="";if(!f)return;
  resizeImage(f,1600,0.92,"image/png",function(url){
    M.opaste=url;
    if(!save()){M.opaste="";alert("Kuva on liian suuri selaimen muistiin. Kokeile pienempää kuvaa.");}
    renderOpaste();
  });
}
function removeOpaste(){M.opaste="";save();renderOpaste();}
function renderOpaste(){
  var p=document.getElementById("prev-opaste");if(p)p.style.backgroundImage=M.opaste?("url("+M.opaste+")"):"";
  var dl=document.getElementById("opaste-dl");if(dl)dl.style.display=M.opaste?"":"none";
}
function downloadOpaste(){
  if(!M.opaste){alert("Lisää ensin tontin opaste.");return;}
  var nimi=(M.kohde.nimi||"tontin-opaste").replace(/[^\wÀ-ſ -]/g,"").trim()||"tontin-opaste";
  var a=document.createElement("a");a.href=M.opaste;a.download=nimi+"-tontin-opaste.png";a.click();
}
function pickLiite(input){
  var f=input.files&&input.files[0];input.value="";if(!f)return;
  resizeImage(f,1400,0.92,"image/png",function(url){
    M.liitteet.push({src:url,cap:""});
    if(!save()){M.liitteet.pop();alert("Kuva on liian suuri selaimen muistiin. Kokeile pienempää kuvaa tai poista muita liitekuvia.");}
    renderLiitteet();
  });
}
function setLiiteCap(i,v){if(M.liitteet[i]){M.liitteet[i].cap=v;save();}}
function delLiite(i){M.liitteet.splice(i,1);save();renderLiitteet();}
// --- ylläpito- ja tarkastusloki ---
function fmtPvm(s){if(!s)return"";var p=String(s).split("-");return p.length===3?(p[2]+"."+p[1]+"."+p[0]):s;}
function addLoki(){M.loki.push({pvm:"",henkilo:"",muutos:""});save();renderLoki();}
function setLoki(i,f,v){if(M.loki[i]){M.loki[i][f]=v;save();}}
function delLoki(i){M.loki.splice(i,1);save();renderLoki();}
function renderLoki(){
  var g=document.getElementById("lokilista");if(!g)return;
  if(!M.loki.length){g.innerHTML='<p class="hint" style="margin:0 0 8px">Ei merkintöjä vielä.</p>';return;}
  g.innerHTML=M.loki.map(function(r,i){
    return '<div class="lokirow">'+
      '<input type="date" value="'+esc(r.pvm)+'" onchange="setLoki('+i+',\'pvm\',this.value)">'+
      '<input value="'+esc(r.henkilo).replace(/"/g,"&quot;")+'" placeholder="Vastuuhenkilö" onchange="setLoki('+i+',\'henkilo\',this.value)">'+
      '<input value="'+esc(r.muutos).replace(/"/g,"&quot;")+'" placeholder="Muutos / tarkastus" onchange="setLoki('+i+',\'muutos\',this.value)">'+
      '<button class="btn sm danger" onclick="delLoki('+i+')">🗑</button></div>';
  }).join("");
}
function renderLiitteet(){
  var g=document.getElementById("liitegrid");if(!g)return;
  g.innerHTML=M.liitteet.map(function(im,i){
    return '<div class="imgcard"><span class="thumb" style="background-image:url('+im.src+')"></span>'+
      '<div class="cap"><input value="'+esc(im.cap).replace(/"/g,"&quot;")+'" placeholder="Kuvateksti" onchange="setLiiteCap('+i+',this.value)">'+
      '<button class="btn sm danger" onclick="delLiite('+i+')">🗑</button></div></div>';
  }).join("");
}

function switchTab(name){
  ["kohde","riski","plan"].forEach(function(n){
    document.getElementById("v-"+n).classList.toggle("active",n===name);
    document.getElementById("tab-"+n).classList.toggle("active",n===name);
  });
  if(name==="plan")renderPlan();
  if(name==="riski")renderSummary();
  window.scrollTo(0,0);
}

function bindKohde(){
  document.querySelectorAll("[data-k]").forEach(function(el){
    var k=el.getAttribute("data-k");
    if(M.kohde[k]!=null && M.kohde[k]!=="")el.value=M.kohde[k];
    else if(el.value)M.kohde[k]=el.value; // esitäytetyt (esim. 112)
    el.addEventListener("input",function(){M.kohde[k]=el.value;save();});
  });
}

function segHtml(i,k,cur){
  var h='<div class="seg" data-k="'+k+'">';
  for(var n=0;n<=5;n++){
    h+='<button type="button" class="segb'+(Number(cur)===n?' on':'')+'" data-v="'+n+'" onclick="setScore('+i+',\''+k+'\','+n+')">'+n+'</button>';
  }
  return h+'</div>';
}
function renderRows(){
  var b=document.getElementById("riskBody");
  b.innerHTML=M.rows.map(function(r,i){
    var t=totOf(r);
    function av(s){return esc(s).replace(/"/g,"&quot;");}
    var topMid,desc;
    if(r.custom){
      topMid='<input class="rc-catinput" value="'+av(r.aihe)+'" placeholder="Aihe" onchange="setRow('+i+',\'aihe\',this.value)">'+
             '<input class="rc-titleinput" value="'+av(r.riski)+'" placeholder="Riskin nimi" onchange="setRow('+i+',\'riski\',this.value)">';
      desc='<div class="rc-desc"><input class="rc-descinput" value="'+av(r.kuvaus)+'" placeholder="Kuvaus / uhka" onchange="setRow('+i+',\'kuvaus\',this.value)">'+
           '<input class="rc-descinput" value="'+av(r.toimet)+'" placeholder="Ennaltaehkäisevät toimenpiteet" onchange="setRow('+i+',\'toimet\',this.value)"></div>';
    } else {
      topMid='<span class="cat">'+esc(r.aihe)+'</span>'+
             '<span class="rc-title"><b>'+esc(r.riski)+'</b></span>';
      desc='<div class="rc-desc"><b>'+esc(r.kuvaus)+'.</b> '+esc(r.toimet)+'</div>';
    }
    return '<div class="rcard" id="rc'+i+'">'+
      '<div class="rc-top">'+
        topMid+
        '<label class="rc-ok"><input type="checkbox" '+(r.ok?"checked":"")+' onchange="setRow('+i+',\'ok\',this.checked)"> OK</label>'+
      '</div>'+
      desc+
      '<div class="rc-score"><span class="scorelbl">Uhka</span>'+segHtml(i,"uhka",r.uhka)+'</div>'+
      '<div class="rc-score"><span class="scorelbl">Paino</span>'+segHtml(i,"paino",r.paino)+'</div>'+
      '<div class="rc-bottom">'+
        '<span class="tot '+totClass(t)+'" id="tot'+i+'">'+(t||"–")+'</span>'+
        '<span class="totlabel">'+totLabel(t)+'</span>'+
        '<textarea onchange="setRow('+i+',\'hav\',this.value)" placeholder="Havainnot / kommentit…">'+esc(r.hav)+'</textarea>'+
        (r.custom?'<button class="btn sm danger" onclick="delRow('+i+')">🗑</button>':'')+
      '</div>'+
    '</div>';
  }).join("");
}
function setScore(i,k,v){
  M.rows[i][k]=Math.max(0,Math.min(5,Number(v)||0));
  var card=document.getElementById("rc"+i);
  if(card){
    var seg=card.querySelector('.seg[data-k="'+k+'"]');
    if(seg){[].forEach.call(seg.querySelectorAll(".segb"),function(btn){btn.classList.toggle("on",Number(btn.getAttribute("data-v"))===M.rows[i][k]);});}
    var t=totOf(M.rows[i]);var c=document.getElementById("tot"+i);
    if(c){c.textContent=t||"–";c.className="tot "+totClass(t);}
    var lb=card.querySelector(".totlabel");if(lb)lb.textContent=totLabel(t);
  }
  save();renderSummary();
}
function setRow(i,k,v){
  if(k==="uhka"||k==="paino"){v=Math.max(0,Math.min(5,Number(v)||0));}
  M.rows[i][k]=v;
  if(k==="uhka"||k==="paino"){
    var t=totOf(M.rows[i]);var c=document.getElementById("tot"+i);
    if(c){c.textContent=t||"–";c.className="tot "+totClass(t);}
  }
  save();renderSummary();
}
function addRow(){M.rows.push({aihe:"Muu",riski:"",kuvaus:"",toimet:"",ok:false,uhka:0,paino:0,hav:"",custom:true});save();renderRows();renderSummary();}
function delRow(i){M.rows.splice(i,1);save();renderRows();renderSummary();}

function renderSummary(){
  var s=document.getElementById("summary");if(!s)return;
  var assessed=M.rows.filter(function(r){return totOf(r)>0;}).length;
  var crit=M.rows.filter(function(r){return totOf(r)>=15;}).length;
  var high=M.rows.filter(function(r){var t=totOf(r);return t>=9&&t<15;}).length;
  var okc=M.rows.filter(function(r){return r.ok;}).length;
  s.innerHTML=
    '<div class="stat"><b>'+M.rows.length+'</b><span>riviä yhteensä</span></div>'+
    '<div class="stat"><b>'+assessed+'</b><span>arvioitu (TOT>0)</span></div>'+
    '<div class="stat"><b>'+okc+'</b><span>merkitty OK</span></div>'+
    '<div class="stat" style="border-color:var(--bad)"><b style="color:var(--bad)">'+high+'</b><span>korkea (9–14)</span></div>'+
    '<div class="stat" style="border-color:var(--crit)"><b style="color:var(--crit)">'+crit+'</b><span>kriittinen (15–25)</span></div>';
}

function riskTableHtml(){
  var rows=M.rows.filter(function(r){return totOf(r)>0 || r.ok || (r.hav||"").trim();});
  if(!rows.length)return '<p class="todo">Riskiarviota ei ole vielä täytetty. Täytä välilehti 2 (Riskiarvio).</p>';
  rows.sort(function(a,b){return totOf(b)-totOf(a);});
  var body=rows.map(function(r){
    var t=totOf(r);
    return '<tr>'+
      '<td>'+esc(r.aihe)+'</td>'+
      '<td>'+esc(r.riski)+'</td>'+
      '<td style="text-align:center;font-weight:700">'+(t||"–")+'</td>'+
      '<td>'+esc(totLabel(t))+'</td>'+
      '<td>'+(esc(r.hav)||"—")+'</td>'+
    '</tr>';
  }).join("");
  return '<table border="1" cellspacing="0"><thead><tr><th>Aihe</th><th>Riski</th><th>TOT</th><th>Taso</th><th>Havainnot</th></tr></thead><tbody>'+body+'</tbody></table>';
}

function renderPlan(){
  var k=M.kohde;
  var pvm=(k.tarkastuspvm||"").trim();
  var lz=M.laatija||{};
  var html='';
  if(lz.logo){html+='<div class="planhead"><img class="brandlogo" src="'+lz.logo+'" alt="'+esc(lz.nimi||"Laatija")+'"></div>';}
  html+='<h1>PELASTUSSUUNNITELMA</h1>';
  html+='<div class="planmeta">'+val("nimi","yhtiön nimi")+(k.ytunnus?(' &nbsp;·&nbsp; Y-tunnus '+esc(k.ytunnus)):'')+' &nbsp;·&nbsp; '+val("osoite","osoite")+' &nbsp;·&nbsp; Laadittu/päivitetty: '+(pvm?esc(pvm):todo("pvm"))+'</div>';
  if(M.kansi){html+='<img class="cover" src="'+M.kansi+'" alt="Kohteen kuva">';}

  html+='<h2>Tiivistelmä</h2>';
  html+='<p>Tämä pelastussuunnitelma on laadittu kiinteistölle turvallisuusmääräysten ja pelastuslain (379/2011) mukaisesti. Suunnitelma sisältää ohjeet vaaratilanteiden ehkäisyyn, toimintaan onnettomuuksissa sekä kiinteistön varautumiseen poikkeustilanteissa. Suunnitelman tulee olla kiinteistön ilmoitustaululla nähtävillä ja lisäksi saatavilla sähköisesti.</p>';
  html+='<h3>Yhtiön keskeiset tiedot</h3><div class="kv">'+
    '<div>Y-tunnus</div><div>'+val("ytunnus","Y-tunnus")+'</div>'+
    '<div>Osoite</div><div>'+val("osoite","osoite")+'</div>'+
    '<div>Tyyppi</div><div>'+val("tyyppi","kiinteistötyyppi")+'</div>'+
    '<div>Rakennusvuosi</div><div>'+val("rakennusvuosi","rakennusvuosi")+'</div>'+
    '<div>Huoneistojen lukumäärä</div><div>'+val("huoneistot","huoneistojen määrä")+'</div>'+
    '<div>Rakennukset / kerrokset</div><div>'+val("kerrokset","rakennusten määrä")+'</div>'+
  '</div>';
  html+='<h3>Keskeiset yhteystiedot</h3><div class="kv">'+
    '<div>Isännöinti</div><div>'+val("isannointi","isännöinti")+'</div>'+
    '<div>Huoltoyhtiö</div><div>'+val("huoltoyhtio","huoltoyhtiö")+'</div>'+
    '<div>Turvallisuusvastaava</div><div>'+val("vastuuhenkilo","vastuuhenkilö")+' '+(k.vastuutitteli?("("+esc(k.vastuutitteli)+")"):"")+' '+(k.vastuupuhelin?("· "+esc(k.vastuupuhelin)):"")+'</div>'+
    '<div>Varahenkilö</div><div>'+val("varahenkilo","varahenkilö")+(k.varapuhelin?(" · "+esc(k.varapuhelin)):"")+'</div>'+
    '<div>Hätänumero</div><div>'+esc(k.hatanumero||"112")+'</div>'+
  '</div>';
  html+='<h3>Tärkeimmät turvallisuusjärjestelyt</h3><ul>'+
    '<li>Pelastussuunnitelma oltava kaikkien luettavissa (ilmoitustaulu + sähköinen)</li>'+
    '<li>Kokoontumispaikka: '+val("kokoontuminen","kokoontumispaikka")+'</li>'+
    '<li>Väestönsuoja: '+val("vaestonsuoja","väestönsuojan sijainti")+'</li>'+
    '<li>Sammutuskalusto: '+val("sammutus","sammutuskalusto")+'</li>'+
    '<li>Ensiapuvälineet: '+val("ensiapu","ensiapuvälineet")+'</li>'+
  '</ul>';

  html+='<h2>1. Riskien arviointi</h2>';
  html+='<p>Tässä osiossa tunnistetaan vaaratilanteet, jotka voivat aiheuttaa uhkaa kiinteistön asukkaille tai omaisuudelle. Riskien arvioinnilla ennaltaehkäistään onnettomuuksia ja parannetaan varautumista. Arviointi tehdään vuosittain vastuuhenkilön toimesta, poikkeustilanteen tai vahingon jälkeen sekä ennen suuria huoltoja ja remontteja. Arviointi tehdään liitteenä olevalla lomakkeella, joka arkistoidaan pelastussuunnitelman yhteyteen. Lisäksi tehdään turvallisuuskävely silmämääräisen riskikartoituksen tueksi.</p>';
  html+='<h3>Arvioidut riskit (yhteenveto)</h3>';
  html+=riskTableHtml();

  html+='<h2>2. Turvallisuusjärjestelyt ja -kalusto</h2>';
  html+='<h3>Sammutuskalusto</h3><ul><li>'+val("sammutus","sammutuskalusto")+'</li>'+(M.kohde.sammutussijainti?('<li>Sijainnit: '+esc(M.kohde.sammutussijainti)+'</li>'):'')+'<li>Asunnoissa suositellaan sammutuspeitettä</li></ul>';
  html+='<h3>Varavalaistus ja turvavalot</h3><ul><li>Poistumisteiden turvavalot ja varavalaistus tarkastetaan osana huoltokierrosta 1–2 kertaa vuodessa</li></ul>';
  html+='<h3>Poistumisreitit ja opasteet</h3><ul><li>Kaikkiin asuntoihin on merkitty poistumisreitit</li><li>Poistumisopasteet valaistuja tai jälkivalaisevia sähkökatkon varalta</li><li>Reitit pidetään esteettöminä; kunto tarkastetaan vuosittain turvallisuuskävelyllä</li></ul>';
  html+='<h3>Ensiapuvälineet</h3><ul><li>'+val("ensiapu","ensiapuvälineet")+'</li>'+(M.kohde.aed?('<li>Defibrillaattori (AED): '+esc(M.kohde.aed)+'</li>'):'')+'<li>Vastuuhenkilö tarkistaa sisällön 2 kertaa vuodessa</li></ul>';
  html+='<h3>Väestönsuoja</h3><ul><li>Sijainti: '+val("vaestonsuoja","väestönsuojan sijainti")+'</li><li>Varustus tarkastetaan vuosittain tarkistuslistan mukaan (ilmanvaihto, tiivistysmateriaalit, WC-ratkaisut, vesikanisterit, viestintävälineet)</li></ul>';
  html+=teknPlanHtml();

  html+='<h2>3. Toimintaohjeet vaaratilanteissa</h2>';
  html+='<h3>Tulipalo</h3><ul><li>Hälytä apua hätänumerosta 112</li><li>Poistu rakennuksesta välittömästi lähintä poistumisreittiä</li><li>Sulje ovet takanasi, mutta älä lukitse</li><li>Älä käytä hissiä</li><li>Ohjaa muut poistumaan ja siirry kokoontumispaikalle</li></ul>';
  html+='<h3>Vesivuoto</h3><ul><li>Katkaise vuodon lähde mikäli mahdollista (sulkuventtiili)</li><li>Ilmoita huoltoyhtiölle ja isännöitsijälle</li><li>Estä veden leviäminen ja dokumentoi vahingot valokuvin</li></ul>';
  html+='<h3>Kaasuvuoto</h3><ul><li>Poistu välittömästi, älä käytä valokatkaisijoita</li><li>Soita 112, ilmoita isännöitsijälle ja huollolle</li><li>Vältä sytytyslähteitä ja kipinöitä</li></ul>';
  html+='<h3>Sähkökatko</h3><ul><li>Käytä taskulamppua tai varavalaistusta</li><li>Ilmoita viasta huoltoyhtiölle, tarkista onko yleinen katko</li><li>Älä avaa pakastinta/jääkaappia turhaan; seuraa tiedotusta</li></ul>';
  html+='<h3>Tapaturma / henkilövahinko</h3><ul><li>Arvioi tilanne ja soita tarvittaessa 112</li><li>Suojaa loukkaantunut ja anna ensiapua</li><li>Ohjaa ensihoito oikeaan paikkaan</li></ul>';
  html+='<h3>Uhkatilanne / väkivalta</h3><ul><li>Poistu tilanteesta jos mahdollista, soita 112</li><li>Älä provosoi; kirjaa tapahtumat muistin tueksi</li></ul>';
  html+='<h3>Evakuointi</h3><ul><li>Noudata viranomaisten ohjeita, poistu opasteiden mukaisesti</li><li>Kokoontumispaikka: '+val("kokoontuminen","kokoontumispaikka")+'</li><li>Autetaan liikkumisesteisiä, vanhuksia ja lapsia</li></ul>';

  html+='<h2>4. Väestönsuoja</h2>';
  html+='<p>Suoja on tarkoitettu antamaan suojaa poikkeusoloissa. Tilaa ylläpidetään huoltamalla rakenteet, ilmanvaihto ja varusteet vuosittain. Suoja otetaan käyttöön viranomaisohjeistuksella tai vastuuhenkilön päätöksellä. Ennen käyttöönottoa tarkastetaan ilmanvaihto, tiiveys, WC-ratkaisut, valaistus ja varusteet. Tilaan varataan vettä, ensiapuvälineet ja viestintävälineet.</p>';
  html+='<div class="kv"><div>Väestönsuojan sijainti</div><div>'+val("vaestonsuoja","väestönsuojan sijainti")+'</div></div>';

  html+='<h2>5. Poistumistiet ja kokoontumispaikka</h2>';
  html+='<ul><li>Rakennukset ja tilat on varustettu selkeästi merkityillä poistumisreiteillä</li><li>Opasteet valaistuja tai jälkivalaisevia, näkyvät myös sähkökatkon aikana</li><li>Reitit pidetään vapaina; kunto tarkastetaan vähintään kerran vuodessa</li></ul>';
  html+='<h3>Pohjakartta / asemapiirros</h3><ul><li>Pohjakarttaan merkitään poistumisreitit, sammutuskalusto, ensiapupisteet, väestönsuoja sekä sähkön, kaasun ja veden pääsulut ja kokoontumispaikka</li></ul>';
  if(M.pohjakartta){html+='<figure class="mapfig"><img src="'+M.pohjakartta+'" alt="Pohjakartta"><figcaption>Pohjakartta / asemapiirros</figcaption></figure>';}
  else{html+='<p>'+todo("liitä pohjakartta välilehdellä 1 (Kuvat)")+'</p>';}
  html+='<h3>Tontin opaste / pelastuskaavio</h3><ul><li>Tontin opasteeseen merkitään rakennusten sijainti ja numerointi, pelastustie ja nostopaikat, palopostit/vesiasemat, kokoontumispaikka sekä sähkön pääkytkin</li><li>Pelastustie pidetään esteettömänä ja merkittynä – pysäköinti pelastustiellä on kielletty</li></ul>';
  if(M.opaste){html+='<figure class="mapfig"><img src="'+M.opaste+'" alt="Tontin opaste"><figcaption>Tontin opaste / pelastuskaavio</figcaption></figure>';}
  html+='<div class="kv"><div>Kokoontumispaikka</div><div>'+val("kokoontuminen","kokoontumispaikka")+'</div><div>Sähkön pääsulku</div><div>'+val("sahkosulku","sähkön pääsulku")+'</div><div>Veden pääsulku</div><div>'+val("vesisulku","veden pääsulku")+'</div></div>';

  html+='<h2>6. Tiedottaminen ja perehdytys</h2>';
  html+='<ul><li>Painettu versio ilmoitustauluilla (A4/A3) sekä asuntojen sisäänkäyntien ja teknisten tilojen läheisyydessä</li><li>Uusille asukkaille annetaan perehdytysohjeet muuton yhteydessä</li><li>Huollolle ja isännöinnille järjestetään vuosittainen turvallisuusperehdytys</li><li>Perehdytyksistä laaditaan merkintä (päivämäärä, osallistujat, materiaali), joka säilytetään isännöinnin arkistossa</li></ul>';

  html+='<h2>7. Suunnitelman ylläpito</h2>';
  html+='<ul><li>Suunnitelma tarkistetaan vähintään kerran vuodessa</li><li>Päivitys tehdään myös turvallisuusvastaavan vaihtuessa, merkittävän remontin jälkeen tai onnettomuuden/läheltä piti -tilanteen jälkeen</li><li>Kaikki tarkistukset dokumentoidaan (päivämäärä, vastuuhenkilö, muutokset) ja säilytetään sähköisesti</li><li>Asukkaille tiedotetaan päivityksistä ilmoitustaululla tai sähköpostitse</li></ul>';
  html+='<div class="kv"><div>Vastuuhenkilö</div><div>'+val("vastuuhenkilo","vastuuhenkilö")+'</div><div>Viimeisin tarkastus</div><div>'+(pvm?esc(pvm):todo("pvm"))+'</div><div>Tarkastaja</div><div>'+val("tarkastaja","tarkastaja")+'</div></div>';
  var lokiRows=(M.loki||[]).filter(function(r){return (r.pvm||r.henkilo||r.muutos);});
  if(lokiRows.length){
    html+='<h3>Ylläpito- ja tarkastusloki</h3><table class="loktbl"><thead><tr><th>Päivämäärä</th><th>Vastuuhenkilö</th><th>Muutos / tarkastus</th></tr></thead><tbody>';
    lokiRows.forEach(function(r){html+='<tr><td>'+esc(fmtPvm(r.pvm))+'</td><td>'+esc(r.henkilo||"")+'</td><td>'+esc(r.muutos||"")+'</td></tr>';});
    html+='</tbody></table>';
  }

  html+='<h2>8. Liitteet</h2><ul><li>Riskienarviointilomake (yllä osiossa 1 sekä erillisenä turvallisuuskävelyn lomakkeena)</li><li>Pelastussuunnitelman pohjakartta</li></ul>';
  if(M.liitteet&&M.liitteet.length){
    html+='<div class="liitefigs">'+M.liitteet.map(function(im){
      return '<figure><img src="'+im.src+'" alt=""><figcaption>'+(esc(im.cap)||"Liitekuva")+'</figcaption></figure>';
    }).join("")+'</div>';
  }

  html+='<div class="note">Tämä pelastussuunnitelma on laadittu pelastuslain 379/2011 mukaisesti. Tarkista aina paikallisen pelastusviranomaisen ajantasaiset ohjeet. Tulostettu '+(new Date().toLocaleDateString("fi-FI"))+'.'+((lz.nimi||lz.yhteys)?(' Laatija: '+esc([lz.nimi,lz.yhteys].filter(Boolean).join(", "))+'.'):'')+'</div>';

  document.getElementById("plan").innerHTML=html;

  var nimi=(k.nimi||"").trim();
  var foot="PELASTUSSUUNNITELMA"+(nimi?(" · "+nimi):"")+(k.ytunnus?(" · Y-tunnus "+k.ytunnus):"")+" · pelastuslaki 379/2011";
  if(lz.nimi||lz.yhteys){foot="Laatija: "+[lz.nimi,lz.yhteys].filter(Boolean).join(" · ")+"   |   "+foot;}
  document.getElementById("printfoot").textContent=foot;
}

function saveJson(){
  var blob=new Blob([JSON.stringify(M,null,2)],{type:"application/json"});
  var a=document.createElement("a");
  var nimi=(M.kohde.nimi||"pelastussuunnitelma").replace(/[^\wÀ-ſ -]/g,"").trim()||"pelastussuunnitelma";
  a.href=URL.createObjectURL(blob);a.download=nimi+".json";a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
}
function loadJson(input){
  var f=input.files&&input.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){try{var o=JSON.parse(rd.result);M=o;normM();save();location.reload();}catch(e){alert("Virheellinen JSON-tiedosto.");}};
  rd.readAsText(f);input.value="";
}
function clearAll(){
  if(!confirm("Tyhjennetäänkö kaikki tiedot ja palautetaan vakioriskit?"))return;
  M={kohde:{},rows:[],liitteet:[],kansi:"",pohjakartta:"",opaste:"",loki:[],laatija:{logo:"",nimi:"",yhteys:""},tekniset:{}};initRows();save();location.reload();
}

// init
if(!load()){M={kohde:{},rows:[],liitteet:[],kansi:"",pohjakartta:"",opaste:"",loki:[],laatija:{logo:"",nimi:"",yhteys:""},tekniset:{}};initRows();}
normM();
bindKohde();bindLaatija();renderTekn();renderRows();renderSummary();renderCover();renderPohja();renderOpaste();renderLiitteet();renderLoki();
</script>
</body>
</html>
PELSU_EOF

echo "--- JS-syntaksin validointi ---"
node -e '
const fs=require("fs");
const h=fs.readFileSync("pelastussuunnitelma-tyokalu.html","utf8");
const re=/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g;
let m,i=0,ok=true;
while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){ok=false;console.log("Lohko "+i+" FAIL: "+e.message);}}
console.log(ok?("JS OK ("+i+" lohkoa)"):"JS FAILED");process.exit(ok?0:1);
'

echo "--- riskdata rivit (odotus 67) ---"
node -e 'const fs=require("fs");const h=fs.readFileSync("pelastussuunnitelma-tyokalu.html","utf8");const m=h.match(/id="riskdata"[^>]*>([\s\S]*?)<\/script>/);const a=JSON.parse(m[1]);if(a.length!==67){console.log("VIRHE: riskirivit="+a.length);process.exit(1)}console.log("riskirivit OK: 67");'

echo "--- Tärkeät tokenit ---"
for t in "pickOpaste" "renderOpaste" "prev-opaste" "Tontin opaste" "varahenkilo" "varapuhelin" "sammutussijainti" "data-k="aed"" "addLoki" "renderLoki" "setLoki" "delLoki" "fmtPvm" "id="lokilista"" "loktbl" "mapfig" "teknPlanHtml" "renderLaatija"; do
  grep -q "$t" pelastussuunnitelma-tyokalu.html && echo "OK: $t" || { echo "PUUTTUU: $t"; exit 1; }
done

echo "--- Kielletyt merkkijonot ---"
if grep -nE "PAP Group|idrcloud|Prosero|Kramp|0929411|@pap\.fi|jari\.mattila@savuks\.fi|0443665638" pelastussuunnitelma-tyokalu.html; then
  echo "VIRHE: kielletty merkkijono"; exit 1
else echo "Kielletyt: puhdas"; fi

echo "--- Git ---"
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Pelsu: varahenkilo, AED + alkusammutuksen sijainnit, yllapito-/tarkastusloki"
git push origin main
echo "VALMIS."
```
