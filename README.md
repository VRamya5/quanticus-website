# Quanticus Software Solutions - Website & Administration System

A full-stack enterprise web application and management system built with **Node.js**, **Express**, and **PostgreSQL**.

---

## Project Structure

The project is organized into two primary clean directories for modularity and seamless cloud deployment:

```
quanticus-website/
├── frontend/                     # Static frontend deployed to Vercel
│   ├── admin/                    # Admin portal SPA (/admin)
│   ├── assets/                   # Logos, brand badges, favicons
│   ├── css/                      # Main & design-system CSS
│   ├── js/                       # Client application JavaScript
│   ├── index.html                # Public homepage
│   ├── favicon.ico               # Site favicon
│   └── vercel.json               # Vercel configuration & /api/* proxy rewrite
│
├── backend/                      # Backend API service deployed to Render
│   ├── src/
│   │   ├── db/                   # PostgreSQL connection pool & setup migrations
│   │   ├── middleware/           # Auth, rate limiting, and in-memory uploads
│   │   ├── routes/               # Public (/api/*) & Admin (/api/admin/*) routes
│   │   └── utils/                # Reference codes & sanitization validators
│   ├── scripts/                  # Automated test & verification suites
│   ├── server.js                 # Express server & proxy configuration
│   └── package.json              # Backend service dependencies & scripts
│
├── DEPLOY.md                     # Step-by-step production deployment guide
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git ignore file for secrets and dependencies
└── package.json                  # Root npm runner for seamless local development
```

---

## Key Features & Architecture

1. **Public Website (`http://localhost:3000` / Vercel)**
   - **Dynamic Careers Section**: Careers cards are loaded live from PostgreSQL via `GET /api/roles`.
   - **Job Application Modal**: Interactive form with candidate details and multi-format resume upload (PDF, DOC, DOCX up to 4MB). Resumes are stored directly in PostgreSQL (`BYTEA`), requiring zero persistent disk storage.
   - **Directors Section**: High-resolution director cards with dynamic photo loading (`/api/directors/:id/photo`).
   - **Let's Connect Contact Form**: Real-time inquiry submission directly saved to the database.
   - **Free-Plan Friendly**: Built-in cold start wake-up notifications and automatic retry resilience for Render sleep intervals.

2. **Administration System (`http://localhost:3000/admin`)**
   - **Secure Authentication**: Express session-based login with PostgreSQL session store (`connect-pg-simple`), bcrypt password hashing, HTTP-only lax cookies, and login rate limiting.
   - **Admin API Namespace**: All administrative endpoints reside under `/api/admin/*`.
   - **Client Requests Tab**: Full table of contact inquiries with search, status filters (`NEW`, `READ`, `HANDLED`), inline status changer, and formula-injection-safe CSV export.
   - **Job Applications Tab**: Complete candidate management with search, role filters, status management (`NEW`, `REVIEWED`, `SHORTLISTED`, `REJECTED`), secure resume streaming directly from database BYTEA, and CSV export.
   - **Directors Tab**: Reorderable executive team management with in-memory Sharp image processing (800x800 WebP) and database BYTEA storage.
   - **Roles Management Tab**: Create new job openings, edit descriptions, toggle Open/Closed status, and view applicant counts in real time.

---

## Local Development (Single Command)

### 1. Configure Environment Variables
Ensure your `.env` file exists in the root directory (refer to `.env.example`):
```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=quanticus
DB_USER=postgres
DB_PASSWORD=your_postgres_password

ADMIN_EMAIL=admin@quanticustech.com
ADMIN_PASSWORD=your_secure_admin_password
SESSION_SECRET=your_random_session_secret_here
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize Database Schema & Seed Data
Run the safe, idempotent database setup script:
```bash
npm run setup
```

### 4. Start the Application
```bash
npm start
```
The server will start on [http://localhost:3000](http://localhost:3000).

---

## Deployment to Production

For complete step-by-step instructions on deploying the frontend to **Vercel** and backend + PostgreSQL to **Render**, please see [DEPLOY.md](file:///d:/Quanticus-website/DEPLOY.md).

---

## Automated Verification Tests

To run the automated verification test suite locally:
```bash
node backend/scripts/test_suite.js
```
