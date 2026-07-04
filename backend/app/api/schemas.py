from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------
VALID_BLOOD_TYPES = ("O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+")
VALID_URGENCIES = ("critical", "high", "routine")


# ---------------------------------------------------------------------------
# Donor schemas
# ---------------------------------------------------------------------------
class DonorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    blood_type: str = Field(..., pattern=r"^(O|A|B|AB)[+-]$")
    email: str = Field(..., min_length=3, max_length=320)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    available: bool = True
    last_donation_date: date | None = None


class DonorResponse(BaseModel):
    donor_id: UUID
    name: str
    blood_type: str
    email: str
    latitude: float
    longitude: float
    available: bool
    last_donation_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AvailabilityUpdate(BaseModel):
    available: bool


# ---------------------------------------------------------------------------
# Hospital schemas
# ---------------------------------------------------------------------------
class HospitalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    verified: bool = False


class HospitalResponse(BaseModel):
    hospital_id: UUID
    name: str
    latitude: float
    longitude: float
    verified: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class RequestCreate(BaseModel):
    hospital_id: UUID
    blood_type: str = Field(..., pattern=r"^(O|A|B|AB)[+-]$")
    units_needed: int = Field(..., ge=1)
    urgency: str = Field(..., pattern=r"^(critical|high|routine)$")


class RequestResponse(BaseModel):
    request_id: UUID
    hospital_id: UUID
    blood_type: str
    units_needed: int
    urgency: str
    status: str
    created_at: datetime
    matched_donors: int

    model_config = {"from_attributes": True}
