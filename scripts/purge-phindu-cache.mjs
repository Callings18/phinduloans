#!/usr/bin/env node
/**
 * Purge Cloudflare cache for phindu.com (app + office + marketing).
 * Requires CLOUDFLARE_API_TOKEN. Zone ID is fixed for phindu.com production.
 */
const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID || "4f94f668e062de6782257b6c5190cc98";

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN to purge cache.");
  process.exit(1);
}

const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ purge_everything: true }),
});

const json = await res.json();
if (!json.success) {
  console.error("Purge failed", json.errors);
  process.exit(1);
}
console.log("Purged Cloudflare cache for zone", zoneId);
