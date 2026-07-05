"""Pydantic v2 schemas for request validation and response serialisation.

Blood type and urgency constraints are enforced via regex `pattern` fields
to keep them in sync with the database CHECK constraints (TDD §3).

RequestCreate supports two paths:
  - Hospital path: hospital_id required, requester_type='hospital'
  - Patient path:  patient_id required, requester_type='patient'
"""
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


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
# Patient schemas
# ---------------------------------------------------------------------------
class PatientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    blood_type: str = Field(..., pattern=r"^(O|A|B|AB)[+-]$")
    email: str = Field(..., min_length=3, max_length=320)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class PatientResponse(BaseModel):
    patient_id: UUID
    name: str
    blood_type: str
    email: str
    latitude: float
    longitude: float
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class RequestCreate(BaseModel):
    """Create a shortage request.

    Exactly one of hospital_id or patient_id must be provided.
    requester_type is inferred from which ID is supplied.
    """
    hospital_id: UUID | None = None
    patient_id: UUID | None = None
    blood_type: str = Field(..., pattern=r"^(O|A|B|AB)[+-]$")
    units_needed: int = Field(..., ge=1)
    urgency: str = Field(..., pattern=r"^(critical|high|routine)$")

    @model_validator(mode="after")
    def validate_owner(self) -> "RequestCreate":
        if self.hospital_id and self.patient_id:
            raise ValueError("Provide exactly one of hospital_id or patient_id, not both")
        if not self.hospital_id and not self.patient_id:
            raise ValueError("Provide either hospital_id or patient_id")
        return self

    @property
    def requester_type(self) -> str:
        return "hospital" if self.hospital_id else "patient"


class RequestResponse(BaseModel):
    request_id: UUID
    requester_type: str
    hospital_id: UUID | None
    patient_id: UUID | None
    blood_type: str
    units_needed: int
    urgency: str
    status: str
    verified_by_hospital: bool
    verification_code: str | None = None
    created_at: datetime
    matched_donors: int

    model_config = {"from_attributes": True}


class VerifyRequest(BaseModel):
    """Verify a patient-submitted request using the short code from hospital staff.

    Hospital requests skip this step entirely — they are verified from creation
    because hospital staff have already confirmed the need is real.
    """
    code: str = Field(..., min_length=1, max_length=8)


# ---------------------------------------------------------------------------
# Match schemas
# ---------------------------------------------------------------------------
class RespondToMatch(BaseModel):
    response: str = Field(..., pattern=r"^(accepted|declined)$")
    token: str = Field(..., min_length=1)


class MatchResponse(BaseModel):
    match_id: UUID
    request_id: UUID
    donor_id: UUID
    response: str
    notified_at: datetime | None
    request_status: str
    accepted_count: int
    units_needed: int

    model_config = {"from_attributes": True}
