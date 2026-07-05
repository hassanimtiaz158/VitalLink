"""Hospital registration endpoint.

POST /hospitals — Register a healthcare facility with geolocation.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, cast
from sqlalchemy.orm import Session
from geoalchemy2 import Geometry

from app.core.database import get_db
from app.models.hospital import Hospital
from app.api.schemas import HospitalCreate, HospitalResponse

router = APIRouter(prefix="/hospitals", tags=["hospitals"])


def _hospital_to_response(hospital: Hospital, db: Session) -> HospitalResponse:
    """Convert a Hospital ORM object to a HospitalResponse, extracting lat/lng
    from the PostGIS GEOGRAPHY column via ST_Y / ST_X."""
    lat, lng = db.execute(
        select(func.ST_Y(cast(hospital.location, Geometry)), func.ST_X(cast(hospital.location, Geometry)))
    ).one()

    return HospitalResponse(
        hospital_id=hospital.hospital_id,
        name=hospital.name,
        latitude=lat,
        longitude=lng,
        verified=hospital.verified,
    )


@router.post("", response_model=HospitalResponse, status_code=201)
def register_hospital(payload: HospitalCreate, db: Session = Depends(get_db)):
    """Register a new hospital. Location is stored as a PostGIS GEOGRAPHY point."""
    point = func.ST_SetSRID(
        func.ST_MakePoint(payload.longitude, payload.latitude), 4326
    )

    hospital = Hospital(
        name=payload.name,
        location=point,
        verified=payload.verified,
    )
    db.add(hospital)
    db.commit()
    db.refresh(hospital)

    return _hospital_to_response(hospital, db)
