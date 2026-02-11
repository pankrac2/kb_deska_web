/**
 * Admin: upload album ZIP to Netlify Blobs.
 * POST /api/admin/upload-album
 * Body: multipart/form-data with field "file" (the ZIP file)
 * Header or body: secret (ADMIN_SECRET)
 *
 * Stores in Blobs under key "album:zip". Replaces any existing album.
 */

import { getStore } from "@netlify/blobs";

const STORE_NAME = "album-tokens";
const ALBUM_KEY = "album:zip";

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

  // Parse multipart body once (consumes request body)
  let form;
  try {
    form = await req.formData();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid multipart body: " + (e.message || "unknown") }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Secret from header or form field
  const headerSecret = req.headers.get("x-admin-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const formSecret = form.get("secret")?.toString?.() || "";
  const secret = headerSecret || formSecret;

  if (secret !== adminSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return new Response(
      JSON.stringify({ error: "No file uploaded. Send multipart/form-data with field 'file' containing the ZIP." }),
      { status: 400,
        headers: { "Content-Type": "application/json" } }
    );
  }

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  await store.set(ALBUM_KEY, file, {
    metadata: { uploadedAt: new Date().toISOString(), size: file.size },
  });

  return new Response(
    JSON.stringify({
      ok: true,
      message: "Album uploaded successfully",
      size: file.size,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
