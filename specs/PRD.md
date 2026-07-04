# VitalLink — Product Requirements Document

**Tagline:** Real-time blood & organ donor matching for the moments when minutes matter.
**Theme alignment:** UN SDG 3 — Good Health and Well-being (targets 3.4, 3.8: reduce preventable deaths, universal access to health services)
**Version:** 1.0
**Status:** Hackathon MVP

---

## 1. Problem Statement

Blood and organ shortages kill people not because donors don't exist, but because **supply and demand are invisible to each other in real time**. A hospital running critically low on O-negative blood has no fast way to broadcast that need to nearby eligible donors. A donor willing to give blood today has no way to know their type is urgently needed 2 km away. This coordination gap — not a lack of donors — is a leading cause of preventable shortage deaths, especially in emergencies, rural areas, and low-resource health systems.

## 2. Vision

VitalLink is a lightweight, geolocation-aware platform that connects blood/organ donors directly to real-time hospital demand. When a hospital logs a shortage, eligible nearby donors are notified within seconds. When a donor registers availability, they become instantly discoverable to every hospital that needs them.

## 3. Target Users

| User type | Need |
|---|---|
| **Hospital / blood bank staff** | Post urgent shortages, see matched donor pool, track fulfillment status |
| **Donors** | Register blood type + location, receive alerts, confirm availability, see impact |
| **Admins (hackathon demo / NGO ops)** | Monitor system-wide supply levels and alert history |

## 4. Goals & Success Metrics

| Goal | Metric (demo-scope) |
|---|---|
| Reduce time-to-match for urgent requests | Match generated in < 3 seconds of request submission |
| Maximize donor reachability | 100% of eligible donors within radius are notified |
| Demonstrate real-world viability | Live demo shows request → match → notification → status update end-to-end |
| Clear SDG 3 impact narrative | Judges can trace exactly which SDG 3 targets are addressed and how |

## 5. Core Features (MVP Scope)

### 5.1 Donor Registration
- Sign up with name, blood type, location (browser geolocation or manual address), availability toggle.
- Donor dashboard shows donation history and "lives potentially impacted" counter.

### 5.2 Hospital Request Posting
- Hospital account posts a request: blood type needed, units required, urgency level (Critical / High / Routine), location.
- Request appears instantly on the live map and donor-facing feed.

### 5.3 Matching Engine
- On request creation, system queries donors by: matching/compatible blood type → within configurable radius → marked available.
- Returns ranked list (closest + most compatible first).
- Compatibility uses standard ABO/Rh donor-recipient compatibility rules (e.g., O- is universal donor).

### 5.4 Notification System
- Matched donors receive an email alert (free-tier email API) with request details and a one-tap "I can help" response link.
- Hospital dashboard updates live as donors respond.

### 5.5 Live Public Dashboard
- Map view of active requests (color-coded by urgency).
- Supply-level cards per blood type.
- Live activity/alert feed.
- This is what `demo_dashboard.html` demonstrates in static/simulated form for the pitch.

### 5.6 Status Tracking
- Request lifecycle: `Open → Donors Notified → Partially Fulfilled → Fulfilled → Closed`.
- Hospital can mark units received; system updates supply metrics.

## 6. Out of Scope (for hackathon MVP)

- Real SMS delivery (free tier email/push only — see TDD for rationale).
- Full identity verification / medical record integration.
- Organ matching logistics (cold-chain, transport) — MVP focuses on blood; architecture is extensible to organs as a stretch goal.
- Payment or incentive systems.
- Native mobile app (responsive web only).

## 7. User Stories

1. **As a hospital coordinator**, I want to post an urgent O-negative shortage so nearby compatible donors are alerted immediately.
2. **As a donor**, I want to register once and be notified only when I'm truly needed, so I don't get alert fatigue.
3. **As a donor**, I want to see the real-world impact of my donations so I stay motivated to give again.
4. **As an NGO/admin**, I want a live dashboard of regional supply levels so I can plan blood drives proactively.
5. **As a judge/user evaluating the demo**, I want to see the full request → match → notify → fulfill loop without needing real donors or hospitals.

## 8. Functional Requirements

| ID | Requirement |
|---|---|
| FR1 | System shall store donor profiles with blood type, geolocation, and availability status |
| FR2 | System shall allow hospitals to submit a shortage request with type, units, urgency, and location |
| FR3 | System shall compute compatible donor matches using ABO/Rh rules within a configurable radius |
| FR4 | System shall send an email notification to matched donors within seconds of request creation |
| FR5 | System shall expose a public live dashboard (map + stats + feed) with no login required |
| FR6 | System shall update request status as donors respond and hospitals confirm fulfillment |
| FR7 | System shall log all requests/matches for the admin analytics view |

## 9. Non-Functional Requirements

- **Cost:** Must run entirely on free tiers (see TDD §3 for the exact stack).
- **Performance:** Matching query must return in under 1 second for demo-scale data (< 10k donors).
- **Privacy:** Donor exact address is never shown publicly — only approximate location (map jitter / area-level) is displayed on the public dashboard.
- **Accessibility:** Dashboard must be usable at mobile widths (donors will often check alerts on a phone).
- **Reliability:** Core request → match flow must work even if the email provider is rate-limited (fallback: in-app notification queue).

## 10. Data Privacy & Ethics Notes

- Donor PII (exact address, contact info) is never exposed on the public dashboard — only aggregate/approximate data.
- Blood type and health-adjacent data are sensitive; access to donor identity is restricted to matched hospitals only, not other donors.
- This is a hackathon demo, not a certified medical system — no real patient data should ever be used in testing.

## 11. Milestones (Hackathon Timeline)

| Phase | Deliverable |
|---|---|
| Day 1 | Repo scaffolding, data models, donor + hospital registration flows |
| Day 2 | Matching engine + notification integration |
| Day 3 | Live dashboard (map, cards, feed) + status tracking |
| Day 4 | Polish, seed demo data, record walkthrough, generate presentation via PresentMeApp, submit |

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Free-tier email API rate limits during live demo | Pre-seed demo data; use queued fallback notifications |
| No real donor data for a convincing demo | Ship a realistic seed script generating synthetic donors/requests across a city |
| Geolocation permission denied by browser | Manual address/zip entry fallback |
| Scope creep into organ logistics | Explicitly fenced to blood-only for MVP; documented as roadmap item |
