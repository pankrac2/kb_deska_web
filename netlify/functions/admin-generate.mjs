/**
 * Admin: generate new download tokens and store in Blobs.
 * POST /api/admin/generate
 * Body: { secret, count, maxDownloads }
 * Returns: { urls, tokens } (base URL from SITE_URL env or request origin)
 */

import { getStore } from "@netlify/blobs";
import { randomBytes } from "crypto";

const STORE_NAME = "album-tokens";

function generateToken() {
  return randomBytes(16).toString("base64url");
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return new Response(
      JSON.stringify({ error: "ADMIN_SECRET not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { secret, count = 1, maxDownloads = 3 } = body;
  if (secret !== adminSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const num = Math.min(Math.max(Number(count) || 1, 1), 5000);
  const max = Math.min(Math.max(Number(maxDownloads) || 1, 1), 100);

  let baseUrl = process.env.SITE_URL || "";
  if (!baseUrl && req.headers.get("origin")) {
    baseUrl = req.headers.get("origin");
  }
  if (!baseUrl) {
    try {
      const u = new URL(req.url);
      baseUrl = `${u.protocol}//${u.host}`;
    } catch {}
  }
  baseUrl = baseUrl.replace(/\/$/, "");
  const downloadPath = "/download";

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const tokens = [];
  const urls = [];
  const now = new Date().toISOString();

  for (let i = 0; i < num; i++) {
    const token = generateToken();
    await store.setJSON(token, {
      remaining: max,
      max,
      exhausted_at: null,
      created_at: now,
    });
    tokens.push(token);
    urls.push(`${baseUrl}${downloadPath}/${token}`);
  }

  return new Response(
    JSON.stringify({ tokens, urls, count: num, maxDownloads: max }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
