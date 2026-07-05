-- VitalLink: Add patient request verification
-- Migration 003: Trust step for patient-submitted requests
--
-- WHY:
-- Hospitals are verified entities — their staff submit requests on behalf of
-- patients as part of clinical workflow. The system can trust that a hospital
-- request represents a real need.
--
-- Individual patients can submit requests directly, but without any gatekeeping
-- the system is vulnerable to false or duplicate requests that waste donor time
-- and erode trust in the platform. This is especially dangerous because donors
-- receive real notifications (email) and may rearrange their schedules to help.
--
-- SOLUTION:
-- Patient requests are created with verified_by_hospital = FALSE and a short
-- verification_code (8 chars). The code is shown to the patient and must be
-- entered on the status page to confirm the request. In practice, patients get
-- this code from hospital staff during triage — the hospital confirms the need
-- is real, then gives the patient the code to unlock the request.
--
-- Hospital requests skip this step entirely (verified_by_hospital = TRUE
-- from creation). This keeps the hospital path frictionless while adding
-- a lightweight trust barrier for the patient path.

-- Add the verification flag (default FALSE — patient requests start unverified).
ALTER TABLE requests ADD COLUMN verified_by_hospital BOOLEAN NOT NULL DEFAULT FALSE;

-- Add the short code patients enter to verify. NULL for hospital requests.
ALTER TABLE requests ADD COLUMN verification_code VARCHAR(8);

-- Index for active-request feed (only show verified requests to donors).
CREATE INDEX idx_requests_verified ON requests (verified_by_hospital)
    WHERE status != 'closed';
