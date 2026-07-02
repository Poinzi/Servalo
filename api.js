// Servalo QR-palvelun API. Yksinkertainen reititys pg-tietokantaa vasten.
// Auth: allekirjoitettu roolitoken (Authorization: Bearer). Roolit: admin / kentta / huolto.
// Legacy: jos AUTH_SECRET ei ole asetettu, ei-tyhjä X-User-Id kelpaa adminina (yhteensopivuus).

const db = require("./db");
const crypto = require("crypto");

// --- Rooliauth -------------------------------------------------------------
const SECRET = process.env.AUTH_SECRET || "servalo-dev-secret";
const ENFORCE = !!process.env.AUTH_SECRET; // vasta kun AUTH_SECRET on asetettu, pakotetaan roolit

// Demokäyttäjät (fiktiivisiä). Vaihda salasanat ja aseta AUTH_SECRET tuotannossa.
const USERS = {
  admin:  { id: "u-admin",  nimi: "Pääkäyttäjä",     rooli: "admin",  salasana: "admin123" },
  kentta: { id: "u-kentta", nimi: "Kenttäasentaja",  rooli: "kentta", salasana: "kentta123" },
  huolto: { id: "u-huolto", nimi: "Huoltokumppani",  rooli: "huolto", salasana: "huolto123" },
};

function checkPassword(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function hmac(body) {
  return b64url(crypto.createHmac("sha256", SECRET).update(body).digest());
}
function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  return body + "." + hmac(body);
}
function verifyToken(token) {
  if (!token || token.indexOf(".") < 0) return null;
  const i = token.lastIndexOf(".");
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const exp = hmac(body);
  if (sig.length !== exp.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); }
  catch (e) { return null; }
  if (payload && payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

// Reittikohtaiset oikeudet. admin: kaikki. kentta: luku + kirjoitus paitsi
// poistot (kontakti/kohdista). huolto: luku + liitekuvat (lisää/poista).
function permit(method, p, rooli) {
  if (rooli === "admin") return true;
  if (method === "GET") return rooli === "kentta" || rooli === "huolto";
  const liitePost = method === "POST" && p === "/api/liite";
  const liiteDel = method === "DELETE" && /^\/api\/liite\/[0-9a-f-]{36}$/i.test(p);
  if (rooli === "huolto") return liitePost || liiteDel;
  if (rooli === "kentta") {
    const kontDel = method === "DELETE" && /^\/api\/kontakti\/[0-9a-f-]{36}$/i.test(p);
    const kohdistaDel = method === "DELETE" && /^\/api\/kohdista\//.test(p);
    if (kontDel || kohdistaDel) return false;
    return true;
  }
  return false;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const max = limit || 1024 * 128;
    req.on("data", (c) => {
      total += c.length;
      if (total > max) { req.destroy(); reject(new Error("body too large")); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error("invalid JSON")); }
    });
    req.on("error", reject);
  });
}

const NAKYMATYYPIT = new Set(["aula", "asukas", "laite", "huolto"]);
const KUITTAUS_TYYPIT = new Set(["palovaroitin", "tarkastus", "kaynti"]);

// Rakenna julkinen näkymä yhdestä koodista. Palauttaa myös kohteen tiedot ja
// (huolto-näkymän kohdalla) hyväksytyt kontaktit.
async function getKoodiPublic(koodi) {
  const q1 = await db.query(
    `SELECT k.koodi, k.nakymatyyppi, k.data, k.kohde_id,
            t.nimi AS kohde_nimi, t.osoite AS kohde_osoite,
            t.building, t.status, t.docs, t.qr_kaytossa
       FROM koodit k
       LEFT JOIN kohteet t ON t.id = k.kohde_id
      WHERE k.koodi = $1`,
    [koodi]
  );
  if (!q1.rows.length) return null;
  const r = q1.rows[0];
  const kohde = r.kohde_id
    ? {
        nimi: r.kohde_nimi,
        osoite: r.kohde_osoite,
        building: r.building,
        status: r.status,
        docs: r.docs,
      }
    : null;

  let huolto_kontaktit = [];
  if (r.nakymatyyppi === "huolto" && r.kohde_id) {
    const q2 = await db.query(
      "SELECT ala, ikoni, yritys, puhelin FROM huolto_kontaktit WHERE kohde_id=$1 AND hyvaksytty=true ORDER BY ala",
      [r.kohde_id]
    );
    huolto_kontaktit = q2.rows;
  }

  return {
    koodi: r.koodi,
    nakymatyyppi: r.nakymatyyppi,
    data: r.data,
    kohde,
    huolto_kontaktit,
    qr_kaytossa: r.qr_kaytossa !== false,
  };
}

async function handle(req, res) {
  if (!db.isEnabled) {
    return sendJson(res, 503, { error: "DB not configured" });
  }

  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  const method = req.method || "GET";
  let userId = String(req.headers["x-user-id"] || "").trim();
  const resolveActor = () => {
    const auth = String(req.headers["authorization"] || "");
    const bearer = auth.indexOf("Bearer ") === 0 ? auth.slice(7).trim() : "";
    const payload = bearer ? verifyToken(bearer) : null;
    if (payload) return payload;
    // Legacy-tila (AUTH_SECRET ei asetettu): ei-tyhjä X-User-Id kelpaa adminina
    if (!ENFORCE && userId) return { id: userId, nimi: userId, rooli: "admin", legacy: true };
    return null;
  };

  try {
    // GET /api/koodi/:koodi (julkinen)
    if (method === "GET" && p.startsWith("/api/koodi/")) {
      const koodi = decodeURIComponent(p.slice("/api/koodi/".length)).trim().toUpperCase();
      if (!koodi) return sendJson(res, 400, { error: "empty koodi" });
      const data = await getKoodiPublic(koodi);
      if (!data) return sendJson(res, 404, { error: "unknown koodi" });
      return sendJson(res, 200, data);
    }

    // POST /api/kuittaus (julkinen)
    if (method === "POST" && p === "/api/kuittaus") {
      const body = await readBody(req);
      const koodi = String(body.koodi || "").trim().toUpperCase();
      const tyyppi = String(body.tyyppi || "").trim();
      if (!koodi) return sendJson(res, 400, { error: "koodi required" });
      if (!KUITTAUS_TYYPIT.has(tyyppi)) return sendJson(res, 400, { error: "invalid tyyppi" });
      const exists = await db.query("SELECT 1 FROM koodit WHERE koodi=$1", [koodi]);
      if (!exists.rows.length) return sendJson(res, 404, { error: "unknown koodi" });
      const ins = await db.query(
        "INSERT INTO kuittaukset (koodi, tyyppi) VALUES ($1,$2) RETURNING id, aikaleima",
        [koodi, tyyppi]
      );
      return sendJson(res, 200, { ok: true, id: ins.rows[0].id, aikaleima: ins.rows[0].aikaleima });
    }

    // GET /api/kuittaukset/:koodi (julkinen: viimeisin palovaroitin-kuittaus + lkm)
    if (method === "GET" && p.startsWith("/api/kuittaukset/")) {
      const koodi = decodeURIComponent(p.slice("/api/kuittaukset/".length)).trim().toUpperCase();
      if (!koodi) return sendJson(res, 400, { error: "empty koodi" });
      const q = await db.query(
        "SELECT count(*)::int AS lkm, max(aikaleima) AS viimeisin FROM kuittaukset WHERE koodi=$1 AND tyyppi='palovaroitin'",
        [koodi]
      );
      return sendJson(res, 200, { koodi, lkm: q.rows[0].lkm, viimeisin: q.rows[0].viimeisin });
    }

    // POST /api/login (julkinen: palauttaa allekirjoitetun roolitokenin)
    if (method === "POST" && p === "/api/login") {
      const body = await readBody(req);
      const kayttaja = String(body.kayttaja || "").trim().toLowerCase();
      const salasana = String(body.salasana || "");
      const u = USERS[kayttaja];
      if (!u || !checkPassword(salasana, u.salasana)) {
        return sendJson(res, 401, { error: "vaara tunnus tai salasana" });
      }
      const exp = Date.now() + 1000 * 60 * 60 * 12; // 12 h
      const token = signToken({ id: u.id, nimi: u.nimi, rooli: u.rooli, exp });
      return sendJson(res, 200, { token, id: u.id, nimi: u.nimi, rooli: u.rooli, exp });
    }

    // GET /api/mina (julkinen: kuka olen tokenin/legacy-headerin perusteella)
    if (method === "GET" && p === "/api/mina") {
      const who = resolveActor();
      return sendJson(res, 200, who
        ? { id: who.id, nimi: who.nimi, rooli: who.rooli, enforce: ENFORCE }
        : { rooli: null, enforce: ENFORCE });
    }

    // Kirjautuneiden reitit: rooli-portti + reittikohtaiset oikeudet
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista") || p.startsWith("/api/raportti") || p.startsWith("/api/liite") || p.startsWith("/api/kontakti")) {
      const who = resolveActor();
      if (!who) { sendJson(res, 401, { error: "auth required" }); return; }
      if (!permit(method, p, who.rooli)) { sendJson(res, 403, { error: "forbidden", rooli: who.rooli }); return; }
      userId = who.id;
    }

    // GET /api/raportti/kattavuus (auth: kohdistus + palovaroitin-kattavuus per kohde)
    if (method === "GET" && p === "/api/raportti/kattavuus") {
      const q = await db.query(
        `SELECT t.id, t.nimi, t.osoite,
           (SELECT count(*) FROM koodit k WHERE k.kohde_id=t.id AND k.nakymatyyppi IS NOT NULL)::int AS koodit_lkm,
           (SELECT count(*) FROM koodit k WHERE k.kohde_id=t.id AND k.nakymatyyppi='asukas')::int AS asukas_lkm,
           (SELECT count(*) FROM koodit k WHERE k.kohde_id=t.id AND k.nakymatyyppi='laite')::int AS laite_lkm,
           (SELECT count(*) FROM koodit k WHERE k.kohde_id=t.id AND k.nakymatyyppi='huolto')::int AS huolto_lkm,
           (SELECT count(DISTINCT ku.koodi) FROM kuittaukset ku JOIN koodit k ON k.koodi=ku.koodi
              WHERE k.kohde_id=t.id AND k.nakymatyyppi='asukas' AND ku.tyyppi='palovaroitin')::int AS kuitatut_asukkaat,
           (SELECT max(ku.aikaleima) FROM kuittaukset ku JOIN koodit k ON k.koodi=ku.koodi
              WHERE k.kohde_id=t.id AND ku.tyyppi='palovaroitin') AS viimeisin_kuittaus
         FROM kohteet t
         ORDER BY t.nimi`
      );
      return sendJson(res, 200, q.rows);
    }

    // GET /api/kohteet
    if (method === "GET" && p === "/api/kohteet") {
      const q = await db.query(
        "SELECT id, nimi, osoite, y_tunnus, qr_kaytossa FROM kohteet ORDER BY nimi"
      );
      return sendJson(res, 200, q.rows);
    }

    // GET /api/kohteet/:id
    const mKohde = p.match(/^\/api\/kohteet\/([0-9a-f-]{36})$/i);
    if (method === "GET" && mKohde) {
      const id = mKohde[1];
      const q = await db.query("SELECT * FROM kohteet WHERE id=$1", [id]);
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown kohde" });
      const koodit = await db.query(
        "SELECT koodi, nakymatyyppi, data, kohdistettu_pvm, kohdistaja FROM koodit WHERE kohde_id=$1 ORDER BY luotu",
        [id]
      );
      const kontaktit = await db.query(
        "SELECT id, ala, ikoni, yritys, puhelin, hyvaksytty FROM huolto_kontaktit WHERE kohde_id=$1 ORDER BY ala",
        [id]
      );
      return sendJson(res, 200, { ...q.rows[0], koodit: koodit.rows, huolto_kontaktit: kontaktit.rows });
    }

    // POST /api/kohteet/:id/status (auth: päivitä turvallisuustilanne)
    const mStatus = p.match(/^\/api\/kohteet\/([0-9a-f-]{36})\/status$/i);
    if (method === "POST" && mStatus) {
      const body = await readBody(req);
      if (!Array.isArray(body.status)) return sendJson(res, 400, { error: "status array required" });
      const q = await db.query(
        "UPDATE kohteet SET status=$2::jsonb WHERE id=$1 RETURNING id, status",
        [mStatus[1], JSON.stringify(body.status)]
      );
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown kohde" });
      return sendJson(res, 200, { ok: true, id: q.rows[0].id, status: q.rows[0].status });
    }

    // POST /api/kohteet (luo uusi kohde)
    if (method === "POST" && p === "/api/kohteet") {
      const body = await readBody(req);
      const nimi = String(body.nimi || "").trim();
      if (!nimi) return sendJson(res, 400, { error: "nimi required" });
      const ins = await db.query(
        `INSERT INTO kohteet (nimi, osoite, y_tunnus, servalo_customer_id, building, status, docs)
         VALUES ($1,$2,$3,$4,COALESCE($5,'{}'::jsonb),COALESCE($6,'[]'::jsonb),COALESCE($7,'{}'::jsonb))
         RETURNING id, nimi, osoite`,
        [
          nimi,
          body.osoite || null,
          body.y_tunnus || null,
          body.servalo_customer_id || null,
          body.building ? JSON.stringify(body.building) : null,
          body.status ? JSON.stringify(body.status) : null,
          body.docs ? JSON.stringify(body.docs) : null,
        ]
      );
      return sendJson(res, 201, ins.rows[0]);
    }

    // POST /api/kohdista (upsert: kohdista koodi tai luo uusi)
    if (method === "POST" && (p === "/api/kohdista" || p === "/api/kohdista/muuta")) {
      const body = await readBody(req);
      const koodi = String(body.koodi || "").trim().toUpperCase();
      const kohdeId = String(body.kohde_id || "").trim();
      const nakymatyyppi = String(body.nakymatyyppi || "").trim();
      if (!koodi) return sendJson(res, 400, { error: "koodi required" });
      if (!kohdeId) return sendJson(res, 400, { error: "kohde_id required" });
      if (!NAKYMATYYPIT.has(nakymatyyppi)) return sendJson(res, 400, { error: "invalid nakymatyyppi" });
      const kohdeQ = await db.query("SELECT id FROM kohteet WHERE id=$1", [kohdeId]);
      if (!kohdeQ.rows.length) return sendJson(res, 404, { error: "unknown kohde" });
      const data = body.data ? JSON.stringify(body.data) : "{}";
      const q = await db.query(
        `INSERT INTO koodit (koodi, kohde_id, nakymatyyppi, data, kohdistettu_pvm, kohdistaja)
         VALUES ($1,$2,$3,$4::jsonb,now(),$5)
         ON CONFLICT (koodi) DO UPDATE
         SET kohde_id=EXCLUDED.kohde_id,
             nakymatyyppi=EXCLUDED.nakymatyyppi,
             data=EXCLUDED.data,
             kohdistettu_pvm=now(),
             kohdistaja=EXCLUDED.kohdistaja
         RETURNING koodi, kohde_id, nakymatyyppi, data, kohdistettu_pvm, kohdistaja`,
        [koodi, kohdeId, nakymatyyppi, data, userId]
      );
      return sendJson(res, 200, q.rows[0]);
    }

    // DELETE /api/kohdista/:koodi (vapauta koodi)
    const mDel = p.match(/^\/api\/kohdista\/([^\/]+)$/);
    if (method === "DELETE" && mDel) {
      const koodi = decodeURIComponent(mDel[1]).toUpperCase();
      const q = await db.query(
        "UPDATE koodit SET kohde_id=NULL, nakymatyyppi=NULL, data='{}'::jsonb, kohdistettu_pvm=NULL, kohdistaja=NULL WHERE koodi=$1 RETURNING koodi",
        [koodi]
      );
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown koodi" });
      return sendJson(res, 200, { ok: true, koodi: q.rows[0].koodi });
    }

    // POST /api/liite (auth: tallenna koodin liitekuva Postgresiin)
    if (method === "POST" && p === "/api/liite") {
      const body = await readBody(req, 1024 * 1024 * 6); // max ~6 MB
      const koodi = String(body.koodi || "").trim().toUpperCase();
      const dataUrl = String(body.dataUrl || "");
      if (!koodi) return sendJson(res, 400, { error: "koodi required" });
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return sendJson(res, 400, { error: "invalid dataUrl" });
      const mime = m[1];
      const buf = Buffer.from(m[2], "base64");
      const exists = await db.query("SELECT kohde_id FROM koodit WHERE koodi=$1", [koodi]);
      if (!exists.rows.length) return sendJson(res, 404, { error: "unknown koodi" });
      const ins = await db.query(
        "INSERT INTO liitteet (koodi, kohde_id, tyyppi, nimi, mime, data) VALUES ($1,$2,'kuva',$3,$4,$5) RETURNING id, luotu",
        [koodi, exists.rows[0].kohde_id, "kuva-" + Date.now() + ".jpg", mime, buf]
      );
      return sendJson(res, 201, { id: ins.rows[0].id, luotu: ins.rows[0].luotu });
    }

    // GET /api/liitteet/:koodi (auth: listaa koodin kuvat data-URL:eina)
    if (method === "GET" && p.startsWith("/api/liitteet/")) {
      const koodi = decodeURIComponent(p.slice("/api/liitteet/".length)).trim().toUpperCase();
      if (!koodi) return sendJson(res, 400, { error: "empty koodi" });
      const q = await db.query(
        "SELECT id, mime, encode(data,'base64') AS b64, luotu FROM liitteet WHERE koodi=$1 AND tyyppi='kuva' ORDER BY luotu",
        [koodi]
      );
      const kuvat = q.rows.map((r) => ({
        id: r.id,
        mime: r.mime,
        luotu: r.luotu,
        dataUrl: "data:" + (r.mime || "image/jpeg") + ";base64," + r.b64,
      }));
      return sendJson(res, 200, kuvat);
    }

    // DELETE /api/liite/:id (auth)
    const mLiite = p.match(/^\/api\/liite\/([0-9a-f-]{36})$/i);
    if (method === "DELETE" && mLiite) {
      const q = await db.query("DELETE FROM liitteet WHERE id=$1 RETURNING id", [mLiite[1]]);
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown liite" });
      return sendJson(res, 200, { ok: true, id: q.rows[0].id });
    }

    // POST /api/kontakti (auth: lisää hyväksytty huoltokontakti kohteelle)
    if (method === "POST" && p === "/api/kontakti") {
      const body = await readBody(req);
      const kohdeId = String(body.kohde_id || "").trim();
      const yritys = String(body.yritys || "").trim();
      const ala = String(body.ala || "").trim();
      if (!kohdeId) return sendJson(res, 400, { error: "kohde_id required" });
      if (!yritys) return sendJson(res, 400, { error: "yritys required" });
      const kohdeQ = await db.query("SELECT id FROM kohteet WHERE id=$1", [kohdeId]);
      if (!kohdeQ.rows.length) return sendJson(res, 404, { error: "unknown kohde" });
      const ins = await db.query(
        `INSERT INTO huolto_kontaktit (kohde_id, ala, ikoni, yritys, puhelin, hyvaksytty)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,true))
         RETURNING id, ala, ikoni, yritys, puhelin, hyvaksytty`,
        [kohdeId, ala, body.ikoni || "🔧", yritys, body.puhelin || null, typeof body.hyvaksytty === "boolean" ? body.hyvaksytty : null]
      );
      return sendJson(res, 201, ins.rows[0]);
    }

    // DELETE /api/kontakti/:id (auth)
    const mKont = p.match(/^\/api\/kontakti\/([0-9a-f-]{36})$/i);
    if (method === "DELETE" && mKont) {
      const q = await db.query("DELETE FROM huolto_kontaktit WHERE id=$1 RETURNING id", [mKont[1]]);
      if (!q.rows.length) return sendJson(res, 404, { error: "unknown kontakti" });
      return sendJson(res, 200, { ok: true, id: q.rows[0].id });
    }

    return sendJson(res, 404, { error: "unknown api route" });
  } catch (e) {
    console.error("[api] error:", e.message);
    return sendJson(res, 500, { error: "server error", detail: e.message });
  }
}

module.exports = { handle };
