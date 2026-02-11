/**
 * Download API: token status and use (decrement + stream album from Blobs).
 * GET /api/download/:token         → { valid, remaining, max, exhausted_at }
 * GET /api/download/:token?action=use → stream album ZIP (and decrement)
 */

import { getStore } from "@netlify/blobs";

const STORE_NAME = "album-tokens";
const ALBUM_KEY = "album:zip";

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

  const albumBlob = await store.get(ALBUM_KEY, { type: "stream" });
  if (!albumBlob) {
    return new Response(
      JSON.stringify({ error: "Album not uploaded yet. Use POST /api/admin/upload-album to upload the ZIP." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
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

  return new Response(albumBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="album.zip"',
      "Cache-Control": "no-store",
    },
  });
}
