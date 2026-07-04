-- VitalLink: Initial schema migration
-- Creates donors, hospitals, requests, and matches tables
-- Requires PostGIS extension for GEOGRAPHY columns

-- Enable PostGIS for geospatial queries (ST_DWithin, ST_Distance)
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- blood_type CHECK constraint values used across multiple tables:
--   'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'
-- These cover all ABO/Rh blood types. The matching engine uses a
-- compatibility map (TDD §5) to determine which donor types are eligible
-- for a given request type.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- urgency CHECK constraint values:
--   'critical' — widen match radius to 30 km
--   'high'     — standard radius of 15 km
--   'routine'  — narrow radius of 8 km
-- Radius is configurable per urgency in the matching engine (TDD §5).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- status CHECK constraint values (request lifecycle):
--   'open'                — initial state, awaiting match
--   'donors_notified'     — matching engine has queued emails
--   'partially_fulfilled' — some donors accepted, units still needed
--   'fulfilled'           — accepted donors >= units_needed
--   'closed'              — hospital confirmed receipt or cancelled
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- response CHECK constraint values (donor reply to notification):
--   'pending'   — email sent, no reply yet
--   'accepted'  — donor confirmed availability
--   'declined'  — donor cannot help right now
-- ---------------------------------------------------------------------------


-- ======================== hospitals =======================================
-- Hospitals (and blood banks) that post shortage requests.
-- Location is stored as a PostGIS GEOGRAPHY point for radius queries.
-- verified flag is a placeholder for a future hospital verification workflow
-- (TDD §11 roadmap); MVP treats it as true by default for seeded data.
-- ==========================================================================

CREATE TABLE hospitals (
    hospital_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    -- GEOGRAPHY(POINT, 4326) stores lat/lng in WGS 84 (standard GPS coords).
    -- Used by PostGIS ST_DWithin for efficient distance-filtered donor queries.
    location    GEOGRAPHY(POINT, 4326) NOT NULL,
    -- Boolean gate for hospital verification; MVP does not enforce this.
    verified    BOOLEAN DEFAULT false
);


-- ======================== donors ==========================================
-- Registered donors who can be matched to shortage requests.
-- The available flag controls whether the matching engine considers them.
-- last_donation_date prevents matching donors who recently donated (medical
-- safety), though enforcement is left to application logic in the MVP.
-- ==========================================================================

CREATE TABLE donors (
    donor_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    -- Enforces valid ABO/Rh blood type strings. Invalid values are rejected
    -- at the database level, not just application validation.
    blood_type        TEXT NOT NULL
                    CHECK (blood_type IN ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
    -- PostGIS point for geospatial radius matching (TDD §5 ST_DWithin query).
    location          GEOGRAPHY(POINT, 4326) NOT NULL,
    -- When false, the matching engine skips this donor entirely.
    available         BOOLEAN DEFAULT true,
    last_donation_date DATE,
    email             TEXT NOT NULL,
    created_at        TIMESTAMP DEFAULT now()
);


-- ======================== requests ========================================
-- Shortage requests posted by hospitals.
-- Each request specifies what blood type is needed, how many units,
-- and how urgently. The matching engine reads these fields to determine
-- compatible donor types and search radius.
-- ==========================================================================

CREATE TABLE requests (
    request_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Foreign key links the request back to the hospital that created it.
    -- ON DELETE RESTRICT prevents orphaned requests if a hospital row is
    -- accidentally removed.
    hospital_id  UUID NOT NULL REFERENCES hospitals(hospital_id) ON DELETE RESTRICT,
    -- Same CHECK constraint as donors.blood_type for consistency.
    blood_type   TEXT NOT NULL
               CHECK (blood_type IN ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
    units_needed INT NOT NULL CHECK (units_needed > 0),
    -- Determines the match radius: critical=30km, high=15km, routine=8km.
    urgency      TEXT NOT NULL
               CHECK (urgency IN ('critical','high','routine')),
    -- Lifecycle state machine (see status CHECK comment above).
    status       TEXT DEFAULT 'open'
               CHECK (status IN ('open','donors_notified','partially_fulfilled','fulfilled','closed')),
    created_at   TIMESTAMP DEFAULT now()
);


-- ======================== matches =========================================
-- Junction record linking a donor to a request after the matching engine
-- identifies them as compatible and geographically eligible.
-- One row per donor-request pair. Response tracks whether the donor
-- accepted, declined, or hasn't replied yet. When enough donors accept
-- (accepted count >= units_needed), the request status transitions to
-- 'fulfilled' via application logic.
-- ==========================================================================

CREATE TABLE matches (
    match_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Each match ties to exactly one request.
    request_id    UUID NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
    -- Each match ties to exactly one donor.
    donor_id      UUID NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
    -- Timestamp when the email notification was dispatched.
    notified_at   TIMESTAMP,
    -- Tracks donor response; starts as 'pending' on match creation.
    response      TEXT DEFAULT 'pending'
                CHECK (response IN ('pending','accepted','declined')),
    -- Prevent the same donor from being matched to the same request twice.
    UNIQUE (request_id, donor_id)
);


-- ======================== indexes =========================================
-- Indexes for common query patterns in the matching engine and dashboard.
-- ==========================================================================

-- Speed up the matching engine's radius query: filter donors by blood type
-- and availability, then sort by distance.
CREATE INDEX idx_donors_blood_available ON donors (blood_type, available);

-- Speed up PostGIS distance queries: GiST index on GEOGRAPHY columns is
-- required for ST_DWithin to use spatial index instead of sequential scan.
CREATE INDEX idx_donors_location ON donors USING GIST (location);

-- Speed up requests by status (active request feed for dashboard).
CREATE INDEX idx_requests_status ON requests (status);

-- Speed up lookups of all matches for a given request (hospital dashboard).
CREATE INDEX idx_matches_request ON matches (request_id);

-- Speed up lookups of all matches for a given donor (donor notification history).
CREATE INDEX idx_matches_donor ON matches (donor_id);
