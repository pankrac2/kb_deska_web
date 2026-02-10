/**
 * Download API: token status and use (decrement + redirect to album).
 * GET /api/download/:token         → { valid, remaining, max, exhausted_at }
 * GET /api/download/:token?action=use → 302 redirect to album (and decrement)
 */

import { getStore } from "@netlify/blobs";

const STORE_NAME = "album-tokens";

function parseToken(req) {
  try {
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get("token");
    if (fromQuery) return fromQuery;
    const match = url.pathname.match(/^\/api\/download\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getTokenData(store, token) {
  return store.get(token, { type: "json" });
}

export default async (req, context) => {
  const token = parseToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing or invalid token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const data = await getTokenData(store, token);

  if (!data) {
    return new Response(
      JSON.stringify({ valid: false, error: "Unknown or invalid code" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const { remaining = 0, max = 1, exhausted_at = null } = data;
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Status only
  if (action !== "use") {
    return new Response(
      JSON.stringify({
        valid: true,
        remaining,
        max,
        exhausted_at,
        message:
          remaining > 0
            ? `${remaining} download(s) left`
            : "This code has already been used.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Use one download
  if (remaining <= 0) {
    return new Response(
      JSON.stringify({
        valid: true,
        remaining: 0,
        max,
        exhausted_at,
        error: "No downloads left for this code.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const albumUrl = process.env.ALBUM_FILE_URL;
  if (!albumUrl) {
    return new Response(
      JSON.stringify({ error: "Download not configured (ALBUM_FILE_URL missing)" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const newRemaining = remaining - 1;
  const now = new Date().toISOString();
  const newData = {
    ...data,
    remaining: newRemaining,
    exhausted_at: newRemaining === 0 ? now : (data.exhausted_at || null),
  };
  await store.setJSON(token, newData);

  return new Response(null, {
    status: 302,
    headers: {
      Location: albumUrl,
      "Cache-Control": "no-store",
    },
  });
}
