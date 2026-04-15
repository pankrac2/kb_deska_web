/**
 * Admin: view download event log.
 * GET /api/admin/download-log?secret=ADMIN_SECRET
 * Optional: ?limit=100&token=FILTER_TOKEN
 * Returns: { entries: [ { id, token, timestamp, outcome, remaining_before, remaining_after, ip, user_agent }, ... ], count }
 */

import { getStore } from "@netlify/blobs";

const LOG_STORE = "download-log";

export default async (req) => {
  if (req.method !== "GET") {
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

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== adminSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 5000);
  const filterToken = url.searchParams.get("token") || null;

  const store = getStore({ name: LOG_STORE, consistency: "strong" });
  const entries = [];
  let cursor = undefined;

  do {
    const page = await store.list({ cursor });
    for (const blob of page.blobs || []) {
      const data = await store.get(blob.key, { type: "json" });
      if (!data) continue;
      if (filterToken && data.token !== filterToken) continue;
      entries.push({ id: blob.key, ...data });
      if (entries.length >= limit) break;
    }
    if (entries.length >= limit) break;
    cursor = page.cursor;
  } while (cursor);

  entries.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

  return new Response(
    JSON.stringify({ entries, count: entries.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
