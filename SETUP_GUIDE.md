# Step-by-step: Setting up the album download site online

Follow these steps to get the site live on Netlify and start generating QR codes for your booklets.

---

## Before you start

- A **Netlify account** (free): [netlify.com](https://www.netlify.com) → Sign up
- Your **album ZIP file** ready (the file customers will download)
- This project in a **Git repository** (GitHub, GitLab, or Bitbucket) — or you can deploy by drag-and-drop first to test

---

## Step 1: Host the album file and get a URL

The site will redirect customers to this URL after they use a valid code. You need a URL that serves your ZIP file.

### Option A: Netlify Blob (same account, no extra service)

1. You’ll upload the album after the site exists (see Step 5).  
2. For now, you can use any **temporary** URL (e.g. a file host) and change it later to the Netlify Blob URL.

### Option B: Cloudflare R2 (free tier, private file)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 Object Storage.
2. Create a bucket (e.g. `album-downloads`), keep it **private**.
3. Upload your album ZIP.
4. Create an **API token** with R2 read access.
5. You’ll generate **signed URLs** from your Netlify function (optional; see “Private album” section later).  
   For the simplest start, you can use a **public** R2 URL or another host and set that as `ALBUM_FILE_URL`.

### Option C: Simple file host (e.g. Dropbox, Google Drive)

1. Upload the ZIP and get a **direct download link** (e.g. Dropbox “Get link” → change `?dl=0` to `?dl=1` for direct download).
2. Use this link as `ALBUM_FILE_URL`.  
   Note: anyone with the link can download; the token only limits who gets the link from your site.

**For this guide we assume you have one URL** (from any option above). If you don’t yet, use a placeholder like `https://example.com/album.zip` and replace it in Step 4 after you have the real URL.

---

## Step 2: Push the project to Git (if you haven’t)

```bash
cd d:\data\projects\kb_deska_web
git init
git add .
git commit -m "Initial album download site"
```

Create a repo on GitHub/GitLab/Bitbucket and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

(Use your actual repo URL.)

---

## Step 3: Create the site on Netlify

1. Go to [app.netlify.com](https://app.netlify.com) and log in.
2. Click **“Add new site”** → **“Import an existing project”**.
3. Choose **GitHub** (or GitLab/Bitbucket), authorize Netlify if asked.
4. Pick the repository that contains this project.
5. **Build settings** (Netlify should detect them from `netlify.toml`; verify):
   - **Build command:** `npm run build` (or leave default)
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions` (or leave default)
6. **Do not** add environment variables yet — click **“Deploy site”** (or “Deploy” without env vars).

Wait for the first deploy to finish. You’ll get a URL like `https://random-name-12345.netlify.app`.

---

## Step 4: Set environment variables

1. In Netlify: **Site overview** → **Site configuration** → **Environment variables** (or **Site settings** → **Environment variables**).
2. Click **“Add a variable”** / **“Add environment variable”** and add these one by one.

| Variable           | Value                    | Scopes      |
|--------------------|--------------------------|-------------|
| `ADMIN_SECRET`     | A long random string     | All         |
| `ALBUM_FILE_URL`   | Full URL of the album ZIP| All         |
| `SITE_URL`         | Your site URL (see below)| All (optional) |

- **ADMIN_SECRET**  
  Generate a random string (e.g. 32+ characters). You’ll use it to call the generate API and the exhausted list.  
  Example (run in terminal): `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`

- **ALBUM_FILE_URL**  
  The exact URL where the album ZIP is available (e.g. `https://your-bucket.s3.amazonaws.com/album.zip` or your Dropbox/R2 direct link).

- **SITE_URL**  
  Your public site URL. For a custom domain use that (e.g. `https://album.konaboj.cz`). For the default Netlify URL use e.g. `https://random-name-12345.netlify.app`.  
  If you don’t set it, the API will use the request host when generating links; setting it is recommended.

3. Save. Then trigger a **new deploy** so the new env vars are applied: **Deploys** → **Trigger deploy** → **Deploy site**.

---

## Step 5: (Optional) Add a custom domain

1. **Site configuration** → **Domain management** → **Add domain** / **Add custom domain**.
2. Enter your domain (e.g. `album.konaboj.cz`).
3. Follow Netlify’s instructions to add the DNS records at your domain provider (CNAME or A record).
4. Enable **HTTPS** (Netlify will issue a certificate automatically).
5. Set **SITE_URL** (in env vars) to `https://album.konaboj.cz` (or your chosen domain) and redeploy once.

---

## Step 6: Verify the site works

1. **Main page**  
   Open `https://your-site.netlify.app` (or your custom domain). You should see the main page with the link to the download page.

2. **Download page without token**  
   Open `https://your-site.netlify.app/download/`. You should see a message that the address is invalid or the code is missing.

3. **Generate a test token**  
   In a terminal (or Postman):

   ```bash
   curl -X POST https://YOUR-SITE.netlify.app/api/admin/generate ^
     -H "Content-Type: application/json" ^
     -d "{\"secret\":\"YOUR_ADMIN_SECRET\",\"count\":1,\"maxDownloads\":3}"
   ```

   (On macOS/Linux use `\` for line continuation and single quotes: `-d '{"secret":"...","count":1,"maxDownloads":3}'`.)

   You should get JSON with `urls` containing one URL like `https://your-site.netlify.app/download/xxxxx`.

4. **Test the download page**  
   Open that URL in the browser. You should see “X download(s) left” and a “Stáhnout album” button.  
   Click it: you should be redirected to `ALBUM_FILE_URL` and the download should start (or the file should open).  
   Refresh the page: remaining count should decrease. After 3 uses (if you used `maxDownloads: 3`) it should show that the code is used up.

If anything fails, check **Site configuration** → **Functions** and **Deploy** logs for errors.

---

## Step 7: Generate tokens and QR codes locally

1. **Install dependencies** (if not already):

   ```bash
   cd d:\data\projects\kb_deska_web
   npm install
   ```

2. **Create a `.env` file** (copy from `.env.example`) and set:

   ```env
   SITE_URL=https://your-site.netlify.app
   ADMIN_SECRET=the-same-secret-you-set-in-netlify
   ```

   (Use your real Netlify URL or custom domain.)

3. **Generate tokens** (e.g. 200 codes, 3 downloads each):

   ```bash
   node scripts/call-generate.mjs 200 3
   ```

   This calls the Netlify API and writes URLs to `urls.json` and `urls-new.json`.

4. **Generate QR code images**:

   ```bash
   node scripts/generate-qr.mjs urls-new.json qr-codes
   ```

   PNGs will be in the `qr-codes` folder. Use them in your booklet layout or send to the printer.

5. **When you need more tokens later**, run the same with a different count:

   ```bash
   node scripts/call-generate.mjs 100 3
   node scripts/generate-qr.mjs urls-new.json qr-codes-batch2
   ```

---

## Step 8: (Optional) Export list of used codes

To see when codes were exhausted (for your records):

```bash
curl "https://your-site.netlify.app/api/admin/exhausted?secret=YOUR_ADMIN_SECRET"
```

Save the JSON to a file if you need it for accounting.

---

## Checklist

- [ ] Repo pushed to GitHub/GitLab/Bitbucket  
- [ ] New site created on Netlify, connected to repo  
- [ ] First deploy successful  
- [ ] `ADMIN_SECRET` set in Netlify env  
- [ ] `ALBUM_FILE_URL` set (real URL of the album ZIP)  
- [ ] `SITE_URL` set (optional but recommended)  
- [ ] New deploy triggered after adding env vars  
- [ ] Custom domain added and HTTPS on (if you use one)  
- [ ] Test token generated and download flow tested  
- [ ] Local `.env` with `SITE_URL` and `ADMIN_SECRET`  
- [ ] First batch of tokens generated with `call-generate.mjs`  
- [ ] QR codes generated with `generate-qr.mjs` and used in booklet  

---

## Troubleshooting

- **“ADMIN_SECRET not configured”** → Add `ADMIN_SECRET` in Netlify and redeploy.  
- **“Download not configured (ALBUM_FILE_URL missing)”** when clicking Stáhnout → Add `ALBUM_FILE_URL` and redeploy.  
- **Redirect doesn’t start download** → Check that `ALBUM_FILE_URL` is a direct file URL (not a page that shows a “Download” button). For Dropbox, use `?dl=1`.  
- **QR script says “No URLs found”** → Run `call-generate.mjs` first so that `urls.json` or `urls-new.json` exists and contains an `urls` array.

If you tell me your hosting choice for the album file (Netlify Blob, R2, S3, etc.), I can add a short “Private album (signed URL)” section to this guide.
