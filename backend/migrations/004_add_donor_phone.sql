-- Add phone number column to donors table.
-- Phone is optional — allows hospitals to contact donors directly
-- when accepting a blood donation match.
ALTER TABLE donors ADD COLUMN phone TEXT;
