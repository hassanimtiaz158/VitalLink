import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.hospital import Hospital
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
