// Servalo - kevyt staattinen palvelin Railwaylle (nolla riippuvuutta)
const http = require("http");
const fs = require("fs");
const path = require("path");

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

  // Estä polkuhyökkäykset
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/servalo.html";

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Tuntematon polku -> palauta sovellus (SPA)
      fs.readFile(path.join(ROOT, "servalo.html"), (e2, html) => {
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
});
