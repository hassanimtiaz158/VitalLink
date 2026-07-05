"""Shortage request endpoints — the core of the matching workflow.

POST /requests          — Submit a shortage request and auto-match donors.
GET  /requests/active   — Public feed of open requests for the live dashboard.
GET  /requests/{id}/matches — Request detail with its matched donors.
GET  /requests/stats/supply — Aggregated donor supply levels per blood type.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.orm import Session
from geoalchemy2 import Geometry

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
                func.ST_Y(func.cast(Hospital.location, Geometry)).label("latitude"),
                func.ST_X(func.cast(Hospital.location, Geometry)).label("longitude"),
                func.count(Match.match_id).label("match_count"),
                func.coalesce(
                    func.sum(cast(Match.response == "accepted", Integer)),
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


@router.get("/{request_id}/matches")
def get_request_matches(request_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return a request with its matched donors, including donor info and distance."""
    request = db.get(Request, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    hospital = db.get(Hospital, request.hospital_id)

    match_rows = (
        db.execute(
            select(
                Match.match_id,
                Match.request_id,
                Match.donor_id,
                Match.response,
                Match.notified_at,
                Donor.name.label("donor_name"),
                Donor.blood_type.label("donor_blood_type"),
                func.ST_Distance(Donor.location, hospital.location).label("distance_m"),
            )
            .join(Donor, Match.donor_id == Donor.donor_id)
            .where(Match.request_id == request_id)
        )
        .all()
    )

    matches = [
        {
            "match_id": str(r.match_id),
            "request_id": str(r.request_id),
            "donor_id": str(r.donor_id),
            "response": r.response,
            "notified_at": r.notified_at.isoformat() if r.notified_at else None,
            "donor_name": r.donor_name,
            "donor_blood_type": r.donor_blood_type,
            "distance_km": round(r.distance_m / 1000, 1) if r.distance_m else None,
        }
        for r in match_rows
    ]

    return {
        "request_id": str(request.request_id),
        "hospital_id": str(request.hospital_id),
        "blood_type": request.blood_type,
        "units_needed": request.units_needed,
        "urgency": request.urgency,
        "status": request.status,
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "matched_donors": len(matches),
        "matches": matches,
    }


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

    # Sort by the canonical order from the compatibility map
    order = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]
    result.sort(key=lambda x: order.index(x["blood_type"]) if x["blood_type"] in order else 99)

    return result
