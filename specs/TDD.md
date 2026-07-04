# VitalLink — Technical Design Document

**Companion to:** PRD.md
**Principle:** Every component below runs on a free tier or is fully open-source/self-hosted. No credit card required to build or demo this project.

---

## 1. Architecture Overview

```
┌─────────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│   Frontend       │  REST  │   Backend API        │  SQL   │   Database         │
│   Next.js        │◄──────►│   FastAPI (Python)   │◄──────►│   Supabase         │
│   (Vercel free)  │        │   (Render free tier)  │        │   (Postgres+PostGIS)│
└────────┬─────────┘        └──────────┬───────────┘        └─────────┬──────────┘
         │                             │                              │
         │                     ┌───────▼────────┐             ┌───────▼────────┐
         │                     │ Matching Engine │             │ Realtime channel│
         │                     │ (ABO/Rh + geo)  │             │ (Supabase RT,   │
         │                     └───────┬────────┘             │  free tier)     │
         │                             │                       └────────────────┘
         │                     ┌───────▼────────┐
         │                     │ Notification    │
         │                     │ Service         │
         │                     │ (Resend free    │
         │                     │  tier - email)  │
         │                     └────────────────┘
         │
┌────────▼─────────┐
│  Map rendering    │
│  Leaflet.js +     │
│  OpenStreetMap    │
│  (no API key)     │
└──────────────────┘
```

## 2. Repository Structure

```
vitallink/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI entrypoint
│   │   ├── models/                # SQLAlchemy models (donor, request, match)
│   │   ├── matching_engine/       # compatibility rules + geo radius query
│   │   ├── notifications/         # email dispatch via Resend API
│   │   ├── api/                   # route handlers (donors, requests, matches)
│   │   └── core/                  # config, db session, settings
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── app/                       # Next.js app router pages
│   ├── components/                # DonorForm, RequestForm, MapView, StatCards
│   ├── lib/                       # API client, geolocation helpers
│   └── package.json
├── demo_dashboard.html            # standalone static demo (no backend needed)
├── PRD.md
├── TDD.md
└── seed_data.py                   # synthetic donors/requests for demo
```

Clean module separation matters here — since this repo has no README, an AI documentation tool infers structure and purpose directly from folder names and code, so `matching_engine/`, `notifications/`, and `api/` should stay strictly single-purpose.

## 3. Free Tech Stack (exact choices + rationale)

| Layer | Choice | Why it's free & sufficient |
|---|---|---|
| Frontend framework | **Next.js** | Free open-source framework |
| Frontend hosting | **Vercel Hobby tier** | Free hosting, auto-deploy from GitHub |
| Backend framework | **FastAPI (Python)** | Free, async, auto-generates OpenAPI docs |
| Backend hosting | **Render free web service** (or Railway free tier) | Free tier sufficient for demo traffic |
| Database | **Supabase free tier (Postgres + PostGIS)** | 500MB free DB, built-in geospatial queries via PostGIS, free Auth, free Realtime channel |
| Maps | **Leaflet.js + OpenStreetMap tiles** | Fully free, no API key, no usage cap (unlike Google Maps which needs billing) |
| Geocoding | **Nominatim (OSM)** | Free reverse/forward geocoding for address → lat/lng |
| Email notifications | **Resend free tier** (or SendGrid free 100/day) | No paid SMS needed — email covers the notification requirement at zero cost |
| Realtime updates | **Supabase Realtime** | Free tier websocket channel, pushes match/status updates to dashboard live |
| Auth | **Supabase Auth** | Free email/password + magic link auth for hospitals and donors |
| Version control / CI | **GitHub + GitHub Actions free minutes** | Free for public repos |
| Presentation generation | **PresentMeApp** | Per hackathon rules |

**Note on SMS:** Twilio/SendGrid SMS is not free beyond trial credits, so VitalLink's MVP uses email + in-app/browser push as the notification channel. This is documented explicitly as a deliberate free-tier tradeoff, with SMS listed as a paid-tier roadmap item.

## 4. Data Model

```sql
-- donors
donor_id UUID PK
name TEXT
blood_type TEXT CHECK (blood_type IN ('O-','O+','A-','A+','B-','B+','AB-','AB+'))
location GEOGRAPHY(POINT, 4326)   -- PostGIS point
available BOOLEAN DEFAULT true
last_donation_date DATE
email TEXT
created_at TIMESTAMP

-- hospitals
hospital_id UUID PK
name TEXT
location GEOGRAPHY(POINT, 4326)
verified BOOLEAN DEFAULT false

-- requests
request_id UUID PK
hospital_id UUID FK
blood_type TEXT
units_needed INT
urgency TEXT CHECK (urgency IN ('critical','high','routine'))
status TEXT CHECK (status IN ('open','donors_notified','partially_fulfilled','fulfilled','closed'))
created_at TIMESTAMP

-- matches
match_id UUID PK
request_id UUID FK
donor_id UUID FK
notified_at TIMESTAMP
response TEXT CHECK (response IN ('pending','accepted','declined'))
```

## 5. Matching Engine Logic

1. On request creation, look up the **compatible donor blood types** for the requested type using standard donor-recipient compatibility (e.g., request for `O-` matches only `O-` donors; request for `AB+` can match all types since AB+ is the universal recipient).
2. Run a **PostGIS radius query** (`ST_DWithin`) filtering `available = true` donors within N km (default 15km, configurable per urgency — critical requests widen the radius automatically).
3. Rank matches by distance ascending, capped to top 50 for notification batching.
4. Insert rows into `matches` table with `response = 'pending'`, trigger notification job.
5. As donors respond, update `response`; when `units_needed` is satisfied by accepted donors, auto-transition `request.status` to `fulfilled`.

Pseudocode:
```python
def find_matches(request):
    compatible_types = COMPATIBILITY_MAP[request.blood_type]
    radius_km = URGENCY_RADIUS[request.urgency]  # critical=30, high=15, routine=8
    donors = db.query(Donor).filter(
        Donor.blood_type.in_(compatible_types),
        Donor.available == True,
        ST_DWithin(Donor.location, request.hospital.location, radius_km * 1000)
    ).order_by(ST_Distance(Donor.location, request.hospital.location)).limit(50)
    return donors
```

## 6. Notification Flow

1. Matching engine produces a donor list → notification service queues one email per donor via Resend's free-tier API.
2. Email includes: hospital name, blood type/urgency, distance, and a signed one-click "I can help" link.
3. Click updates `matches.response = 'accepted'` and pushes a Supabase Realtime event to the hospital dashboard.
4. If Resend's free daily quota is hit, fallback: mark as `queued` and retry on a backoff schedule (documented tradeoff for demo purposes — pre-seeded data avoids hitting this in the live demo).

## 7. API Endpoints (summary)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/donors` | Register donor |
| PATCH | `/donors/{id}/availability` | Toggle availability |
| POST | `/requests` | Hospital posts shortage request |
| GET | `/requests/active` | Public feed of open requests (for dashboard) |
| GET | `/requests/{id}/matches` | Hospital view of matched donors + statuses |
| PATCH | `/matches/{id}/respond` | Donor accepts/declines |
| GET | `/stats/supply` | Aggregate supply levels per blood type (for dashboard cards) |

## 8. Security & Privacy

- Row-level security (Supabase RLS) ensures donors can only see their own record; hospitals only see matches tied to their own requests.
- Public dashboard endpoints (`/requests/active`, `/stats/supply`) return only aggregated/approximate data — no donor PII, and location is jittered to a ~1km grid cell for public display.
- All secrets (DB URL, Resend API key) stored as environment variables, never committed to the repo.

## 9. Demo Strategy

Because live donor/hospital accounts are unrealistic to gather during a hackathon, `seed_data.py` generates synthetic donors and requests across a sample city, and `demo_dashboard.html` renders a self-contained static/simulated version of the live dashboard (map, supply cards, alert feed) so judges can see the intended end-state UI without needing the full backend running.

## 10. Deployment Steps (all free)

1. Push repo to GitHub (public, per hackathon rules).
2. Create Supabase project → enable PostGIS extension → run schema migration.
3. Deploy `backend/` to Render as a free web service, set env vars (Supabase connection string, Resend API key).
4. Deploy `frontend/` to Vercel, set `NEXT_PUBLIC_API_URL` to the Render backend URL.
5. Run `seed_data.py` once against the deployed DB to populate demo data.
6. Generate presentation via PresentMeApp from the public GitHub repo.

## 11. Roadmap Beyond Hackathon

- SMS notifications (paid tier) for donors without reliable email access.
- Organ donation logistics module (transport windows, cold-chain constraints).
- Hospital verification workflow (currently a simple boolean flag for MVP).
- Donor gamification / impact certificates.
