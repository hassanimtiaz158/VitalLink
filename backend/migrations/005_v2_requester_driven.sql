-- VitalLink v2: Remove hospitals, add requesters, messages, blocks.
-- This migration transforms the schema from hospital-driven to requester-driven matching.

-- 1. Drop hospital-dependent objects
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS hospitals CASCADE;

-- 2. Create requesters table (replaces hospitals)
CREATE TABLE requesters (
    requester_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Recreate requests with requester_id (no hospital_id)
CREATE TABLE requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES requesters(requester_id) ON DELETE CASCADE,
    blood_type TEXT NOT NULL CHECK (blood_type IN ('O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+')),
    units_needed INTEGER NOT NULL CHECK (units_needed > 0),
    urgency TEXT NOT NULL DEFAULT 'high' CHECK (urgency IN ('critical', 'high', 'routine')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'donor_accepted', 'donor_confirmed', 'contact_shared', 'fulfilled', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_requests_requester ON requests (requester_id);
CREATE INDEX idx_requests_status ON requests (status);
CREATE INDEX idx_requests_blood_type ON requests (blood_type);

-- 4. Recreate matches with new response states
CREATE TABLE matches (
    match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
    response TEXT NOT NULL DEFAULT 'pending' CHECK (response IN ('pending', 'accepted_by_requester', 'donor_confirmed', 'contact_shared', 'declined')),
    notified_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    contact_shared_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(request_id, donor_id)
);

CREATE INDEX idx_matches_request ON matches (request_id);
CREATE INDEX idx_matches_donor ON matches (donor_id);

-- 5. Messages table for in-app chat
CREATE TABLE messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('requester', 'donor')),
    sender_id UUID NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_match ON messages (match_id);

-- 6. Blocks table for abuse prevention
CREATE TABLE blocks (
    block_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES requesters(requester_id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(donor_id, requester_id)
);

CREATE INDEX idx_blocks_donor ON blocks (donor_id);
CREATE INDEX idx_blocks_requester ON blocks (requester_id);
