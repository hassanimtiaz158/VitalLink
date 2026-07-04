# VitalLink — Deployment Guide

Step-by-step deployment commands matching TDD §10. All services use free tiers.

---

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial VitalLink scaffold"
git remote add origin https://github.com/YOUR_USER/vitallink.git
git push -u origin main
```

---

## 2. Supabase Project + PostGIS

### Create project

1. Go to https://supabase.com/dashboard → **New project**
2. Project name: `vitallink`
3. Database password: (save this — you'll need it below)
4. Region: pick closest to your users
5. Wait for project to initialise (~2 minutes)

### Enable PostGIS

Run in the **SQL Editor** (Supabase dashboard → SQL Editor → New query):

```sql
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
```

### Run schema migration

Copy the contents of `backend/migrations/001_initial_schema.sql` and paste into the SQL Editor, then click **Run**.

Or via psql:

```bash
# Get the connection string from: Settings → Database → Connection string → URI (transaction mode)
psql "postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres" \
  -f backend/migrations/001_initial_schema.sql
```

### Enable Realtime on the matches table

Supabase dashboard → **Database** → **Replication** → toggle ON for:
- `public.matches`
- `public.requests`

### Get credentials

From **Settings → API**:
- `SUPABASE_URL` → `https://your-project.supabase.co`
- `SUPABASE_ANON_KEY` → `eyJhbGci...`

From **Settings → Database → Connection string → URI (transaction mode)**:
- `DATABASE_URL` → the full URI with password

---

## 3. Deploy Backend to Render

### Create Web Service

1. Go to https://render.com → **New +** → **Web Service**
2. Connect your GitHub repo
3. Settings:

| Field | Value |
|---|---|
| Name | `vitallink-api` |
| Root Directory | `backend` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | `Free` |

### Set Environment Variables

In the Render dashboard → **Environment** tab, add:

```
DATABASE_URL          = postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
RESEND_API_KEY        = re_xxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL     = noreply@yourdomain.com
BASE_URL              = https://vitallink-api.onrender.com
RESPONSE_TOKEN_SECRET = <run: python -c "import secrets; print(secrets.token_urlsafe(48))">
RESPONSE_TOKEN_EXPIRY_DAYS = 7
```

### Note the deployed URL

After first deploy, Render gives you a URL like:
```
https://vitallink-api.onrender.com
```

Verify it works:
```bash
curl https://vitallink-api.onrender.com/health
# → {"status":"ok"}
```

---

## 4. Deploy Frontend to Vercel

### Create Project

1. Go to https://vercel.com → **Add New...** → **Project**
2. Import the same GitHub repo
3. Framework: `Next.js` (auto-detected)
4. Root Directory: `frontend`
5. Build & Output Settings: leave defaults

### Set Environment Variables

In the Vercel dashboard → **Settings → Environment Variables**, add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://vitallink-api.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` |

Click **Deploy**.

### Note the deployed URL

Vercel gives you a URL like:
```
https://vitallink.vercel.app
```

---

## 5. Seed Demo Data

Run the seed script once against the live database:

```bash
# Set the database URL to the Supabase connection string
export DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"

cd backend
pip install -r requirements.txt
python seed_data.py --clear
```

The script prints the inserted hospital UUIDs. Copy one and set it in Vercel:

```
NEXT_PUBLIC_DEMO_HOSPITAL_ID = <paste-hospital-uuid-here>
```

Then redeploy the Vercel project (or trigger a redeploy from the dashboard).

---

## 6. Verify End-to-End

```bash
# 1. Check backend health
curl https://vitallink-api.onrender.com/health

# 2. Check active requests (should return seeded data)
curl https://vitallink-api.onrender.com/requests/active | python -m json.tool

# 3. Check supply stats
curl https://vitallink-api.onrender.com/requests/stats/supply | python -m json.tool

# 4. Open the live dashboard in browser
open https://vitallink.vercel.app/live

# 5. Open the hospital dashboard
open https://vitallink.vercel.app/dashboard
```

---

## 7. Generate Presentation

Per hackathon rules, generate slides via PresentMeApp from the public GitHub repo URL.

---

## Quick Reference — All Environment Variables

### Backend (Render)

| Variable | Source |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → URI |
| `RESEND_API_KEY` | https://resend.com/api-keys |
| `RESEND_FROM_EMAIL` | Your verified domain or default |
| `BASE_URL` | Your Render service URL |
| `RESPONSE_TOKEN_SECRET` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `RESPONSE_TOKEN_EXPIRY_DAYS` | `7` |

### Frontend (Vercel)

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your Render service URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key |
| `NEXT_PUBLIC_DEMO_HOSPITAL_ID` | Output of `seed_data.py` |
