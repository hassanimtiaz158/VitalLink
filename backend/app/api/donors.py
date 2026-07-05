"""Donor endpoints — registration, profile, availability, and match history.

POST   /donors              — Register a new donor with geolocation.
GET    /donors/{id}         — Get donor profile by ID.
PATCH  /donors/{id}/availability — Toggle availability flag.
GET    /donors/{id}/matches — Get donor's match requests (pending + history).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, cast, Integer
from sqlalchemy.orm import Session
from geoalchemy2 import Geometry

from app.core.database import get_db
from app.models.donor import Donor
from app.models.request import Request
from app.models.match import Match
from app.models.hospital import Hospital
from app.api.schemas import DonorCreate, DonorResponse, AvailabilityUpdate

router = APIRouter(prefix="/donors", tags=["donors"])


def _donor_to_response(donor: Donor, db: Session) -> DonorResponse:
    """Convert a Donor ORM object to a DonorResponse, extracting lat/lng
    from the PostGIS GEOGRAPHY column via ST_Y / ST_X."""
    lat, lng = db.execute(
        select(func.ST_Y(cast(donor.location, Geometry)), func.ST_X(cast(donor.location, Geometry)))
    ).one()

    return DonorResponse(
        donor_id=donor.donor_id,
        name=donor.name,
        blood_type=donor.blood_type,
        email=donor.email,
        latitude=lat,
        longitude=lng,
        available=donor.available,
        last_donation_date=donor.last_donation_date,
        created_at=donor.created_at,
    )


@router.post("", response_model=DonorResponse, status_code=201)
def register_donor(payload: DonorCreate, db: Session = Depends(get_db)):
    """Register a new donor. Location is stored as a PostGIS GEOGRAPHY point
    built from the submitted latitude/longitude via ST_SetSRID(ST_MakePoint)."""
    point = func.ST_SetSRID(
        func.ST_MakePoint(payload.longitude, payload.latitude), 4326
    )

    donor = Donor(
        name=payload.name,
        blood_type=payload.blood_type,
        email=payload.email,
        location=point,
        available=payload.available,
        last_donation_date=payload.last_donation_date,
    )
    db.add(donor)
    db.commit()
    db.refresh(donor)

    return _donor_to_response(donor, db)


@router.get("/{donor_id}", response_model=DonorResponse)
def get_donor(donor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get a donor's profile by ID."""
    donor = db.get(Donor, donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    return _donor_to_response(donor, db)


@router.patch("/{donor_id}/availability", response_model=DonorResponse)
def update_availability(
    donor_id: uuid.UUID,
    payload: AvailabilityUpdate,
    db: Session = Depends(get_db),
):
    """Toggle a donor's availability flag."""
    donor = db.get(Donor, donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    donor.available = payload.available
    db.commit()
    db.refresh(donor)

    return _donor_to_response(donor, db)


@router.get("/{donor_id}/matches")
def get_donor_matches(donor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get all matches for a donor — pending requests and donation history.

    Returns pending matches (requests needing a response) and completed
    matches (accepted/declined), plus an impact summary.
    """
    donor = db.get(Donor, donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    rows = (
        db.execute(
            select(
                Match.match_id,
                Match.request_id,
                Match.response,
                Match.notified_at,
                Request.blood_type.label("request_blood_type"),
                Request.units_needed,
                Request.urgency,
                Request.status.label("request_status"),
                Request.requester_type,
                Request.hospital_id,
                Request.patient_id,
                Hospital.name.label("hospital_name"),
                func.ST_Distance(Donor.location, Hospital.location).label("distance_m"),
            )
            .join(Request, Match.request_id == Request.request_id)
            .outerjoin(Hospital, Request.hospital_id == Hospital.hospital_id)
            .where(Match.donor_id == donor_id)
            .order_by(Match.notified_at.desc().nullslast())
        )
        .all()
    )

    pending = []
    history = []

    for r in rows:
        entry = {
            "match_id": str(r.match_id),
            "request_id": str(r.request_id),
            "response": r.response,
            "notified_at": r.notified_at.isoformat() + "+00:00" if r.notified_at else None,
            "blood_type": r.request_blood_type,
            "units_needed": r.units_needed,
            "urgency": r.urgency,
            "request_status": r.request_status,
            "requester_type": r.requester_type,
            "hospital_name": r.hospital_name,
            "distance_km": round(r.distance_m / 1000, 1) if r.distance_m else None,
        }
        if r.response == "pending":
            pending.append(entry)
        else:
            history.append(entry)

    # Impact stats
    accepted_count = sum(1 for r in rows if r.response == "accepted")
    total_notified = len(rows)

    return {
        "donor_id": str(donor.donor_id),
        "name": donor.name,
        "blood_type": donor.blood_type,
        "available": donor.available,
        "pending": pending,
        "history": history,
        "impact": {
            "total_notified": total_notified,
            "accepted": accepted_count,
            "lives_potentially_saved": accepted_count,  # 1 donation ≈ 1 life
        },
    }
