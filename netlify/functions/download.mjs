/**
 * Download API: token status and use (decrement + stream album from Blobs).
 * GET /api/download/:token         → { valid, remaining, max, exhausted_at }
 * GET /api/download/:token?action=use → stream album ZIP (and decrement)
 *
 * Every action=use attempt is logged to the "download-log" store.
 */

import { getStore } from "@netlify/blobs";
import { randomBytes } from "crypto";

const STORE_NAME = "album-tokens";
const LOG_STORE = "download-log";
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

function clientInfo(req) {
  return {
    ip: req.headers.get("x-nf-client-connection-ip") ||
        req.headers.get("x-forwarded-for") ||
        "unknown",
    user_agent: req.headers.get("user-agent") || "unknown",
  };
}

async function writeLog(token, outcome, remainingBefore, remainingAfter, req) {
  try {
    const logStore = getStore({ name: LOG_STORE, consistency: "strong" });
    const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
    await logStore.setJSON(id, {
      token,
      timestamp: new Date().toISOString(),
      outcome,
      remaining_before: remainingBefore,
      remaining_after: remainingAfter,
      ...clientInfo(req),
    });
  } catch {
    // Logging must not break the download flow
  }
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
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "use") {
      await writeLog(token, "invalid_token", null, null, req);
    }
    return new Response(
      JSON.stringify({ valid: false, error: "Unknown or invalid code" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const { remaining = 0, max = 1, exhausted_at = null } = data;
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

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

  if (remaining <= 0) {
    await writeLog(token, "exhausted", 0, 0, req);
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
    await writeLog(token, "album_missing", remaining, remaining, req);
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

  await writeLog(token, "success", remaining, newRemaining, req);

  return new Response(albumBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="album.zip"',
      "Cache-Control": "no-store",
    },
  });
}
