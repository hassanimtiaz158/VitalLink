"""Blood-type compatibility matching engine with PostGIS geo-proximity search.

Implements the core matching algorithm:
  1. Look up ABO/Rh-compatible donor blood types via COMPATIBILITY_MAP.
  2. Filter available donors within an urgency-based radius (ST_DWithin).
  3. Rank by distance (closest first), capped at MAX_MATCHES.
  4. Exclude donors who have blocked this requester.

This is now a pure computation — no auto-notification.
The requester reviews the candidate list and chooses which donors to accept.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.donor import Donor
from app.models.request import Request
from app.models.block import Block

# ---------------------------------------------------------------------------
# ABO/Rh donor-recipient compatibility map.
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
# ---------------------------------------------------------------------------
URGENCY_RADIUS_KM: dict[str, int] = {
    "critical": 30,
    "high": 15,
    "routine": 8,
}

MAX_MATCHES = 50


def get_compatible_types(blood_type: str) -> list[str]:
    """Return the donor blood types compatible with the given recipient type."""
    try:
        return COMPATIBILITY_MAP[blood_type]
    except KeyError:
        raise ValueError(f"Unknown blood type: {blood_type}")


def get_search_radius_km(urgency: str) -> int:
    """Return the search radius in km for the given urgency level."""
    try:
        return URGENCY_RADIUS_KM[urgency]
    except KeyError:
        raise ValueError(f"Unknown urgency level: {urgency}")


def _resolve_origin_location(request: Request, db: Session):
    """Resolve the origin location from the requester's registered location."""
    from app.models.requester import Requester
    from sqlalchemy import cast
    from geoalchemy2 import Geometry

    requester = db.get(Requester, request.requester_id)
    if requester is None:
        raise ValueError(f"Request {request.request_id} has no requester")
    return requester.location


def find_candidate_donors(
    request: Request, db: Session
) -> list[tuple[Donor, float]]:
    """Find compatible, available donors within the urgency-based radius.

    Returns a list of (Donor, distance_km) tuples, ordered closest first.

    Excludes donors who have blocked this requester.
    """
    compatible_types = get_compatible_types(request.blood_type)
    radius_km = get_search_radius_km(request.urgency)
    radius_m = radius_km * 1000

    origin_location = _resolve_origin_location(request, db)

    # Find donors who have blocked this requester
    blocked_donor_ids = db.execute(
        select(Block.donor_id).where(Block.requester_id == request.requester_id)
    ).scalars().all()

    rows = (
        db.execute(
            select(
                Donor,
                func.ST_Distance(Donor.location, origin_location).label("distance_m"),
            ).where(
                Donor.blood_type.in_(compatible_types),
                Donor.available.is_(True),
                func.ST_DWithin(
                    Donor.location,
                    origin_location,
                    radius_m,
                ),
                ~Donor.donor_id.in_(blocked_donor_ids) if blocked_donor_ids else True,
            )
            .order_by(
                func.ST_Distance(Donor.location, origin_location)
            )
            .limit(MAX_MATCHES)
        )
        .all()
    )

    return [(donor, round(distance_m / 1000, 1)) for donor, distance_m in rows]
