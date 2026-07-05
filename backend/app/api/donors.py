"""Donor registration and availability endpoints.

POST   /donors              — Register a new donor with geolocation.
PATCH  /donors/{id}/availability — Toggle availability flag.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, cast
from sqlalchemy.orm import Session
from geoalchemy2 import Geometry

from app.core.database import get_db
from app.models.donor import Donor
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
