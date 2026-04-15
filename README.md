# Album download site

Serverless album download site on **Netlify**: unique QR codes per booklet, limited downloads per code, no backoffice.

**→ [Step-by-step setup guide (SETUP_GUIDE.md)](SETUP_GUIDE.md)** — deploy online and generate QR codes.

- **Main page**: info + “use your booklet code”
- **Download page**: `/download/<token>` — shows remaining downloads and a download button
- **API**: token status + use (decrement + stream album from Netlify Blobs)
- **Admin**: upload album ZIP; generate new tokens; list/delete tokens; download log; refund downloads; export exhausted codes

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
| `ADMIN_SECRET` | Yes      | Secret for all admin APIs (upload, generate, list, delete, log, refund, exhausted). Use a long random string. |
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

Defaults: reads `urls.json` from the project root, writes SVGs to `qr-codes/`.  
Custom paths:

```bash
node scripts/generate-qr.mjs urls-new.json qr-codes-new
```

Then use the SVGs in your booklet layout or send to the printer.

## List all tokens

View all generated tokens and their current status:

```bash
curl "https://album.xxx.cz/api/admin/list-tokens?secret=YOUR_ADMIN_SECRET"
```

Filter by status — `active`, `exhausted`, or `all` (default):

```bash
curl "https://album.xxx.cz/api/admin/list-tokens?secret=YOUR_ADMIN_SECRET&status=active"
```

Returns `{ "tokens": [ { "token", "remaining", "max", "created_at", "exhausted_at" }, ... ], "count": N }`.

## Delete tokens

Remove one or more tokens permanently:

```bash
curl -X POST https://album.xxx.cz/api/admin/delete-tokens \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_ADMIN_SECRET","tokens":["token1","token2"]}'
```

Returns `{ "deleted": [...], "notFound": [...], "count": N }`.

## Download log

Every download attempt (`action=use`) is logged with outcome, IP, and user agent. View the log:

```bash
curl "https://album.xxx.cz/api/admin/download-log?secret=YOUR_ADMIN_SECRET"
```

Optional parameters: `&limit=100` (default 200, max 5000), `&token=SPECIFIC_TOKEN` (filter by token).

Each entry has: `id`, `token`, `timestamp`, `outcome` (`success`, `exhausted`, `invalid_token`, `album_missing`), `remaining_before`, `remaining_after`, `ip`, `user_agent`.

## Refund a download

If the log shows a "success" but the user didn't receive the file (e.g. network failure), restore their download count:

```bash
curl -X POST https://album.xxx.cz/api/admin/refund \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_ADMIN_SECRET","token":"THE_TOKEN","amount":1}'
```

`amount` defaults to 1. The remaining count will not exceed the original max.

Returns `{ "token", "remaining_before", "remaining_after", "max", "refunded" }`.

## Export exhausted codes (date/time when limit reached)

```bash
curl "https://album.xxx.cz/api/admin/exhausted?secret=YOUR_ADMIN_SECRET"
```

Returns `{ "exhausted": [ { "token", "exhausted_at", "max" }, ... ], "count": N }`. You can save this for your own records.

## Project layout

```
├── netlify.toml                 # Build, redirects, env
├── package.json
├── public/
│   ├── index.html               # Main page
│   ├── download.html            # Download page (token from URL path)
│   └── styles.css               # Editable band style (CSS variables)
├── netlify/functions/
│   ├── download.mjs             # GET status, GET ?action=use → stream album + log
│   ├── admin-generate.mjs       # POST generate tokens
│   ├── admin-upload-album.mjs   # POST upload ZIP to Blobs
│   ├── admin-list-tokens.mjs    # GET list all tokens with status
│   ├── admin-delete-tokens.mjs  # POST delete tokens
│   ├── admin-download-log.mjs   # GET download event log
│   ├── admin-refund.mjs         # POST refund download count
│   └── admin-exhausted.mjs      # GET list exhausted tokens
└── scripts/
    ├── call-generate.mjs        # Call generate API, save urls.json
    └── generate-qr.mjs          # URLs → QR SVGs
```

## Styling

Edit `public/styles.css`. Colours and fonts are in `:root` (e.g. `--color-accent`, `--font-heading`). Copy and wording are in `public/index.html` and `public/download.html`.

## Album storage

The album ZIP is stored in **Netlify Blobs** and uploaded via `POST /api/admin/upload-album`. When a user uses a valid token, the file is streamed directly from Blobs — no external storage or URL needed. The file is private; only token holders can download it through your site.
