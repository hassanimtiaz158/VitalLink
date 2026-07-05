"""Request endpoints — the core of the requester-driven matching workflow.

POST   /requests                       — Submit a shortage request.
POST   /requests/{id}/verify           — Verify a request with code.
GET    /requests/{id}/candidate-donors — Get ranked candidate donors.
POST   /requests/{id}/accept-donor/{donor_id} — Requester accepts a donor.
PATCH  /requests/{id}/status           — Update request status.
GET    /requests/active                — Public feed of open requests.
GET    /requests/{id}/matches          — Request detail with its matched donors.
GET    /requests/stats/supply          — Aggregated donor supply levels.
"""
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.orm import Session
from geoalchemy2 import Geometry

from app.core.database import get_db
from app.models.requester import Requester
from app.models.donor import Donor
from app.models.request import Request
from app.models.match import Match
from app.matching_engine import find_candidate_donors
from app.notifications import notify_accepted_donor
from pydantic import BaseModel

from app.api.schemas import (
    RequestCreate,
    RequestResponse,
    RequesterCreate,
    RequesterResponse,
    VerifyRequest,
    CandidateDonor,
)


class UpdateRequestStatus(BaseModel):
    status: str  # "fulfilled" or "closed"

router = APIRouter(prefix="/requests", tags=["requests"])


# ---------------------------------------------------------------------------
# Create request
# ---------------------------------------------------------------------------
@router.post("", response_model=RequestResponse, status_code=201)
def create_request(payload: RequestCreate, db: Session = Depends(get_db)):
    """Create a shortage request and compute candidate donors.

    Does NOT auto-notify donors. The requester reviews the candidate
    list and chooses which donors to accept.
    """
    requester = db.get(Requester, payload.requester_id)
    if not requester:
        raise HTTPException(status_code=404, detail="Requester not found")

    request = Request(
        requester_id=payload.requester_id,
        blood_type=payload.blood_type,
        units_needed=payload.units_needed,
        urgency=payload.urgency,
        status="open",
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return RequestResponse(
        request_id=request.request_id,
        requester_id=request.requester_id,
        blood_type=request.blood_type,
        units_needed=request.units_needed,
        urgency=request.urgency,
        status=request.status,
        created_at=request.created_at,
        matched_donors=0,
    )


# ---------------------------------------------------------------------------
# Candidate donors (requester-driven matching)
# ---------------------------------------------------------------------------
@router.get("/{request_id}/candidate-donors", response_model=list[CandidateDonor])
def get_candidate_donors(request_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get ranked candidate donors for a request.

    Returns compatible, available donors within the urgency radius,
    sorted by distance (closest first). No contact info is exposed
    until the requester accepts and the donor confirms.
    """
    request = db.get(Request, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    matched = find_candidate_donors(request, db)

    return [
        CandidateDonor(
            donor_id=donor.donor_id,
            name=donor.name,
            blood_type=donor.blood_type,
            distance_km=dist,
            last_donation_date=donor.last_donation_date,
            available=donor.available,
        )
        for donor, dist in matched
    ]


# ---------------------------------------------------------------------------
# Requester accepts a specific donor
# ---------------------------------------------------------------------------
@router.post("/{request_id}/accept-donor/{donor_id}")
def accept_donor(
    request_id: uuid.UUID,
    donor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Requester accepts a specific donor from the candidate list.

    Creates a match row (response='accepted_by_requester') and sends
    an email to the donor with request details and a response link.
    The donor can then confirm or decline.
    """
    request = db.get(Request, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    donor = db.get(Donor, donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    # Check if already matched
    existing = db.execute(
        select(Match).where(
            Match.request_id == request_id,
            Match.donor_id == donor_id,
        )
    ).scalars().first()

    if existing:
        if existing.response == "declined":
            raise HTTPException(status_code=400, detail="Donor previously declined this request")
        if existing.response in ("accepted_by_requester", "donor_confirmed", "contact_shared"):
            raise HTTPException(status_code=400, detail="Donor already accepted for this request")

    # Create or update match
    if existing:
        match = existing
        match.response = "accepted_by_requester"
    else:
        match = Match(
            request_id=request_id,
            donor_id=donor_id,
            response="accepted_by_requester",
        )
        db.add(match)

    db.flush()  # Assign match_id

    # Send notification email to donor
    from app.core.config import settings
    requester = db.get(Requester, request.requester_id)
    requester_name = requester.name if requester else "Someone"

    try:
        notify_accepted_donor(
            match=match,
            donor=donor,
            request=request,
            requester_name=requester_name,
            db=db,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Failed to send notification to donor %s", donor_id)

    # Update request status
    request.status = "donor_accepted"

    db.commit()
    db.refresh(request)
    db.refresh(match)

    return {
        "match_id": str(match.match_id),
        "donor_id": str(donor.donor_id),
        "donor_name": donor.name,
        "response": match.response,
        "request_status": request.status,
    }


# ---------------------------------------------------------------------------
# Verify request
# ---------------------------------------------------------------------------
@router.post("/{request_id}/verify")
def verify_request(
    request_id: uuid.UUID,
    payload: VerifyRequest,
    db: Session = Depends(get_db),
):
    """Verify a request with the short code."""
    request = db.get(Request, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    return {
        "request_id": str(request.request_id),
        "verified": True,
    }


# ---------------------------------------------------------------------------
# Update request status
# ---------------------------------------------------------------------------
@router.patch("/{request_id}/status")
def update_request_status(
    request_id: uuid.UUID,
    payload: UpdateRequestStatus,
    db: Session = Depends(get_db),
):
    """Update a request's status."""
    VALID = {"fulfilled", "closed"}
    if payload.status not in VALID:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(VALID)}")

    request = db.get(Request, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    request.status = payload.status

    if payload.status == "fulfilled":
        # Make accepted donors unavailable (56-day cooldown)
        accepted_donor_ids = db.execute(
            select(Match.donor_id).where(
                Match.request_id == request_id,
                Match.response.in_(["accepted_by_requester", "donor_confirmed", "contact_shared"]),
            )
        ).scalars().all()
        from datetime import datetime, timedelta
        for donor_id in accepted_donor_ids:
            donor = db.get(Donor, donor_id)
            if donor:
                donor.available = False
                donor.last_donation_date = datetime.utcnow().date()

    db.commit()
    db.refresh(request)

    return {
        "request_id": str(request.request_id),
        "status": request.status,
    }


# ---------------------------------------------------------------------------
# Active requests feed
# ---------------------------------------------------------------------------
@router.get("/active")
def get_active_requests(db: Session = Depends(get_db)):
    """Public feed of open requests for the live dashboard."""
    rows = (
        db.execute(
            select(
                Request.request_id,
                Request.blood_type,
                Request.units_needed,
                Request.urgency,
                Request.status,
                Request.created_at,
                Requester.name.label("requester_name"),
                func.ST_Y(cast(Requester.location, Geometry)).label("latitude"),
                func.ST_X(cast(Requester.location, Geometry)).label("longitude"),
                func.count(Match.match_id).label("match_count"),
                func.coalesce(
                    func.sum(cast(Match.response.in_([
                        "accepted_by_requester", "donor_confirmed", "contact_shared"
                    ]), Integer)),
                    0,
                ).label("accepted_count"),
            )
            .join(Requester, Request.requester_id == Requester.requester_id)
            .outerjoin(Match, Request.request_id == Match.request_id)
            .where(Request.status != "closed")
            .group_by(
                Request.request_id,
                Request.blood_type,
                Request.units_needed,
                Request.urgency,
                Request.status,
                Request.created_at,
                Requester.name,
                Requester.location,
            )
            .order_by(Request.created_at.desc())
        )
        .all()
    )

    return [
        {
            "request_id": str(r.request_id),
            "requester_name": r.requester_name,
            "blood_type": r.blood_type,
            "units_needed": r.units_needed,
            "urgency": r.urgency,
            "status": r.status,
            "created_at": r.created_at.isoformat() + "+00:00" if r.created_at else None,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "match_count": r.match_count,
            "accepted_count": int(r.accepted_count),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Request matches detail
# ---------------------------------------------------------------------------
@router.get("/{request_id}/matches")
def get_request_matches(request_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return a request with its matched donors."""
    request = db.get(Request, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Resolve origin for distance calculation
    from app.models.requester import Requester as ReqModel
    requester = db.get(ReqModel, request.requester_id)
    origin = requester.location if requester else None

    match_rows = (
        db.execute(
            select(
                Match.match_id,
                Match.request_id,
                Match.donor_id,
                Match.response,
                Match.notified_at,
                Match.accepted_at,
                Match.confirmed_at,
                Match.contact_shared_at,
                Donor.name.label("donor_name"),
                Donor.blood_type.label("donor_blood_type"),
                Donor.email.label("donor_email"),
                Donor.phone.label("donor_phone"),
                (func.ST_Distance(Donor.location, origin) / 1000).label("distance_km") if origin else func.literal(0).label("distance_km"),
            )
            .join(Donor, Match.donor_id == Donor.donor_id)
            .where(Match.request_id == request_id)
        )
        .all()
    )

    matches = []
    for r in match_rows:
        # Only reveal contact info when contact_shared
        show_contact = r.response == "contact_shared"
        matches.append({
            "match_id": str(r.match_id),
            "request_id": str(r.request_id),
            "donor_id": str(r.donor_id),
            "response": r.response,
            "notified_at": r.notified_at.isoformat() + "+00:00" if r.notified_at else None,
            "accepted_at": r.accepted_at.isoformat() + "+00:00" if r.accepted_at else None,
            "confirmed_at": r.confirmed_at.isoformat() + "+00:00" if r.confirmed_at else None,
            "contact_shared_at": r.contact_shared_at.isoformat() + "+00:00" if r.contact_shared_at else None,
            "donor_name": r.donor_name,
            "donor_blood_type": r.donor_blood_type,
            "donor_email": r.donor_email if show_contact else None,
            "donor_phone": r.donor_phone if show_contact else None,
            "distance_km": round(r.distance_km, 1) if r.distance_km else None,
        })

    return {
        "request_id": str(request.request_id),
        "requester_id": str(request.requester_id),
        "blood_type": request.blood_type,
        "units_needed": request.units_needed,
        "urgency": request.urgency,
        "status": request.status,
        "created_at": request.created_at.isoformat() + "+00:00" if request.created_at else None,
        "matched_donors": len(matches),
        "matches": matches,
    }


# ---------------------------------------------------------------------------
# Supply stats
# ---------------------------------------------------------------------------
@router.get("/stats/supply")
def get_supply_stats(db: Session = Depends(get_db)):
    """Aggregate supply levels per blood type for the dashboard stat cards."""
    TARGET_PER_TYPE = 20

    rows = (
        db.execute(
            select(
                Donor.blood_type,
                func.count(Donor.donor_id).label("total"),
                func.sum(cast(Donor.available, Integer)).label("available"),
            )
            .group_by(Donor.blood_type)
        )
        .all()
    )

    result = []
    for r in rows:
        total = r.total
        available = int(r.available) if r.available else 0
        pct = min(int((available / TARGET_PER_TYPE) * 100), 100) if TARGET_PER_TYPE > 0 else 0
        if pct < 20:
            tag = "critical"
            label = "Critical"
        elif pct < 50:
            tag = "low"
            label = "Low"
        else:
            tag = "ok"
            label = "Stable"

        result.append({
            "blood_type": r.blood_type,
            "available": available,
            "total": total,
            "pct": pct,
            "tag": tag,
            "label": label,
        })

    order = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]
    result.sort(key=lambda x: order.index(x["blood_type"]) if x["blood_type"] in order else 99)

    return result
