import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.hospital import Hospital
from app.models.donor import Donor
from app.models.request import Request
from app.models.match import Match
from app.matching_engine import find_matches
from app.api.schemas import RequestCreate, RequestResponse

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("", response_model=RequestResponse, status_code=201)
def create_request(payload: RequestCreate, db: Session = Depends(get_db)):
    """Create a shortage request and automatically match compatible donors.

    1. Validates the hospital exists.
    2. Inserts the request with status='open'.
    3. Runs find_matches() to query compatible, nearby, available donors.
    4. Inserts a Match row (response='pending') for each matched donor.
    5. Transitions request status to 'donors_notified' if matches were found.
    6. Returns the request with the matched donor count.
    """
    hospital = db.get(Hospital, payload.hospital_id)
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    request = Request(
        hospital_id=payload.hospital_id,
        blood_type=payload.blood_type,
        units_needed=payload.units_needed,
        urgency=payload.urgency,
        status="open",
    )
    db.add(request)
    db.flush()  # assign request_id before running matches

    donors = find_matches(request, db)

    for donor in donors:
        match = Match(
            request_id=request.request_id,
            donor_id=donor.donor_id,
            response="pending",
        )
        db.add(match)

    if donors:
        request.status = "donors_notified"

    db.commit()
    db.refresh(request)

    return RequestResponse(
        request_id=request.request_id,
        hospital_id=request.hospital_id,
        blood_type=request.blood_type,
        units_needed=request.units_needed,
        urgency=request.urgency,
        status=request.status,
        created_at=request.created_at,
        matched_donors=len(donors),
    )


@router.get("/active")
def get_active_requests(db: Session = Depends(get_db)):
    """Public feed of non-closed requests with hospital info for the live dashboard.
    Returns approximate hospital locations — donor PII is never exposed."""
    rows = (
        db.execute(
            select(
                Request.request_id,
                Request.blood_type,
                Request.units_needed,
                Request.urgency,
                Request.status,
                Request.created_at,
                Hospital.name.label("hospital_name"),
                func.ST_Y(Hospital.location).label("latitude"),
                func.ST_X(Hospital.location).label("longitude"),
                func.count(Match.match_id).label("match_count"),
                func.coalesce(
                    func.sum(func.cast(Match.response == "accepted", db.bind.dialect.name and "integer")),
                    0,
                ).label("accepted_count"),
            )
            .join(Hospital, Request.hospital_id == Hospital.hospital_id)
            .outerjoin(Match, Request.request_id == Match.request_id)
            .where(Request.status != "closed")
            .group_by(
                Request.request_id,
                Request.blood_type,
                Request.units_needed,
                Request.urgency,
                Request.status,
                Request.created_at,
                Hospital.name,
                Hospital.location,
            )
            .order_by(Request.created_at.desc())
        )
        .all()
    )

    return [
        {
            "request_id": str(r.request_id),
            "hospital_name": r.hospital_name,
            "blood_type": r.blood_type,
            "units_needed": r.units_needed,
            "urgency": r.urgency,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "match_count": r.match_count,
            "accepted_count": int(r.accepted_count),
        }
        for r in rows
    ]


@router.get("/stats/supply")
def get_supply_stats(db: Session = Depends(get_db)):
    """Aggregate supply levels per blood type for the dashboard stat cards.
    Returns percentage of target reserve (target = 20 donors per type for demo)."""
    TARGET_PER_TYPE = 20

    rows = (
        db.execute(
            select(
                Donor.blood_type,
                func.count(Donor.donor_id).label("total"),
                func.sum(func.cast(Donor.available, db.bind.dialect.name and "integer")).label("available"),
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

    # Sort by the canonical order from the compatibility map
    order = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]
    result.sort(key=lambda x: order.index(x["blood_type"]) if x["blood_type"] in order else 99)

    return result
