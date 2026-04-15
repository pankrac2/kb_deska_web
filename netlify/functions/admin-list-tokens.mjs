/**
 * Admin: list all tokens with their current status.
 * GET /api/admin/list-tokens?secret=ADMIN_SECRET
 * Optional: ?status=active|exhausted|all (default: all)
 * Returns: { tokens: [ { token, remaining, max, created_at, exhausted_at }, ... ], count }
 */

import { getStore } from "@netlify/blobs";

const STORE_NAME = "album-tokens";
const INTERNAL_KEY_PREFIX = "album:";
const LOG_KEY_PREFIX = "log:";

function isTokenKey(key) {
  return key && !key.startsWith(INTERNAL_KEY_PREFIX) && !key.startsWith(LOG_KEY_PREFIX);
}

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

  const statusFilter = (url.searchParams.get("status") || "all").toLowerCase();
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  const tokens = [];
  let cursor = undefined;
  do {
    const page = await store.list({ cursor });
    for (const blob of page.blobs || []) {
      if (!isTokenKey(blob.key)) continue;
      const data = await store.get(blob.key, { type: "json" });
      if (!data || typeof data.remaining === "undefined") continue;

      const isExhausted = data.remaining <= 0 || !!data.exhausted_at;
      if (statusFilter === "active" && isExhausted) continue;
      if (statusFilter === "exhausted" && !isExhausted) continue;

      tokens.push({
        token: blob.key,
        remaining: data.remaining,
        max: data.max,
        created_at: data.created_at || null,
        exhausted_at: data.exhausted_at || null,
      });
    }
    cursor = page.cursor;
  } while (cursor);

  tokens.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));

  return new Response(
    JSON.stringify({ tokens, count: tokens.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
