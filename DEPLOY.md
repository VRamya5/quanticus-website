# Quanticus Deployment Guide (Render + Vercel)

This guide walks you through deploying the complete **Quanticus** application using a single GitHub repository:
- **Backend & PostgreSQL Database**: Hosted on **Render** (Free Plan).
- **Frontend & Admin Portal**: Hosted on **Vercel** (Free Plan).
- **Unified Domain**: Vercel serves the static site and transparently forwards all `/api/*` requests to Render, maintaining session cookies and single-origin security.

---

## Architecture Overview

```
[ Visitor / Admin Browser ]
            │
            ▼
┌──────────────────────────────────────┐
│        Vercel (Frontend)             │
│  - Static HTML, CSS, JS, Assets      │
│  - Admin Dashboard (/admin)          │
│  - Reverse-Proxy Rewrite for /api/*  │
└──────────────────┬───────────────────┘
                   │ /api/* (rewritten)
                   ▼
┌──────────────────────────────────────┐
│        Render (Backend API)          │
│  - Node.js & Express REST API        │
│  - Session Auth (connect-pg-simple)  │
│  - In-Memory Multer & Sharp WebP     │
└──────────────────┬───────────────────┘
                   │ PostgreSQL (BYTEA storage)
                   ▼
┌──────────────────────────────────────┐
│        Render PostgreSQL             │
│  - Resumes (BYTEA, private)          │
│  - Director Photos (BYTEA, public)   │
│  - Roles, Inquiries, Admin Sessions  │
└──────────────────────────────────────┘
```

---

## Deployment Order of Operations

1. **Step 1**: Create a PostgreSQL Database on Render.
2. **Step 2**: Create the Web Service on Render for the backend.
3. **Step 3**: Configure the Render URL in `frontend/vercel.json` and deploy to Vercel.
4. **Step 4**: Copy your Vercel URL and add it to `ALLOWED_ORIGINS` in Render.
5. **Step 5**: Run the post-deployment verification checklist.

---

## Step 1: Create Render PostgreSQL Database

1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the top right and select **PostgreSQL**.
3. Fill in the fields:
   - **Name**: `quanticus-db`
   - **Database**: `quanticus`
   - **User**: `quanticus_user`
   - **Region**: Select the region closest to you (e.g. *Oregon (US West)* or *Frankfurt (EU)*).
   - **PostgreSQL Version**: `16` (or latest).
   - **Plan**: **Free**.
4. Click **Create Database**.
5. Once created, scroll down to the **Connections** section:
   - Find the **Internal Database URL** (e.g. `postgres://quanticus_user:...@dpg-...-a/quanticus`).
   - Copy this URL. *(Use the Internal Database URL because the Web Service will be hosted in the same Render region, offering zero-latency and free internal traffic).*

---

## Step 2: Create Render Web Service (Backend)

1. In Render Dashboard, click **New +** and select **Web Service**.
2. Connect your **GitHub repository** (`Quanticus-website`).
3. Configure the service settings:
   - **Name**: `quanticus-api` (or your chosen name)
   - **Region**: Same region as your database in Step 1.
   - **Branch**: `main` (or your deployment branch)
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:prod`
   - **Plan**: **Free**
4. Scroll down, expand **Advanced**, and set:
   - **Health Check Path**: `/api/health`
5. Under **Environment Variables**, click **Add Environment Variable** for each:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production security and secure cookies |
| `PORT` | `3000` | Internal server port |
| `DATABASE_URL` | *(Paste Internal Database URL from Step 1)* | Database connection with automatic SSL |
| `ADMIN_EMAIL` | `admin@quanticustech.com` | First admin account email |
| `ADMIN_PASSWORD` | *(Create a strong password)* | Initial admin password for dashboard login |
| `SESSION_SECRET` | *(Generate a 64-character random string)* | Secret for signing session cookies |
| `TRUST_PROXY` | `2` | Trusts proxy headers from Vercel & Render |
| `ALLOWED_ORIGINS` | `http://localhost:3000` *(Temporary until Step 4)* | Allowed CORS/CSRF origin |

6. Click **Create Web Service**.
7. Wait 2–3 minutes for the build and initial migration (`npm run start:prod`) to complete.
8. Copy your Render Web Service URL from the top of the dashboard (e.g., `https://quanticus-api.onrender.com`).

---

## Step 3: Configure and Deploy Frontend to Vercel

### 3.1 Update `frontend/vercel.json`

Open `frontend/vercel.json` in your code editor and replace `YOUR-RENDER-SERVICE` with your actual Render service name:

```json
{
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/(assets|css|js)/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400, must-revalidate" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://quanticus-api.onrender.com/api/:path*"
    },
    {
      "source": "/admin",
      "destination": "/admin/index.html"
    }
  ]
}
```

Commit and push this change to your repository:
```bash
git add frontend/vercel.json
git commit -m "Configure production Render backend URL in vercel.json"
git push origin main
```

### 3.2 Import Project in Vercel

1. Log in to [Vercel Dashboard](https://vercel.com/).
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository.
4. In the **Configure Project** screen:
   - **Project Name**: `quanticus-website`
   - **Framework Preset**: `Other`
   - **Root Directory**: Click **Edit** and choose `frontend`.
   - **Build Command**: Leave empty / disabled.
   - **Output Directory**: Leave empty / default (`.`).
5. Click **Deploy**.
6. Once deployed, copy your live Vercel URL (e.g., `https://quanticus-website.vercel.app`).

---

## Step 4: Link Vercel Domain in Render (`ALLOWED_ORIGINS`)

1. Go back to [Render Dashboard](https://dashboard.render.com/) -> Select your `quanticus-api` service.
2. Click **Environment** in the left sidebar.
3. Edit the `ALLOWED_ORIGINS` variable and set it to your Vercel URL (and custom domain if using one):
   ```
   ALLOWED_ORIGINS=https://quanticus-website.vercel.app
   ```
   *(Separate multiple origins with commas: `https://quanticus-website.vercel.app,https://www.quanticus.com`)*
4. Click **Save Changes**. Render will automatically restart the service with the new origin protection settings.

---

## Step 5: Post-Deployment Verification Checklist

Run through these checks on your live Vercel URL (`https://your-site.vercel.app`):

- [ ] **Health Endpoint**: Visit `https://your-site.vercel.app/api/health` — it should return `{"ok":true}`.
- [ ] **Public Homepage**: Open the homepage. Verify images, styles, and typography load seamlessly.
- [ ] **Dynamic Careers Section**: Scroll to the Careers section. Verify roles appear (fetched via `/api/roles`).
- [ ] **Directors Section**: Verify director cards and photos load (fetched via `/api/directors`).
- [ ] **Contact Form ("Let's Connect")**: Submit a test message. Verify the green confirmation message with reference code appears.
- [ ] **Job Application Modal**: Click "Apply Now" on an open role.
  - Upload a valid PDF resume (<4MB). Submit and confirm the reference ID is returned.
  - Test uploading a file >4MB: Verify client-side rejection message.
- [ ] **Admin Portal Login**:
  - Go to `https://your-site.vercel.app/admin`.
  - Log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
  - Verify dashboard displays Contact Requests, Job Applications, Roles, and Directors tabs.
- [ ] **Admin Resume Download**: In the Job Applications tab, click "Download Resume". Confirm the PDF downloads with its original filename.
- [ ] **CSV Exports**: Click "Export CSV" on Contact Requests and Job Applications. Confirm the downloaded CSV file opens cleanly.
- [ ] **Director Photo Management**: In the Directors tab, upload a new photo for a director. Confirm it updates instantly and displays properly on the public homepage.
- [ ] **Logout**: Click "Logout" and confirm session cookie is cleared and login screen displays.

---

## Local Development (Single Command)

To run the whole project locally on your machine:

```bash
# 1. Install dependencies from root
npm install

# 2. Setup/migrate local database
npm run setup

# 3. Start local development server
npm start
```

The site will be available at:
- Public Website: `http://localhost:3000`
- Admin Portal: `http://localhost:3000/admin`
- API Base: `http://localhost:3000/api`
