/**
 * Admin: list tokens that are exhausted (optional export for reporting).
 * GET /api/admin/exhausted?secret=ADMIN_SECRET
 * Returns: { exhausted: [ { token, exhausted_at, max }, ... ] }
 *
 * Note: Netlify Blobs does not support "list all keys" in the same way as a DB.
 * We store an index key "exhausted:list" that we append to when a token is exhausted.
 * Alternatively we could scan — but Blobs has list() with pagination. We'll use list()
 * to iterate all keys in the store, then get each value and filter exhausted.
 */

import { getStore } from "@netlify/blobs";

const STORE_NAME = "album-tokens";

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

  const store = getStore({ name: STORE_NAME });
  const exhausted = [];
  const list = await store.list();
  for (const blob of list.blobs || []) {
    const token = blob.key;
    if (!token) continue;
    const data = await store.get(token, { type: "json" });
    if (data && data.exhausted_at) {
      exhausted.push({
        token,
        exhausted_at: data.exhausted_at,
        max: data.max,
      });
    }
  }

  exhausted.sort((a, b) =>
    (a.exhausted_at || "").localeCompare(b.exhausted_at || "")
  );

  return new Response(
    JSON.stringify({ exhausted, count: exhausted.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
