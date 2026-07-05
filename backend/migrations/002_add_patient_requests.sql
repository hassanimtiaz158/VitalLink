-- VitalLink: Add requester_type and patient_id to requests table
-- Migration 002: Supports both hospital and patient request paths

-- ======================== patients =========================================
-- Patients who need blood and submit requests directly.
-- Minimal table — stores only what the matching engine needs (location
-- for geo-proximity search and blood_type for display).
-- ==========================================================================

CREATE TABLE patients (
    patient_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    blood_type  TEXT NOT NULL
                CHECK (blood_type IN ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
    -- GEOGRAPHY(POINT, 4326) — patient's location for radius matching.
    location    GEOGRAPHY(POINT, 4326) NOT NULL,
    email       TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT now()
);


-- ======================== requests (alter) =================================
-- Add requester_type, make hospital_id nullable, add patient_id FK.
-- A request belongs to exactly one of: hospital or patient.
-- ==========================================================================

-- Add the requester type discriminator.
ALTER TABLE requests ADD COLUMN requester_type TEXT NOT NULL DEFAULT 'hospital'
    CHECK (requester_type IN ('patient', 'hospital'));

-- Make hospital_id nullable (was NOT NULL, now optional).
ALTER TABLE requests ALTER COLUMN hospital_id DROP NOT NULL;

-- Add patient_id FK (nullable — only set when requester_type = 'patient').
ALTER TABLE requests ADD COLUMN patient_id UUID
    REFERENCES patients(patient_id) ON DELETE RESTRICT;

-- Ensure exactly one of hospital_id or patient_id is set.
ALTER TABLE requests ADD CONSTRAINT ck_requests_exactly_one_owner
    CHECK (
        (hospital_id IS NOT NULL AND patient_id IS NULL AND requester_type = 'hospital')
        OR
        (hospital_id IS NULL AND patient_id IS NOT NULL AND requester_type = 'patient')
    );

-- Index for patient request lookups.
CREATE INDEX idx_requests_patient ON requests (patient_id) WHERE patient_id IS NOT NULL;
