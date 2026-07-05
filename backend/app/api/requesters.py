"""Requester endpoints — registration and profile.

POST   /requesters              — Register a new requester.
GET    /requesters/{id}         — Get requester profile.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, cast
from sqlalchemy.orm import Session
from geoalchemy2 import Geometry

from app.core.database import get_db
from app.models.requester import Requester
from app.api.schemas import RequesterCreate, RequesterResponse

router = APIRouter(prefix="/requesters", tags=["requesters"])


def _requester_to_response(requester: Requester, db: Session) -> RequesterResponse:
    """Convert a Requester ORM object to a RequesterResponse."""
    lat, lng = db.execute(
        select(
            func.ST_Y(cast(requester.location, Geometry)),
            func.ST_X(cast(requester.location, Geometry)),
        )
    ).one()

    return RequesterResponse(
        requester_id=requester.requester_id,
        name=requester.name,
        email=requester.email,
        phone=requester.phone,
        latitude=lat,
        longitude=lng,
        created_at=requester.created_at,
    )


@router.post("", response_model=RequesterResponse, status_code=201)
def register_requester(payload: RequesterCreate, db: Session = Depends(get_db)):
    """Register a new requester (person needing blood)."""
    point = func.ST_SetSRID(
        func.ST_MakePoint(payload.longitude, payload.latitude), 4326
    )

    requester = Requester(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        location=point,
    )
    db.add(requester)
    db.commit()
    db.refresh(requester)

    return _requester_to_response(requester, db)


@router.get("/{requester_id}", response_model=RequesterResponse)
def get_requester(requester_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get a requester's profile by ID."""
    requester = db.get(Requester, requester_id)
    if not requester:
        raise HTTPException(status_code=404, detail="Requester not found")
    return _requester_to_response(requester, db)
