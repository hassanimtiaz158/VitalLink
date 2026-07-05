# VitalLink — Product Requirements Document

**Tagline:** Real-time blood donor matching for the moments when minutes matter.
**Theme alignment:** UN SDG 3 — Good Health and Well-being (targets 3.4, 3.8: reduce preventable deaths, universal access to health services)
**Version:** 2.0
**Status:** Hackathon MVP

---

## 1. Problem Statement

Blood shortages kill people not because donors don't exist, but because **supply and demand are invisible to each other in real time**. An individual needing blood has no fast way to broadcast that need to nearby eligible donors. A donor willing to give blood today has no way to know their type is urgently needed 2 km away. This coordination gap — not a lack of donors — is a leading cause of preventable shortage deaths, especially in emergencies, rural areas, and low-resource health systems.

## 2. Vision

VitalLink is a lightweight, geolocation-aware platform that connects blood donors directly to individuals who need blood. When someone creates a request, compatible nearby donors are identified and the requester chooses whom to notify. When a donor registers availability, they become instantly discoverable. Mutual confirmation before contact exchange ensures privacy and safety.

## 3. Target Users

| User type | Need |
|---|---|
| **Requesters** | Individuals who need blood for themselves or a loved one; post requests, review candidates, accept donors, chat to coordinate |
| **Donors** | Register blood type + location, receive alerts when accepted, confirm availability, see impact |
| **Admins (hackathon demo / NGO ops)** | Monitor system-wide supply levels and alert history |

## 4. Goals & Success Metrics

| Goal | Metric (demo-scope) |
|---|---|
| Reduce time-to-match for urgent requests | Candidate list generated in < 3 seconds of request submission |
| Maximize donor reachability | 100% of compatible donors within radius are returned as candidates |
| Demonstrate real-world viability | Live demo shows request → select → notify → confirm → chat end-to-end |
| Clear SDG 3 impact narrative | Judges can trace exactly which SDG 3 targets are addressed and how |

## 5. Core Features (MVP Scope)

### 5.1 Donor Registration
- Sign up with name, blood type, email, phone (optional), location (browser geolocation or manual address), availability toggle.
- Donor dashboard shows donation history and "lives potentially impacted" counter.

### 5.2 Requester Registration & Request Creation
- Requester registers with name, email, phone (optional), and location.
- Creates a blood request: blood type needed, units required, urgency level (Critical / High / Routine).
- Request appears instantly on the live map and public feed.

### 5.3 Requester-Driven Matching
- On request creation, system computes a ranked list of compatible, available donors sorted by distance.
- Requester reviews the list (name, blood type, distance, last donation date — no contact info yet).
- Requester selects which donors to accept (supports multiple for multi-unit requests).
- No auto-notification — the requester decides whom to engage.

### 5.4 Accept & Confirm Flow
- When requester accepts a donor, the donor receives an email with request details and a one-click "I'm in" / "Can't help" response link.
- Donor confirms or declines. Status updates push to requester's dashboard in real time via Supabase Realtime.
- Request lifecycle: `open → donor_accepted → donor_confirmed → contact_shared → fulfilled → closed`.

### 5.5 Contact Sharing & In-App Chat
- Contact info (email/phone) is only revealed after **mutual confirmation** — requester accepts AND donor confirms.
- In-app chat (messages table) is the primary negotiation path, scoped to each match.
- Real contact info is optional — chat is preferred for health-context privacy.

### 5.6 Abuse Prevention
- Donors can block/report requesters. Blocked requesters' future requests are hidden from that donor's candidate list.
- Rate limiting on accept actions per requester per hour (planned).

### 5.7 Live Public Dashboard
- Map view of active requests (color-coded by urgency).
- Supply-level cards per blood type.
- Live activity/alert feed.
- This is what `demo_dashboard.html` demonstrates in static/simulated form for the pitch.

## 6. Out of Scope (for hackathon MVP)

- Real SMS delivery (free tier email/push only — see TDD for rationale).
- Full identity verification / medical record integration.
- Organ matching logistics (cold-chain, transport) — MVP focuses on blood; architecture is extensible to organs as a stretch goal.
- Payment or incentive systems.
- Native mobile app (responsive web only).

## 7. User Stories

1. **As a requester**, I want to post an urgent O-negative request so I can see which donors are nearby and choose whom to contact.
2. **As a requester**, I want to accept multiple donors for a multi-unit request so I can coordinate several donations.
3. **As a donor**, I want to register once and be notified only when a requester specifically chooses me, so I don't get alert fatigue.
4. **As a donor**, I want to confirm or decline with one click so I can respond quickly.
5. **As a donor**, I want to chat with the requester in-app before sharing personal contact info, for privacy.
6. **As a donor**, I want to block a requester if they are abusive, so I never see their requests again.
7. **As a requester**, I want to see donor confirmations in real time so I know who is actually coming.
8. **As an NGO/admin**, I want a live dashboard of regional supply levels so I can plan blood drives proactively.
9. **As a judge/evaluator**, I want to see the full request → select → confirm → chat loop without needing real donors.

## 8. Functional Requirements

| ID | Requirement |
|---|---|
| FR1 | System shall store donor profiles with blood type, geolocation, and availability status |
| FR2 | System shall allow requesters to register and submit blood requests with type, units, urgency, and location |
| FR3 | System shall compute compatible donor candidates using ABO/Rh rules within a configurable radius |
| FR4 | System shall return a ranked candidate list to the requester without exposing contact info |
| FR5 | System shall allow requesters to accept specific donors, triggering a per-donor email notification |
| FR6 | System shall allow donors to confirm or decline via one-click email link |
| FR7 | System shall reveal contact info only after mutual confirmation (requester accepted + donor confirmed) |
| FR8 | System shall provide in-app chat scoped to each confirmed match |
| FR9 | System shall expose a public live dashboard (map + stats + feed) with no login required |
| FR10 | System shall update request status in real time via Supabase Realtime |
| FR11 | System shall allow donors to block/report requesters for abuse prevention |

## 9. Non-Functional Requirements

- **Cost:** Must run entirely on free tiers (see TDD §3 for the exact stack).
- **Performance:** Matching query must return in under 1 second for demo-scale data (< 10k donors).
- **Privacy:** Donor and requester contact info is never shown publicly — only aggregate/approximate data on the public dashboard.
- **Privacy:** Contact info is only revealed after mutual confirmation — never before.
- **Accessibility:** Dashboard must be usable at mobile widths (donors will often check alerts on a phone).
- **Reliability:** Core request → match flow must work even if the email provider is rate-limited (fallback: in-app notification queue).

## 10. Data Privacy & Ethics Notes

- Donor and requester PII (exact address, contact info) is never exposed on the public dashboard — only aggregate/approximate data.
- Blood type and health-adjacent data are sensitive; access to identity is restricted to matched parties only.
- Contact info is gated behind mutual confirmation — both sides must opt in before either sees email/phone.
- In-app chat is the primary negotiation path, reducing the need to share personal contact info.
- This is a hackathon demo, not a certified medical system — no real patient data should ever be used in testing.

## 11. Milestones (Hackathon Timeline)

| Phase | Deliverable |
|---|---|
| Day 1 | Repo scaffolding, data models, donor + requester registration flows |
| Day 2 | Matching engine + requester-driven accept flow + email notifications |
| Day 3 | Live dashboard (map, cards, feed) + donor confirm/decline + chat |
| Day 4 | Polish, seed demo data, record walkthrough, generate presentation via PresentMeApp, submit |

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Free-tier email API rate limits during live demo | Pre-seed demo data; use queued fallback notifications |
| No real donor data for a convincing demo | Ship a realistic seed script generating synthetic donors/requests across a city |
| Geolocation permission denied by browser | Manual address/zip entry fallback |
| Scope creep into organ logistics | Explicitly fenced to blood-only for MVP; documented as roadmap item |
| Abuse / spam requests | Block/report mechanism; rate limiting on accept actions |
