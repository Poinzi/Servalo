// Servalo QR-palvelun DB-moduuli.
// Käyttää pg-Poolia. Jos DATABASE_URL puuttuu, moduuli disabloi itsensä (isEnabled=false)
// ja API-reitit palauttavat 503. Näin lokaali dev toimii ilman Postgresia.

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const url = process.env.DATABASE_URL || "";
const isEnabled = url.length > 0;

let pool = null;
if (isEnabled) {
  const cfg = { connectionString: url };
  // Railwayn Postgres vaatii SSL:n mutta sertti ei ole varmennettavissa selfservicessa.
  if (/render\.com|railway\.app|amazonaws\.com/i.test(url) || process.env.PGSSL === "1") {
    cfg.ssl = { rejectUnauthorized: false };
  }
  pool = new Pool(cfg);
  pool.on("error", (err) => {
    console.error("[db] pool error:", err.message);
  });
}

async function initSchema() {
  if (!pool) return { ok: false, reason: "no DATABASE_URL" };
  const sql = fs.readFileSync(path.join(__dirname, "db", "schema.sql"), "utf8");
  const client = await pool.connect();
  try {
    await client.query(sql);
    // Demo-siemen: yksi fiktiivinen kohde + asukaskoodi, jotta kuittausta voi testata heti.
    const cnt = await client.query("SELECT count(*)::int AS n FROM koodit");
    if (cnt.rows[0].n === 0) {
      const k = await client.query(
        "INSERT INTO kohteet (nimi, osoite) VALUES ($1,$2) RETURNING id",
        ["Asunto Oy Esimerkkitie 4", "Esimerkkitie 4, 00100 Helsinki"]
      );
      await client.query(
        "INSERT INTO koodit (koodi, kohde_id, nakymatyyppi, data, kohdistettu_pvm, kohdistaja) VALUES ($1,$2,'asukas',$3::jsonb,now(),'seed') ON CONFLICT (koodi) DO NOTHING",
        ["82FA66", k.rows[0].id, JSON.stringify({ apt: "A12", floor: "1. krs" })]
      );
    }
    return { ok: true };
  } finally {
    client.release();
  }
}

async function query(text, params) {
  if (!pool) throw new Error("DB not configured");
  return pool.query(text, params);
}

module.exports = { pool, isEnabled, initSchema, query };
