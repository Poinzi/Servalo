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
