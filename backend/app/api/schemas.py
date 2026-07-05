"""Pydantic v2 schemas for request validation and response serialisation.

Blood type and urgency constraints are enforced via regex `pattern` fields
to keep them in sync with the database CHECK constraints.
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
    phone: str | None = Field(None, max_length=20)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    available: bool = True
    last_donation_date: date | None = None


class DonorResponse(BaseModel):
    donor_id: UUID
    name: str
    blood_type: str
    email: str
    phone: str | None = None
    latitude: float
    longitude: float
    available: bool
    last_donation_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AvailabilityUpdate(BaseModel):
    available: bool


# ---------------------------------------------------------------------------
# Requester schemas
# ---------------------------------------------------------------------------
class RequesterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=320)
    phone: str | None = Field(None, max_length=20)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class RequesterResponse(BaseModel):
    requester_id: UUID
    name: str
    email: str
    phone: str | None = None
    latitude: float
    longitude: float
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class RequestCreate(BaseModel):
    """Create a shortage request."""
    requester_id: UUID
    blood_type: str = Field(..., pattern=r"^(O|A|B|AB)[+-]$")
    units_needed: int = Field(..., ge=1, le=10)
    urgency: str = Field(..., pattern=r"^(critical|high|routine)$")


class RequestResponse(BaseModel):
    request_id: UUID
    requester_id: UUID
    blood_type: str
    units_needed: int
    urgency: str
    status: str
    created_at: datetime
    matched_donors: int = 0

    model_config = {"from_attributes": True}


class VerifyRequest(BaseModel):
    """Verify a request using the short code."""
    code: str = Field(..., min_length=1, max_length=8)


# ---------------------------------------------------------------------------
# Match schemas
# ---------------------------------------------------------------------------
class MatchResponse(BaseModel):
    match_id: UUID
    request_id: UUID
    donor_id: UUID
    response: str
    notified_at: datetime | None
    accepted_at: datetime | None
    confirmed_at: datetime | None
    contact_shared_at: datetime | None
    request_status: str
    accepted_count: int
    units_needed: int

    model_config = {"from_attributes": True}


class CandidateDonor(BaseModel):
    """A ranked candidate donor for a request (no contact info yet)."""
    donor_id: UUID
    name: str
    blood_type: str
    distance_km: float
    last_donation_date: date | None
    available: bool


# ---------------------------------------------------------------------------
# Message schemas
# ---------------------------------------------------------------------------
class MessageCreate(BaseModel):
    sender_type: str = Field(..., pattern=r"^(requester|donor)$")
    sender_id: UUID
    body: str = Field(..., min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    message_id: UUID
    match_id: UUID
    sender_type: str
    sender_id: UUID
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Block schemas
# ---------------------------------------------------------------------------
class BlockCreate(BaseModel):
    donor_id: UUID
    requester_id: UUID
    reason: str | None = None
