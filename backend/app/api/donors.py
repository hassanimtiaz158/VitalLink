"""Donor endpoints — registration, profile, availability, and match history.

POST   /donors              — Register a new donor with geolocation.
GET    /donors/{id}         — Get donor profile by ID.
PATCH  /donors/{id}/availability — Toggle availability flag.
GET    /donors/{id}/matches — Get donor's match requests (pending + history).
POST   /donors/{id}/block   — Block a requester.
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
from app.models.requester import Requester
from app.models.block import Block
from app.models.message import Message
from app.api.schemas import DonorCreate, DonorResponse, AvailabilityUpdate, BlockCreate

router = APIRouter(prefix="/donors", tags=["donors"])


@router.get("", response_model=list[DonorResponse])
def list_donors(db: Session = Depends(get_db)):
    """List all donors with locations for the live map."""
    rows = db.execute(
        select(
            Donor.donor_id,
            Donor.name,
            Donor.blood_type,
            Donor.email,
            Donor.phone,
            func.ST_Y(cast(Donor.location, Geometry)).label("latitude"),
            func.ST_X(cast(Donor.location, Geometry)).label("longitude"),
            Donor.available,
            Donor.last_donation_date,
            Donor.created_at,
        )
    ).all()

    return [
        DonorResponse(
            donor_id=r.donor_id,
            name=r.name,
            blood_type=r.blood_type,
            email=r.email,
            phone=r.phone,
            latitude=r.latitude,
            longitude=r.longitude,
            available=r.available,
            last_donation_date=r.last_donation_date,
            created_at=r.created_at,
        )
        for r in rows
    ]


def _donor_to_response(donor: Donor, db: Session) -> DonorResponse:
    """Convert a Donor ORM object to a DonorResponse."""
    lat, lng = db.execute(
        select(func.ST_Y(cast(donor.location, Geometry)), func.ST_X(cast(donor.location, Geometry)))
    ).one()

    return DonorResponse(
        donor_id=donor.donor_id,
        name=donor.name,
        blood_type=donor.blood_type,
        email=donor.email,
        phone=donor.phone,
        latitude=lat,
        longitude=lng,
        available=donor.available,
        last_donation_date=donor.last_donation_date,
        created_at=donor.created_at,
    )


@router.post("", response_model=DonorResponse, status_code=201)
def register_donor(payload: DonorCreate, db: Session = Depends(get_db)):
    """Register a new donor."""
    point = func.ST_SetSRID(
        func.ST_MakePoint(payload.longitude, payload.latitude), 4326
    )

    donor = Donor(
        name=payload.name,
        blood_type=payload.blood_type,
        email=payload.email,
        phone=payload.phone,
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
    """Get all matches for a donor — pending requests and donation history."""
    donor = db.get(Donor, donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    message_count_subq = (
        select(func.count())
        .select_from(Message)
        .where(Message.match_id == Match.match_id)
        .correlate(Match)
        .scalar_subquery()
    )

    rows = (
        db.execute(
            select(
                Match.match_id,
                Match.request_id,
                Match.response,
                Match.notified_at,
                Match.accepted_at,
                Match.confirmed_at,
                Match.contact_shared_at,
                Request.blood_type.label("request_blood_type"),
                Request.units_needed,
                Request.urgency,
                Request.status.label("request_status"),
                Request.requester_id,
                Requester.name.label("requester_name"),
                Requester.email.label("requester_email"),
                Requester.phone.label("requester_phone"),
                func.ST_Distance(Donor.location, Requester.location).label("distance_m"),
                message_count_subq.label("message_count"),
            )
            .join(Request, Match.request_id == Request.request_id)
            .join(Requester, Request.requester_id == Requester.requester_id)
            .join(Donor, Match.donor_id == Donor.donor_id)
            .where(Match.donor_id == donor_id)
            .order_by(Match.notified_at.desc().nullslast())
        )
        .all()
    )

    pending = []
    history = []

    for r in rows:
        # Only reveal contact info when contact_shared
        show_contact = r.response == "contact_shared"
        entry = {
            "match_id": str(r.match_id),
            "request_id": str(r.request_id),
            "response": r.response,
            "notified_at": r.notified_at.isoformat() + "+00:00" if r.notified_at else None,
            "accepted_at": r.accepted_at.isoformat() + "+00:00" if r.accepted_at else None,
            "confirmed_at": r.confirmed_at.isoformat() + "+00:00" if r.confirmed_at else None,
            "contact_shared_at": r.contact_shared_at.isoformat() + "+00:00" if r.contact_shared_at else None,
            "blood_type": r.request_blood_type,
            "units_needed": r.units_needed,
            "urgency": r.urgency,
            "request_status": r.request_status,
            "requester_name": r.requester_name,
            "requester_email": r.requester_email if show_contact else None,
            "requester_phone": r.requester_phone if show_contact else None,
            "distance_km": round(r.distance_m / 1000, 1) if r.distance_m else None,
            "message_count": r.message_count or 0,
        }
        if r.response in ("pending", "accepted_by_requester"):
            pending.append(entry)
        else:
            history.append(entry)

    accepted_count = sum(1 for r in rows if r.response in ("donor_confirmed", "contact_shared"))
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
            "lives_potentially_saved": accepted_count,
        },
    }


@router.post("/{donor_id}/block")
def block_requester(
    donor_id: uuid.UUID,
    payload: BlockCreate,
    db: Session = Depends(get_db),
):
    """Block a requester so their future requests are hidden from this donor."""
    donor = db.get(Donor, donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    existing = db.execute(
        select(Block).where(
            Block.donor_id == donor_id,
            Block.requester_id == payload.requester_id,
        )
    ).scalars().first()

    if existing:
        return {"message": "Already blocked"}

    block = Block(
        donor_id=donor_id,
        requester_id=payload.requester_id,
        reason=payload.reason,
    )
    db.add(block)
    db.commit()

    return {"message": "Requester blocked"}
