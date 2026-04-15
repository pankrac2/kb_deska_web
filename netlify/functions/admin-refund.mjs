/**
 * Admin: refund download(s) for a token (restore remaining count).
 * POST /api/admin/refund
 * Body: { secret, token, amount } — amount defaults to 1
 * Returns: { token, remaining_before, remaining_after, max }
 *
 * Use this when the download log shows a "success" entry but the client
 * didn't actually receive the file (e.g. network failure mid-transfer).
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

  const { secret, token, amount = 1 } = body;
  if (secret !== adminSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!token || typeof token !== "string") {
    return new Response(
      JSON.stringify({ error: "Provide a 'token' string" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const refundAmount = Math.max(1, Math.min(Number(amount) || 1, 100));
  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const data = await store.get(token, { type: "json" });

  if (!data) {
    return new Response(
      JSON.stringify({ error: "Token not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const remainingBefore = data.remaining;
  const newRemaining = Math.min(data.remaining + refundAmount, data.max);
  const newData = {
    ...data,
    remaining: newRemaining,
    exhausted_at: newRemaining > 0 ? null : data.exhausted_at,
  };
  await store.setJSON(token, newData);

  return new Response(
    JSON.stringify({
      token,
      remaining_before: remainingBefore,
      remaining_after: newRemaining,
      max: data.max,
      refunded: newRemaining - remainingBefore,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
