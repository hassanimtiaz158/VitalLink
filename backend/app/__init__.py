"""VitalLink — Real-time blood donor matching platform.

FastAPI backend providing:
  - Donor registration with PostGIS location storage.
  - Requester-driven shortage requests.
  - ABO/Rh compatibility matching with geo-proximity search.
  - JWT-signed one-click response links via Resend email.
"""
