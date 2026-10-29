#!/usr/bin/env node
/**
 * Build borrower PWA and serve it from LOCALAPPDATA (avoids OneDrive read errors in Vite dev).
 * Open http://localhost:8081/auth
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.BORROWER_UI_PORT || 8081);
const host = process.env.BORROWER_UI_HOST || "127.0.0.1";
const srcDist = path.join(root, "apps/borrower-mobile/dist");
const serveRoot = path.join(
  process.env.LOCALAPPDATA || process.env.TMP || "/tmp",
  "PhinduLoans",
  "borrower-dist",
);

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root, env: process.env });
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  if (filePath.endsWith(".woff")) return "font/woff";
  return "application/octet-stream";
}

console.log("\n[borrower:ui] Building production bundle…\n");
run("npm run build:borrower");

if (!existsSync(path.join(srcDist, "index.html"))) {
  console.error("[borrower:ui] Build failed — dist/index.html missing.");
  process.exit(1);
}

mkdirSync(path.dirname(serveRoot), { recursive: true });
console.log(`\n[borrower:ui] Copying dist → ${serveRoot}\n`);
cpSync(srcDist, serveRoot, { recursive: true, force: true });

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    let filePath = path.join(serveRoot, pathname);
    if (!filePath.startsWith(serveRoot)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = path.join(serveRoot, "index.html");
    }

    const body = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-cache" });
    res.end(body);
  } catch (err) {
    console.error("[borrower:ui] Request error:", err);
    res.writeHead(500);
    res.end("Server error");
  }
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}/auth`;
  console.log(`\n[borrower:ui] Ready — open ${url}\n`);
  console.log("(Serving from LOCALAPPDATA, not OneDrive — same files as production build.)\n");
});
