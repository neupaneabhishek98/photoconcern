# Photo Concern - Local Setup Guide

This is the runbook for getting the site running on your machine after the Drive + Fonepay merge.

## What changed in this merge

- **services/drive.services.js** (new) — uploads design photos to your Google Drive at `photoconcern65@gmail.com`. Layout: `Online Orders / YYYY-MM-DD / <Customer Name> - <orderId> /`.
- **services/fonepay.services.js** (new) — generates a Fonepay dynamic QR for an order.
- **routes/order.routes.js** — `/api/orders/:id/upload-designs` now uploads to Drive by default (was Cloudflare R2). New endpoints: `POST /api/orders/:id/pay/fonepay` and `POST /api/orders/webhook/fonepay`. The eSewa/Khalti commented-out placeholders were removed to keep the file clean.
- **models/order.models.js** — added `"fonepay"` to the payment-method enum; added `driveFolderId`, `driveFolderUrl`, and `fonepayReference` fields.
- **package.json** — added `googleapis`, `google-auth-library`, `qrcode`.
- **.env** / **.env.example** — added all the new env vars with comments.

The old R2 uploader is still wired up — set `STORAGE_BACKEND=r2` in `.env` to use it instead of Drive.

## Prerequisites

1. **Node.js 18+** — `node --version` to check.
2. **MongoDB** — either local Community Edition (https://www.mongodb.com/try/download/community) or a free Atlas cluster (https://www.mongodb.com/cloud/atlas).
3. **Google Cloud Service Account JSON** — see step 3 below.

## Steps to run

### 1. Install dependencies

```powershell
cd "D:\Claude Projects\Photo Concern Website\Ecommerce-web"
npm install
```

(The merge added `googleapis`, `google-auth-library`, and `qrcode`; everything else is already in your `node_modules`.)

### 2. Configure MongoDB

Edit `.env` and set `atlas_url`:

- **Local MongoDB**: install Community Edition, start the service, then leave the default:
  ```
  atlas_url=mongodb://127.0.0.1:27017/photoconcern
  ```
- **Atlas**: create a free M0 cluster, add a DB user, allow your IP, then copy the connection string into `atlas_url`. Make sure to URL-encode special characters in the password.

Test the connection by booting the server (step 6) — you'll see `Mongoose for submission connected successfully` on success.

### 3. Set up the Google Drive service account

Photos go to **your** Drive (`photoconcern65@gmail.com`), not the customer's. That's done with a Google service account.

1. Go to https://console.cloud.google.com and create a project (or reuse one).
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **IAM & Admin → Service Accounts → Create service account** → name it e.g. `photoconcern-uploader`. No roles needed. Done.
4. Click the service account you just created → **Keys → Add Key → Create new key → JSON**. A file like `your-project-xxxxxx.json` downloads.
5. Move that file into `Ecommerce-web/config/` and rename it to `service-account.json`. The path should be:
   ```
   D:\Claude Projects\Photo Concern Website\Ecommerce-web\config\service-account.json
   ```
   (This file is gitignored — never commit it.)
6. Open that JSON and copy the value of `"client_email"` — looks like `photoconcern-uploader@your-project.iam.gserviceaccount.com`.
7. In Drive (logged in as `photoconcern65@gmail.com`), create a folder called **Online Orders**. Right-click → **Share** → paste the `client_email` → **Editor** → Send.

That's it. The service account can now create subfolders and upload files into `Online Orders/`.

### 3b. Set up Google Sign-In (for customer login/signup)

The login and signup pages have a "Continue with Google" button. To make it work:

1. https://console.cloud.google.com → **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. If prompted, configure the OAuth consent screen first (User type: External; app name: Photo Concern; user support email: yours; scopes: leave default; test users: add your own Gmail while in Testing).
3. Application type: **Web application**.
4. **Authorized JavaScript origins**: add `http://localhost:3000`. Add your production URL later.
5. **Authorized redirect URIs**: not needed — we use the GIS popup flow.
6. Copy the resulting **Client ID** (looks like `1234-abc.apps.googleusercontent.com`) into `.env`:
   ```
   GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com
   ```
7. Restart the server. The "Continue with Google" button now works.

Existing local accounts with the same email get linked on first Google sign-in (their `googleId` is filled in). New users get a password-less customer account created automatically.

### 3c. Deploy on Render

The repo includes `render.yaml`, so Render can create the web service from the repository blueprint.

1. In Render, create a **Blueprint** from `https://github.com/neupaneabhishek98/Photo-Concern-Website`.
2. Render will use:
   - Build command: `npm install`
   - Start command: `npm start`
   - Runtime: Node
3. Fill the required environment variables that are marked `sync: false` in `render.yaml`:
   - `atlas_url`
   - `GOOGLE_CLIENT_ID`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
4. For Google Drive uploads, add a Render secret file named `service-account.json` mounted at:
   ```
   /etc/secrets/service-account.json
   ```
   Keep `GOOGLE_SERVICE_ACCOUNT_KEYFILE=/etc/secrets/service-account.json`.
5. After Render gives you the live service URL, add that exact origin to your Google OAuth client:
   ```
   https://your-render-service.onrender.com
   ```
   Authorized redirect URIs are still not needed because this uses Google Identity Services popup flow.
6. Redeploy the Render service after changing OAuth or environment variables.

### 4. Set Fonepay mode

Until you have Fonepay merchant credentials, leave `.env` set to:
```
FONEPAY_MODE=test
```
This makes `/api/orders/:id/pay/fonepay` return a test QR (a JSON payload encoded as a PNG data-URL) so the frontend flow is fully testable. When you onboard with Fonepay:
- Fill in `FONEPAY_MERCHANT_CODE`, `FONEPAY_USERNAME`, `FONEPAY_PASSWORD`, `FONEPAY_SECRET_KEY`.
- Set `FONEPAY_MODE=live`.
- Implement `requestLiveQr()` in `services/fonepay.services.js` per the merchant kit Fonepay gave you.

### 5. (Optional) Email & WhatsApp

If these are left blank, the contact form and WhatsApp notifications just no-op. They don't block orders from being placed.
- Email: `EMAIL_USER` = your Gmail address, `EMAIL_PASS` = a Gmail App Password (not your normal password — create one at https://myaccount.google.com/apppasswords).
- WhatsApp: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `ADMIN_WHATSAPP=whatsapp:+977XXXXXXXXXX` from your Twilio account.

### 6. Verify your setup, then start the server

```powershell
npm run check     # prints a green/yellow/red checklist of your config
npm start
```

`npm run check` runs `scripts/check-setup.js` and tells you exactly what's missing — node_modules, env vars, service-account JSON, etc. If it reports a red ✗, fix that before `npm start`.

You should see:
```
Server is running on port 3000
Mongoose for submission connected successfully
[admin] Seeded admin: admin   (only on first boot)
```

Open http://localhost:3000 in your browser.

The seeded admin login uses `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`. Change both before deploying.

## API additions / changes

| Endpoint | Method | What it does |
|---|---|---|
| `/api/orders/:id/upload-designs` | POST | Uploads design photos. Backend chosen by `STORAGE_BACKEND` env (`drive` by default). Returns `{ urls, folderUrl, backend }`. |
| `/api/orders/:id/pay/fonepay` | POST | Returns `{ qr: { qrDataUrl, reference, amount, ... } }`. Frontend renders `qrDataUrl` as an `<img>`. |
| `/api/orders/webhook/fonepay` | POST | Endpoint to register on the Fonepay merchant portal. Marks the order as paid when called with a matching reference. |

## Drive folder layout

Every successful upload produces:

```
Online Orders/
└── 2026-05-14/
    └── John Doe - 2082-3/
        ├── photo1.jpg
        ├── photo2.jpg
        └── ...
```

- **Date**: server-local date in `YYYY-MM-DD`.
- **Customer name**: pulled from the logged-in user's profile (`full_name` → `studio_name` → `free_name` → email fallback).
- **Order ID suffix**: the Nepali-BS order id from `order.orderId` so multiple same-day orders from the same customer don't collide.

## Troubleshooting

- **"Cannot find module 'googleapis'"** → you didn't run `npm install` after pulling the merge.
- **"Service account keyfile not found"** → `config/service-account.json` is missing or the path in `.env` is wrong.
- **"Drive folder 'Online Orders' was not found"** → you didn't share the folder with the service account's `client_email`, or you spelled the name differently.
- **"MongoDB connection failed for submission"** → check `atlas_url` in `.env`. For local MongoDB, make sure the service is running. For Atlas, check IP allowlist and password URL-encoding.
- **Server starts but `/` returns 502 / blank** → check the terminal logs; usually a misconfigured env var.
