// Servalo - kevyt staattinen palvelin Railwaylle.
const http = require("http");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const api = require("./api");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  // Anthropic-proxy: AI-kuva-analyysi. Avain vain palvelimella (ANTHROPIC_API_KEY),
  // oletusmalli Haiku. Kevyt suoja: vaatii X-User-Id-otsakkeen (sovellus lahettaa sen).
  if (req.url.startsWith("/api/analyze")) {
    const jt = { "Content-Type": "application/json; charset=utf-8" };
    if (req.method !== "POST") { res.writeHead(405, jt); return res.end(JSON.stringify({ error: "POST vaaditaan" })); }
    if (!String(req.headers["x-user-id"] || "").trim()) { res.writeHead(401, jt); return res.end(JSON.stringify({ error: "kirjautuminen vaaditaan" })); }
    const aiKey = process.env.ANTHROPIC_API_KEY;
    if (!aiKey) { res.writeHead(503, jt); return res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY puuttuu palvelimelta" })); }
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 8 * 1024 * 1024) req.destroy(); });
    req.on("end", () => {
      let body;
      try { body = JSON.parse(raw || "{}"); } catch (e) { res.writeHead(400, jt); return res.end(JSON.stringify({ error: "virheellinen JSON" })); }
      const ALLOWED = new Set(["claude-haiku-4-5", "claude-sonnet-4-6"]);
      const model = ALLOWED.has(body.model) ? body.model : "claude-sonnet-4-6";
      const content = Array.isArray(body.content) ? body.content : null;
      if (!content) { res.writeHead(400, jt); return res.end(JSON.stringify({ error: "content vaaditaan" })); }
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": aiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: model, max_tokens: 400, messages: [{ role: "user", content: content }] }),
      })
        .then((r) => r.text().then((t) => { res.writeHead(r.status, jt); res.end(t); }))
        .catch((err) => { res.writeHead(502, jt); res.end(JSON.stringify({ error: "AI-kutsu epaonnistui", detail: String(err) })); });
    });
    return;
  }

  // Servalon oma QR-API (kaikki muu /api/* paitsi YTJ-proxy).
  if (req.url.startsWith("/api/") && !req.url.startsWith("/api/ytj")) {
    return api.handle(req, res);
  }

  // YTJ-proxy (PRH avoin data) – haetaan yritystiedot palvelimen puolelta,
  // jotta selaimen CORS-rajoitus ei estä kutsua.
  if (req.url.startsWith("/api/ytj")) {
    const u = new URL(req.url, "http://localhost");
    const bid = (u.searchParams.get("businessId") || "").trim();
    if (!/^\d{7}-\d$/.test(bid)) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "Virheellinen Y-tunnus" }));
    }
    const api = "https://avoindata.prh.fi/opendata-ytj-api/v3/companies?businessId=" + encodeURIComponent(bid);
    fetch(api, { headers: { Accept: "application/json" } })
      .then((r) => r.text().then((body) => {
        res.writeHead(r.status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(body);
      }))
      .catch((err) => {
        res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "YTJ-haku epäonnistui", detail: String(err) }));
      });
    return;
  }

  // Julkinen QR-palvelu (ohje24) vs. isännöitsijän sovellus (Servalo).
  // Host-pohjainen oletus: kun ohje24-domain osoittaa tähän palveluun,
  // juuripolku palauttaa julkisen QR-sivun. Muuten Servalo-sovellus.
  const host = String(req.headers.host || "").toLowerCase();
  const isPublic = host.includes("ohje24");
  const defaultFile = isPublic ? "/ohje24.html" : "/servalo.html";

  // Estä polkuhyökkäykset
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  // QR-koodilinkit (esim. /k/82FA66) -> aina julkinen sivu; sivu lukee koodin URL:sta
  if (urlPath === "/k" || urlPath.startsWith("/k/")) urlPath = "/ohje24.html";
  // Kirjanpito: vain sisainen sovellus, ei koskaan julkisella ohje24-domainilla.
  if (isPublic && /kirjanpito/i.test(urlPath)) urlPath = "/ohje24.html";
  else if (urlPath === "/kirjanpito") urlPath = "/kirjanpito.html";
  if (urlPath === "/") urlPath = defaultFile;

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Tuntematon polku -> julkisella domainilla QR-sivu, muuten Servalo (SPA)
      const fallback = isPublic ? "ohje24.html" : "servalo.html";
      fs.readFile(path.join(ROOT, fallback), (e2, html) => {
        if (e2) {
          res.writeHead(404);
          return res.end("Not found");
        }
        res.writeHead(200, { "Content-Type": TYPES[".html"] });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Servalo käynnissä portissa ${PORT}`);
  if (db.isEnabled) {
    db.initSchema()
      .then((r) => console.log("[db] initSchema:", r.ok ? "ok" : `skipped (${r.reason})`))
      .catch((e) => console.error("[db] initSchema failed:", e.message));
  } else {
    console.log("[db] disabled (no DATABASE_URL) — /api/* palauttaa 503");
  }
});
