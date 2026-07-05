"""Blood-type compatibility matching engine with PostGIS geo-proximity search.

Implements the core matching algorithm described in TDD §5:
  1. Look up ABO/Rh-compatible donor blood types via COMPATIBILITY_MAP.
  2. Filter available donors within an urgency-based radius (ST_DWithin).
  3. Rank by distance (closest first), capped at MAX_MATCHES.

Supports both hospital and patient request paths — the same find_matches()
function handles both by resolving the request's origin location from
either hospital.location or patient.location.

TRUST MODEL — why patient requests require verification before matching:

  Hospitals are verified entities. Their staff submit requests as part of
  clinical workflow — the system can trust that a hospital request
  represents a real patient need. Hospital requests are created with
  verified_by_hospital=True and go straight to matching.

  Individual patients can submit requests directly, but without any
  gatekeeping the system is vulnerable to false or duplicate requests
  that waste donor time and erode platform trust. Donors receive real
  email notifications and may rearrange their schedules to help — a
  false request means a donor showed up for nothing, which damages
  credibility for future real emergencies.

  Patient requests are created with verified_by_hospital=False and a
  short verification_code (8 chars). The patient enters this code on
  the status page after receiving it from hospital staff during triage.
  Only then does find_matches() include the request.

  This is a deliberate UX tradeoff: we add friction for patients (one
  extra step) in exchange for donor trust (every notification is real).
  For hospitals, no friction is added — they are the trust anchor.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.donor import Donor
from app.models.request import Request

# ---------------------------------------------------------------------------
# ABO/Rh donor-recipient compatibility map.
#
# Key   = recipient (request) blood type
# Value = list of donor blood types that can donate to that recipient
#
# Rules:
#   - O- is the universal donor (can donate to everyone)
#   - AB+ is the universal recipient (can receive from everyone)
#   - Rh- recipients can only receive from Rh- donors
#   - Rh+ recipients can receive from Rh+ and Rh- donors of same ABO group
# ---------------------------------------------------------------------------
COMPATIBILITY_MAP: dict[str, list[str]] = {
    "O-":  ["O-"],
    "O+":  ["O-", "O+"],
    "A-":  ["O-", "A-"],
    "A+":  ["O-", "O+", "A-", "A+"],
    "B-":  ["O-", "B-"],
    "B+":  ["O-", "O+", "B-", "B+"],
    "AB-": ["O-", "A-", "B-", "AB-"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
}

# ---------------------------------------------------------------------------
# Urgency → search radius in kilometres.
#
# Critical requests widen the net to find more donors quickly.
# Routine requests use a smaller radius to notify only nearby donors.
# ---------------------------------------------------------------------------
URGENCY_RADIUS_KM: dict[str, int] = {
    "critical": 30,
    "high": 15,
    "routine": 8,
}

# Hard cap on matches returned per request for notification batching.
MAX_MATCHES = 50


def get_compatible_types(blood_type: str) -> list[str]:
    """Return the donor blood types compatible with the given recipient type.
    Raises ValueError for unknown blood types."""
    try:
        return COMPATIBILITY_MAP[blood_type]
    except KeyError:
        raise ValueError(f"Unknown blood type: {blood_type}")


def get_search_radius_km(urgency: str) -> int:
    """Return the search radius in km for the given urgency level.
    Raises ValueError for unknown urgency levels."""
    try:
        return URGENCY_RADIUS_KM[urgency]
    except KeyError:
        raise ValueError(f"Unknown urgency level: {urgency}")


def _resolve_origin_location(request: Request, db: Session):
    """Resolve the origin location for a request.

    Hospital requests use the hospital's registered location.
    Patient requests use the patient's provided location.

    Raises ValueError if the request references a missing entity.
    """
    if request.requester_type == "hospital":
        if request.hospital is None:
            raise ValueError(f"Hospital request {request.request_id} has no hospital")
        return request.hospital.location
    elif request.requester_type == "patient":
        if request.patient is None:
            raise ValueError(f"Patient request {request.request_id} has no patient")
        return request.patient.location
    else:
        raise ValueError(f"Unknown requester_type: {request.requester_type}")


def find_matches(request: Request, db: Session) -> list[Donor]:
    """Find compatible, available donors within the urgency-based radius.

    1. Look up compatible blood types from COMPATIBILITY_MAP.
    2. Run a PostGIS ST_DWithin query filtering available donors within
       the radius defined by the request's urgency level.
    3. Order by ST_Distance (closest first), capped at MAX_MATCHES.

    Works identically for hospital and patient requests — the origin
    location is resolved from the appropriate entity.

    Trust gate: only verified requests (verified_by_hospital=True) are
    matched. Patient requests start unverified and must be confirmed
    with a short code before donors are notified.
    """
    if not request.verified_by_hospital:
        return []
    compatible_types = get_compatible_types(request.blood_type)
    radius_km = get_search_radius_km(request.urgency)
    radius_m = radius_km * 1000  # ST_DWithin uses metres for GEOGRAPHY

    # Resolve origin location from hospital or patient.
    origin_location = _resolve_origin_location(request, db)

    donors = (
        db.execute(
            select(Donor).where(
                Donor.blood_type.in_(compatible_types),
                Donor.available.is_(True),
                func.ST_DWithin(
                    Donor.location,
                    origin_location,
                    radius_m,
                ),
            )
            .order_by(
                func.ST_Distance(Donor.location, origin_location)
            )
            .limit(MAX_MATCHES)
        )
        .scalars()
        .all()
    )

    return list(donors)
