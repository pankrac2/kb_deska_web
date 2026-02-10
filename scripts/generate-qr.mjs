#!/usr/bin/env node
/**
 * Generate QR code images from a list of URLs.
 * Usage:
 *   node scripts/generate-qr.mjs [urls.json] [output-dir]
 * Default: urls.json in project root, output in ./qr-codes
 * urls.json can be: { "urls": ["https://...", ...] } or ["https://...", ...]
 */

import { readFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const urlsPath = process.argv[2] || join(root, "urls.json");
const outDir = process.argv[3] || join(root, "qr-codes");

async function main() {
  let raw;
  try {
    raw = await readFile(urlsPath, "utf8");
  } catch (e) {
    console.error("Could not read %s: %s", urlsPath, e.message);
    process.exit(1);
  }

  let urls;
  try {
    const data = JSON.parse(raw);
    urls = Array.isArray(data) ? data : (data.urls || data.url || []);
  } catch (e) {
    console.error("Invalid JSON in %s: %s", urlsPath, e.message);
    process.exit(1);
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    console.error("No URLs found in %s (expected array or { urls: [...] })", urlsPath);
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  const format = urls.length >= 100 ? "png" : "png";
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const filename = `qr-${String(i + 1).padStart(String(urls.length).length, "0")}.png`;
    const filepath = join(outDir, filename);
    await QRCode.toFile(filepath, url, { width: 400, margin: 2 });
    if ((i + 1) % 50 === 0 || i === 0) {
      console.log("Generated %d / %d", i + 1, urls.length);
    }
  }
  console.log("Done. %d QR codes written to %s", urls.length, outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
