# Album download site — Kona Boj

Serverless album download site on **Netlify**: unique QR codes per booklet, limited downloads per code, no backoffice.

**→ [Step-by-step setup guide (SETUP_GUIDE.md)](SETUP_GUIDE.md)** — deploy online and generate QR codes.

- **Main page**: info + “use your booklet code”
- **Download page**: `/download/<token>` — shows remaining downloads and a download button
- **API**: token status + use (decrement + redirect to album file)
- **Admin**: generate new tokens via POST; optional export of exhausted codes

## Quick start

1. **Install and run locally**
   ```bash
   npm install
   npm run dev
   ```
   Open the URL Netlify CLI prints (e.g. http://localhost:8888). Set env vars in Netlify UI or in `.env` for `netlify dev`.

2. **Deploy to Netlify**
   - Connect the repo in Netlify (GitHub/GitLab).
   - Set **environment variables** (Site settings → Environment variables):
     - `ADMIN_SECRET` — strong random string; used to call the generate API and the exhausted list.
     - `ALBUM_FILE_URL` — full URL of the album ZIP (e.g. S3 signed URL, or any URL that serves the file). Users are redirected here after a valid “use” request.
     - `SITE_URL` (optional) — e.g. `https://album.konaboj.cz`; used when generating token URLs. If unset, the API uses the request origin.
   - Deploy. Your site will be at the Netlify URL or your custom domain.

3. **Generate tokens and QR codes**
   - **First batch (e.g. 200):** Call the API (see below) or run the script, then generate QRs.
   - **More later:** Same; call generate again with the desired count.

## Environment variables (Netlify)

| Variable          | Required | Description |
|-------------------|----------|-------------|
| `ADMIN_SECRET`    | Yes      | Secret for `/api/admin/generate` and `/api/admin/exhausted`. Use a long random string. |
| `ALBUM_FILE_URL` | Yes      | URL where the album ZIP is served. User is redirected here when they “use” one download. |
| `SITE_URL`       | No       | Base URL of the site (e.g. `https://album.konaboj.cz`). Used in generated download URLs. |

## Generate new tokens

### Option A: Call the API from your machine

```bash
SITE_URL=https://album.konaboj.cz ADMIN_SECRET=your-secret node scripts/call-generate.mjs 200 3
```

- `200` = number of tokens to create  
- `3` = max downloads per token  

This POSTs to `/api/admin/generate` and appends the new URLs to `urls.json` (and writes the new ones to `urls-new.json`).

### Option B: curl

```bash
curl -X POST https://album.konaboj.cz/api/admin/generate \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_ADMIN_SECRET","count":200,"maxDownloads":3}'
```

Response: `{ "tokens": [...], "urls": ["https://...", ...], "count": 200, "maxDownloads": 3 }`. Save the `urls` array to a file for the QR script.

## Generate QR code images

After you have a JSON file with an `urls` array (or a plain array of URLs):

```bash
npm run generate-qr
```

Defaults: reads `urls.json` from the project root, writes PNGs to `qr-codes/`.  
Custom paths:

```bash
node scripts/generate-qr.mjs urls-new.json qr-codes-new
```

Then use the PNGs in your booklet layout or send to the printer.

## Export exhausted codes (date/time when limit reached)

```bash
curl "https://album.konaboj.cz/api/admin/exhausted?secret=YOUR_ADMIN_SECRET"
```

Returns `{ "exhausted": [ { "token", "exhausted_at", "max" }, ... ], "count": N }`. You can save this for your own records.

## Project layout

```
├── netlify.toml              # Build, redirects, env
├── package.json
├── public/
│   ├── index.html            # Main page
│   ├── download.html         # Download page (token from URL path)
│   └── styles.css             # Editable band style (CSS variables)
├── netlify/functions/
│   ├── download.mjs          # GET status, GET ?action=use → redirect
│   ├── admin-generate.mjs    # POST generate tokens
│   └── admin-exhausted.mjs   # GET list exhausted tokens
└── scripts/
    ├── call-generate.mjs     # Call generate API, save urls.json
    └── generate-qr.mjs      # URLs → QR PNGs
```

## Styling

Edit `public/styles.css`. Colours and fonts are in `:root` (e.g. `--color-accent`, `--font-heading`). Copy and wording are in `public/index.html` and `public/download.html`.

## Where to host the album ZIP

The site only redirects to `ALBUM_FILE_URL`; it does not store the file. Options:

- **Netlify Blob / S3 / R2 / Backblaze B2**: Upload the ZIP, create a long-lived signed URL (or a public URL if you prefer), set it as `ALBUM_FILE_URL`.
- **Dropbox / Google Drive**: Use a “direct download” link (if available) as `ALBUM_FILE_URL`.

For large files and many downloads, use a CDN or object storage with enough bandwidth.
