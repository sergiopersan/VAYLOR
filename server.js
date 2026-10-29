// --------------------------------------------------
// VAYLOR — Servidor Local HTTP con API de Verificación
// --------------------------------------------------

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = process.env.PORT || 5501;
const BASE_DIR = __dirname;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf"
};

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const pathname = parsedUrl.pathname;

    // --------------------------------------------------
    // API: Verificación de carátula mediante verificar_portadas.py
    // --------------------------------------------------
    if (pathname === "/api/verify-cover") {
        const title = parsedUrl.searchParams.get("title");
        if (!title || !title.trim()) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ ok: false, error: "Parámetro 'title' requerido" }));
            return;
        }

        const scriptPath = path.join(BASE_DIR, "data", "verificar_portadas.py");
        execFile("python", [scriptPath, "--title", title.trim()], { timeout: 15000 }, (err, stdout, stderr) => {
            if (err) {
                console.error("Error ejecutando verificar_portadas.py:", err, stderr);
                // Si falla Python, fallback mínimo
                res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({
                    ok: false,
                    title: title.trim(),
                    cover: "",
                    error: "No se pudo ejecutar el verificador de portadas"
                }));
                return;
            }

            try {
                const parsed = JSON.parse(stdout.trim());
                res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify(parsed));
            } catch (parseError) {
                res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ ok: false, raw: stdout }));
            }
        });
        return;
    }

    // --------------------------------------------------
    // API: Verificación completa de catálogo
    // --------------------------------------------------
    if (pathname === "/api/verify-catalog") {
        const scriptPath = path.join(BASE_DIR, "data", "verificar_portadas.py");
        execFile("python", [scriptPath], { timeout: 60000 }, (err, stdout, stderr) => {
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({
                ok: !err,
                output: stdout,
                error: stderr
            }));
        });
        return;
    }

    // --------------------------------------------------
    // Servidor de archivos estáticos
    // --------------------------------------------------
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
    if (safePath === "/" || safePath === "\\") safePath = "index.html";

    const filePath = path.join(BASE_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("404 No encontrado");
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        res.writeHead(200, { "Content-Type": contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`Servidor Vaylor activo en http://127.0.0.1:${PORT}/`);
    console.log(`Endpoint de verificación: http://127.0.0.1:${PORT}/api/verify-cover?title=...`);
});

