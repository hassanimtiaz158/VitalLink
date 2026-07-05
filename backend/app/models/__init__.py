"""SQLAlchemy ORM models mapped to the PostGIS schema (TDD §3).

Tables:
  Hospital — Healthcare facilities that submit shortage requests.
  Patient  — Individuals who need blood and submit requests directly.
  Donor    — Registered blood donors with ABO/Rh type and location.
  Request  — Active shortage requests from hospitals or patients (open → fulfilled).
  Match    — Donor–request pairings with response status tracking.
"""
from app.models.hospital import Hospital
from app.models.patient import Patient
from app.models.donor import Donor
from app.models.request import Request
from app.models.match import Match

__all__ = ["Hospital", "Patient", "Donor", "Request", "Match"]
