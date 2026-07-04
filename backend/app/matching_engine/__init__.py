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


def find_matches(request: Request, db: Session) -> list[Donor]:
    """Find compatible, available donors within the urgency-based radius.

    1. Look up compatible blood types from COMPATIBILITY_MAP.
    2. Run a PostGIS ST_DWithin query filtering available donors within
       the radius defined by the request's urgency level.
    3. Order by ST_Distance (closest first), capped at MAX_MATCHES.
    """
    compatible_types = get_compatible_types(request.blood_type)
    radius_km = get_search_radius_km(request.urgency)
    radius_m = radius_km * 1000  # ST_DWithin uses metres for GEOGRAPHY

    # Load the hospital's location for the distance calculation.
    hospital_location = request.hospital.location

    donors = (
        db.execute(
            select(Donor).where(
                Donor.blood_type.in_(compatible_types),
                Donor.available.is_(True),
                func.ST_DWithin(
                    Donor.location,
                    hospital_location,
                    radius_m,
                ),
            )
            .order_by(
                func.ST_Distance(Donor.location, hospital_location)
            )
            .limit(MAX_MATCHES)
        )
        .scalars()
        .all()
    )

    return list(donors)
