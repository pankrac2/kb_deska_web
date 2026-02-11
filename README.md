# Album download site

Serverless album download site on **Netlify**: unique QR codes per booklet, limited downloads per code, no backoffice.

**→ [Step-by-step setup guide (SETUP_GUIDE.md)](SETUP_GUIDE.md)** — deploy online and generate QR codes.

- **Main page**: info + “use your booklet code”
- **Download page**: `/download/<token>` — shows remaining downloads and a download button
- **API**: token status + use (decrement + stream album from Netlify Blobs)
- **Admin**: upload album ZIP; generate new tokens via POST; optional export of exhausted codes

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
     - `ADMIN_SECRET` — strong random string; used for upload, generate, and exhausted APIs.
     - `SITE_URL` (optional) — e.g. `https://album.xxx.cz`; used when generating token URLs.
   - Deploy, then **upload the album ZIP** via `POST /api/admin/upload-album` (see below).

3. **Generate tokens and QR codes**
   - **First batch (e.g. 200):** Call the API (see below) or run the script, then generate QRs.
   - **More later:** Same; call generate again with the desired count.

## Environment variables (Netlify)

| Variable       | Required | Description |
|----------------|----------|-------------|
| `ADMIN_SECRET` | Yes      | Secret for upload, generate, and exhausted APIs. Use a long random string. |
| `SITE_URL`     | No       | Base URL of the site (e.g. `https://album.xxx.cz`). Used in generated download URLs. |

The album ZIP is stored in **Netlify Blobs** and uploaded via the admin API (see below). No external URL needed.

## Upload the album ZIP

Before customers can download, upload the album ZIP to Netlify Blobs:

```bash
curl -X POST https://album.xxx.cz/api/admin/upload-album \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET" \
  -F "file=@/path/to/album.zip"
```

On Windows (PowerShell), use:

```powershell
curl.exe -X POST https://album.xxx.cz/api/admin/upload-album `
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET" `
  -F "file=@C:\path\to\album.zip"
```

Alternatively, send the secret as a form field:

```bash
curl -X POST https://album.xxx.cz/api/admin/upload-album \
  -F "secret=YOUR_ADMIN_SECRET" \
  -F "file=@/path/to/album.zip"
```

The album is stored in Blobs and streamed to users when they use a valid token. Re-uploading replaces the previous album.

## Generate new tokens

### Option A: Call the API from your machine

```bash
SITE_URL=https://album.xxx.cz ADMIN_SECRET=your-secret node scripts/call-generate.mjs 200 3
```

- `200` = number of tokens to create  
- `3` = max downloads per token  

This POSTs to `/api/admin/generate` and appends the new URLs to `urls.json` (and writes the new ones to `urls-new.json`).

### Option B: curl

```bash
curl -X POST https://album.xxx.cz/api/admin/generate \
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
curl "https://album.xxx.cz/api/admin/exhausted?secret=YOUR_ADMIN_SECRET"
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
│   ├── download.mjs             # GET status, GET ?action=use → stream album
│   ├── admin-generate.mjs       # POST generate tokens
│   ├── admin-upload-album.mjs   # POST upload ZIP to Blobs
│   └── admin-exhausted.mjs      # GET list exhausted tokens
└── scripts/
    ├── call-generate.mjs     # Call generate API, save urls.json
    └── generate-qr.mjs      # URLs → QR PNGs
```

## Styling

Edit `public/styles.css`. Colours and fonts are in `:root` (e.g. `--color-accent`, `--font-heading`). Copy and wording are in `public/index.html` and `public/download.html`.

## Album storage

The album ZIP is stored in **Netlify Blobs** and uploaded via `POST /api/admin/upload-album`. When a user uses a valid token, the file is streamed directly from Blobs — no external storage or URL needed. The file is private; only token holders can download it through your site.
