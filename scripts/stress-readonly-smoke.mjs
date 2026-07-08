#!/usr/bin/env node
/**
 * Phase 4 read-only load smoke — concurrent GETs against public API endpoints (no writes).
 *
 * Env:
 *   STRESS_API_URL          (default http://localhost:3001)
 *   STRESS_CONCURRENCY      (default 20)
 *   STRESS_TOTAL_REQUESTS   (default 200)
 *   STRESS_ENDPOINTS          (comma-separated paths; default /api/v1/health,/api/v1/loan-products)
 *
 * Usage:
 *   STRESS_API_URL=https://api-staging.example.com node scripts/stress-readonly-smoke.mjs
 *
 * For heavier load, use k6 — see docs/PHASE4_STRESS_UAT.md § Stress test plan.
 */
const baseUrl = (process.env.STRESS_API_URL || "http://localhost:3001").replace(/\/$/, "");
const concurrency = Math.max(1, Number(process.env.STRESS_CONCURRENCY || 20));
const totalRequests = Math.max(concurrency, Number(process.env.STRESS_TOTAL_REQUESTS || 200));
const endpoints = (process.env.STRESS_ENDPOINTS || "/api/v1/health,/api/v1/loan-products")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function fetchOne(path) {
  const started = performance.now();
  const res = await fetch(`${baseUrl}${path}`, { method: "GET" });
  const ms = performance.now() - started;
  const ok = res.ok;
  let bodyLen = 0;
  try {
    const text = await res.text();
    bodyLen = text.length;
  } catch {
    /* ignore */
  }
  return { path, status: res.status, ok, ms, bodyLen };
}

async function worker(queue, results) {
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) break;
    try {
      results.push(await fetchOne(path));
    } catch (e) {
      results.push({ path, status: 0, ok: false, ms: 0, error: e.message });
    }
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  console.log(`[stress-readonly] ${baseUrl} | concurrency=${concurrency} total=${totalRequests}`);
  console.log(`[stress-readonly] endpoints: ${endpoints.join(", ")}`);

  const queue = [];
  for (let i = 0; i < totalRequests; i++) {
    queue.push(endpoints[i % endpoints.length]);
  }

  const results = [];
  const started = performance.now();
  const workers = Array.from({ length: concurrency }, () => worker(queue, results));
  await Promise.all(workers);
  const elapsed = performance.now() - started;

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);

  console.log("\n--- Summary ---");
  console.log(`Requests: ${results.length} | OK: ${ok} | Fail: ${fail}`);
  console.log(`Elapsed: ${(elapsed / 1000).toFixed(2)}s | RPS: ${(results.length / (elapsed / 1000)).toFixed(1)}`);
  console.log(
    `Latency ms — p50: ${percentile(latencies, 50).toFixed(0)} p95: ${percentile(latencies, 95).toFixed(0)} p99: ${percentile(latencies, 99).toFixed(0)} max: ${(latencies.at(-1) ?? 0).toFixed(0)}`,
  );

  const byStatus = {};
  for (const r of results) {
    const k = String(r.status);
    byStatus[k] = (byStatus[k] || 0) + 1;
  }
  console.log("Status codes:", byStatus);

  if (fail > 0) {
    const sample = results.filter((r) => !r.ok).slice(0, 5);
    console.log("Sample failures:", sample);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
