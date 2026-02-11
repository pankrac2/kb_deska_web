#!/usr/bin/env node
/**
 * Call the admin generate API to create new tokens and save URLs to urls.json.
 * Then optionally run the QR generator.
 *
 * Usage:
 *   SITE_URL=https://album.xxx.cz ADMIN_SECRET=your-secret node scripts/call-generate.mjs [count] [maxDownloads]
 *   Or set in .env (not committed): SITE_URL, ADMIN_SECRET
 *
 * Default: count=10, maxDownloads=3
 * Output: urls.json (and optionally qr-codes/*.png if you run generate-qr next)
 */

import { writeFile, readFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const count = Math.min(5000, Math.max(1, parseInt(process.argv[2], 10) || 10));
const maxDownloads = Math.min(100, Math.max(1, parseInt(process.argv[3], 10) || 3));

const siteUrl = process.env.SITE_URL || process.env.URL;
const adminSecret = process.env.ADMIN_SECRET;

if (!siteUrl) {
  console.error("Set SITE_URL (e.g. https://album.xxx.cz)");
  process.exit(1);
}
if (!adminSecret) {
  console.error("Set ADMIN_SECRET (same as in Netlify env vars)");
  process.exit(1);
}

const apiUrl = siteUrl.replace(/\/$/, "") + "/api/admin/generate";

async function main() {
  console.log("Calling %s (count=%d, maxDownloads=%d)…", apiUrl, count, maxDownloads);
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: adminSecret,
      count,
      maxDownloads,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("API error %s: %s", res.status, text);
    process.exit(1);
  }

  const data = await res.json();
  const urls = data.urls || [];
  console.log("Created %d tokens.", urls.length);

  const urlsPath = join(root, "urls.json");
  let existing = [];
  try {
    const raw = await readFile(urlsPath, "utf8");
    const prev = JSON.parse(raw);
    existing = Array.isArray(prev) ? prev : (prev.urls || prev.url || []);
  } catch {
    // no existing file
  }

  const combined = [...existing, ...urls];
  const output = { urls: combined, lastGenerated: data.count, maxDownloads: data.maxDownloads };
  await writeFile(urlsPath, JSON.stringify(output, null, 2), "utf8");
  console.log("Saved %d total URLs to %s", combined.length, urlsPath);

  const newOnlyPath = join(root, "urls-new.json");
  await writeFile(newOnlyPath, JSON.stringify({ urls }, null, 2), "utf8");
  console.log("New URLs only saved to %s", newOnlyPath);
  console.log("Generate QR codes for new URLs: node scripts/generate-qr.mjs urls-new.json qr-codes-new");
  console.log("Or for all URLs: node scripts/generate-qr.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
