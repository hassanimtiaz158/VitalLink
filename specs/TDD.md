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
│   │   ├── models/                # SQLAlchemy models (donor, requester, request, match, message, block)
│   │   ├── matching_engine/       # compatibility rules + geo radius query
│   │   ├── notifications/         # email dispatch via Resend API
│   │   ├── api/                   # route handlers (donors, requesters, requests, matches)
│   │   └── core/                  # config, db session, settings
│   ├── migrations/                # SQL migration files
│   ├── seed_data.py               # synthetic donors/requesters/requests for demo
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── app/                       # Next.js app router pages
│   │   ├── page.tsx               # Landing page
│   │   ├── live/page.tsx          # Public live dashboard
│   │   ├── request/               # Requester flow (register + create request)
│   │   ├── (donor)/               # Donor flow (register + dashboard)
│   │   └── layout.tsx             # Root layout
│   ├── components/                # DonorForm, RequestDashboard, LiveMap, etc.
│   ├── lib/                       # API client, geolocation helpers, Supabase subscriptions
│   └── package.json
├── specs/
│   ├── PRD.md                     # Product requirements
│   ├── TDD.md                     # This document
│   └── demo_dashboard.html        # standalone static demo (no backend needed)
└── DEPLOY.md                      # Deployment guide
```

## 3. Free Tech Stack (exact choices + rationale)

| Layer | Choice | Why it's free & sufficient |
|---|---|---|
| Frontend framework | **Next.js** | Free open-source framework |
| Frontend hosting | **Vercel Hobby tier** | Free hosting, auto-deploy from GitHub |
| Backend framework | **FastAPI (Python)** | Free, async, auto-generates OpenAPI docs |
| Backend hosting | **Render free web service** (or Railway free tier) | Free tier sufficient for demo traffic |
| Database | **Supabase free tier (Postgres + PostGIS)** | 500MB free DB, built-in geospatial queries via PostGIS, free Realtime channel |
| Maps | **Leaflet.js + OpenStreetMap tiles** | Fully free, no API key, no usage cap |
| Geocoding | **Nominatim (OSM)** | Free reverse/forward geocoding for address → lat/lng |
| Email notifications | **Resend free tier** | No paid SMS needed — email covers the notification requirement at zero cost |
| Realtime updates | **Supabase Realtime** | Free tier websocket channel, pushes match/status updates to dashboard live |
| Version control / CI | **GitHub + GitHub Actions free minutes** | Free for public repos |
| Presentation generation | **PresentMeApp** | Per hackathon rules |

**Note on SMS:** Twilio/SendGrid SMS is not free beyond trial credits, so VitalLink's MVP uses email + in-app chat as the notification channel. SMS is listed as a paid-tier roadmap item.

## 4. Data Model

```sql
-- donors
donor_id UUID PK
name TEXT
blood_type TEXT CHECK (blood_type IN ('O-','O+','A-','A+','B-','B+','AB-','AB+'))
location GEOGRAPHY(POINT, 4326)
available BOOLEAN DEFAULT true
last_donation_date DATE
email TEXT
phone TEXT
created_at TIMESTAMP

-- requesters (individuals who need blood)
requester_id UUID PK
name TEXT
email TEXT
phone TEXT
location GEOGRAPHY(POINT, 4326)
created_at TIMESTAMP

-- requests (owned by requester, not a hospital)
request_id UUID PK
requester_id UUID FK → requesters
blood_type TEXT
units_needed INT
urgency TEXT CHECK (urgency IN ('critical','high','routine'))
status TEXT CHECK (status IN ('open','donor_accepted','donor_confirmed','contact_shared','fulfilled','closed'))
created_at TIMESTAMP

-- matches (requester-driven, not auto-notify)
match_id UUID PK
request_id UUID FK → requests
donor_id UUID FK → donors
response TEXT CHECK (response IN ('pending','accepted_by_requester','donor_confirmed','contact_shared','declined'))
notified_at TIMESTAMP
accepted_at TIMESTAMP
confirmed_at TIMESTAMP
contact_shared_at TIMESTAMP
created_at TIMESTAMP

-- messages (in-app chat)
message_id UUID PK
match_id UUID FK → matches
sender_type TEXT CHECK (sender_type IN ('requester','donor'))
sender_id UUID
body TEXT
created_at TIMESTAMP

-- blocks (abuse prevention)
block_id UUID PK
donor_id UUID FK → donors
requester_id UUID FK → requesters
reason TEXT
created_at TIMESTAMP
UNIQUE (donor_id, requester_id)
```

## 5. Matching Engine Logic

The matching engine is **requester-driven** — it computes a ranked candidate list but does NOT auto-notify donors.

1. Resolve the requester's location from `requesters` table via `request.requester_id`.
2. Look up **compatible donor blood types** using standard ABO/Rh donor-recipient compatibility.
3. Run a **PostGIS radius query** (`ST_DWithin`) filtering `available = true` donors within N km (critical=30km, high=15km, routine=8km).
4. Exclude donors who have blocked this requester.
5. Rank by distance ascending, capped to top 50.
6. Return `list[tuple[Donor, distance_km]]` — no contact info exposed.

Pseudocode:
```python
def find_candidate_donors(request, db):
    requester = db.query(Requester).get(request.requester_id)
    compatible_types = COMPATIBILITY_MAP[request.blood_type]
    radius_km = URGENCY_RADIUS[request.urgency]

    # Find donors who have NOT blocked this requester
    blocked_ids = db.query(Block.donor_id).filter(
        Block.requester_id == request.requester_id
    ).subquery()

    donors = db.query(Donor, ST_Distance(Donor.location, requester.location).label("dist")).filter(
        Donor.blood_type.in_(compatible_types),
        Donor.available == True,
        Donor.donor_id.notin_(blocked_ids),
        ST_DWithin(Donor.location, requester.location, radius_km * 1000)
    ).order_by("dist").limit(50).all()

    return [(donor, dist_m / 1000) for donor, dist_m in donors]
```

## 6. Notification Flow

1. **Requester accepts donor:** `POST /requests/{id}/accept-donor/{donor_id}` creates a match row with `response = 'accepted_by_requester'` and sends an email to that specific donor.
2. **Email content:** Requester name, blood type/urgency, distance, and a signed one-click response URL (`/api/matches/{id}/respond?response=accepted`).
3. **Donor confirms:** Click updates `matches.response = 'donor_confirmed'` and pushes a Supabase Realtime event to the requester's dashboard.
4. **Contact shared:** When enough donors confirm (≥ `units_needed`), request status transitions to `contact_shared` and contact info is revealed to both parties.
5. **In-app chat:** After contact sharing, both parties can send messages via `POST /matches/{id}/messages`.
6. **Fallback:** If Resend's free daily quota is hit, emails are queued and retried on a backoff schedule.

## 7. API Endpoints (summary)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/donors` | Register donor |
| GET | `/donors` | List all donors (for live map) |
| GET | `/donors/{id}` | Get donor profile |
| PATCH | `/donors/{id}/availability` | Toggle availability |
| GET | `/donors/{id}/matches` | Donor's pending + history |
| POST | `/donors/{id}/block` | Block a requester |
| POST | `/requesters` | Register requester |
| GET | `/requesters/{id}` | Get requester profile |
| POST | `/requests` | Create blood request |
| GET | `/requests/{id}/candidate-donors` | Ranked candidate list (no contact info) |
| POST | `/requests/{id}/accept-donor/{donor_id}` | Requester accepts a donor |
| PATCH | `/requests/{id}/status` | Update request status |
| GET | `/requests/active` | Public feed of open requests |
| GET | `/requests/{id}/matches` | Request detail with matches (contact info gated) |
| GET | `/requests/stats/supply` | Aggregate supply levels |
| PATCH | `/matches/{id}/respond` | Donor confirms/declines |
| GET | `/matches/{id}/messages` | Get chat messages |
| POST | `/matches/{id}/messages` | Send chat message |
| POST | `/matches/{id}/report` | Report/block a requester |

## 8. Security & Privacy

- **Contact info gating:** Donor email/phone is only returned in API responses when `match.response == 'contact_shared'`. Same for requester email/phone.
- **Row-level security (Supabase RLS):** Donors can only see their own record and their own matches. Requesters can only see their own requests and matches.
- **Block system:** Donors can block requesters. Blocked requesters' future requests are excluded from that donor's candidate list.
- **Public dashboard endpoints** (`/requests/active`, `/stats/supply`) return only aggregated/approximate data — no PII, location jittered to ~1km grid.
- **In-app chat** is scoped to individual matches — messages are only visible to the two parties in that match.
- All secrets (DB URL, Resend API key, JWT secret) stored as environment variables, never committed.

## 9. Demo Strategy

`seed_data.py` generates synthetic donors, requesters, and requests across Lahore, Pakistan:
- 100 donors with Pakistani names, random blood types, scattered across the city
- 5 requesters with realistic names
- 10 requests at various lifecycle stages (open, donor_accepted, donor_confirmed, contact_shared)
- Pre-seeded matches at different response states for the live demo

`demo_dashboard.html` renders a self-contained static/simulated version of the live dashboard (map, supply cards, alert feed, candidate donor list) so judges can see the intended end-state UI without needing the full backend running.

## 10. Deployment Steps (all free)

1. Push repo to GitHub (public, per hackathon rules).
2. Create Supabase project → enable PostGIS extension → run migrations 001–005.
3. Deploy `backend/` to Render as a free web service, set env vars (Supabase connection string, Resend API key, JWT secret).
4. Deploy `frontend/` to Vercel, set `NEXT_PUBLIC_API_URL` to the Render backend URL.
5. Run `seed_data.py` once against the deployed DB to populate demo data.
6. Generate presentation via PresentMeApp from the public GitHub repo.

## 11. Roadmap Beyond Hackathon

- SMS notifications (paid tier) for donors without reliable email access.
- Organ donation logistics module (transport windows, cold-chain constraints).
- Full identity verification / medical record integration.
- Donor gamification / impact certificates.
- Rate limiting on accept actions per requester per hour.
- Admin dashboard for system-wide analytics.
