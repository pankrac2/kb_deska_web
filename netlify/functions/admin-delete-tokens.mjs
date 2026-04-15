/**
 * Admin: delete one or more tokens.
 * POST /api/admin/delete-tokens
 * Body: { secret, tokens: ["token1", "token2", ...] }
 * Returns: { deleted: [...], notFound: [...], count: N }
 */

import { getStore } from "@netlify/blobs";

const STORE_NAME = "album-tokens";

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

  const { secret, tokens } = body;
  if (secret !== adminSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(tokens) || tokens.length === 0) {
    return new Response(
      JSON.stringify({ error: "Provide a non-empty 'tokens' array" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const deleted = [];
  const notFound = [];

  for (const token of tokens) {
    if (typeof token !== "string" || !token) continue;
    const data = await store.get(token, { type: "json" });
    if (!data) {
      notFound.push(token);
      continue;
    }
    await store.delete(token);
    deleted.push(token);
  }

  return new Response(
    JSON.stringify({ deleted, notFound, count: deleted.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
