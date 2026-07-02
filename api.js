// Servalo QR-palvelun API. Yksinkertainen reititys pg-tietokantaa vasten.
// Auth: X-User-Id -header (kevyt demoauth; roolit tulevat myöhemmin).

const db = require("./db");

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
  const userId = String(req.headers["x-user-id"] || "").trim();
  const requireAuth = () => {
    if (!userId) { sendJson(res, 401, { error: "auth required" }); return false; }
    return true;
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

    // Kirjautuneiden reitit alla
    if (p.startsWith("/api/kohteet") || p.startsWith("/api/kohdista")) {
      if (!requireAuth()) return;
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

    return sendJson(res, 404, { error: "unknown api route" });
  } catch (e) {
    console.error("[api] error:", e.message);
    return sendJson(res, 500, { error: "server error", detail: e.message });
  }
}

module.exports = { handle };
