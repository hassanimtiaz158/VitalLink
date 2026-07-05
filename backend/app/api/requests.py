"""Shortage request endpoints — the core of the matching workflow.

POST /requests          — Submit a shortage request (hospital or patient) and auto-match donors.
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
from app.models.patient import Patient
from app.models.donor import Donor
from app.models.request import Request
from app.models.match import Match
from app.matching_engine import find_matches
from app.api.schemas import (
    RequestCreate,
    RequestResponse,
    PatientCreate,
    PatientResponse,
)

router = APIRouter(prefix="/requests", tags=["requests"])


# ---------------------------------------------------------------------------
# Patient registration (needed for patient request path)
# ---------------------------------------------------------------------------
@router.post("/patients", response_model=PatientResponse, status_code=201)
def register_patient(payload: PatientCreate, db: Session = Depends(get_db)):
    """Register a patient who needs blood. Location is stored as PostGIS GEOGRAPHY."""
    from sqlalchemy import func as sqlfunc

    point = sqlfunc.ST_SetSRID(
        sqlfunc.ST_MakePoint(payload.longitude, payload.latitude), 4326
    )

    patient = Patient(
        name=payload.name,
        blood_type=payload.blood_type,
        email=payload.email,
        location=point,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    lat, lng = db.execute(
        select(
            func.ST_Y(cast(patient.location, Geometry)),
            func.ST_X(cast(patient.location, Geometry)),
        )
    ).one()

    return PatientResponse(
        patient_id=patient.patient_id,
        name=patient.name,
        blood_type=patient.blood_type,
        email=patient.email,
        latitude=lat,
        longitude=lng,
        created_at=patient.created_at,
    )


# ---------------------------------------------------------------------------
# Create request (hospital or patient — same matching logic)
# ---------------------------------------------------------------------------
@router.post("", response_model=RequestResponse, status_code=201)
def create_request(payload: RequestCreate, db: Session = Depends(get_db)):
    """Create a shortage request and automatically match compatible donors.

    Accepts either hospital_id or patient_id. The matching engine resolves
    the origin location from the appropriate entity and runs the same
    find_matches() query regardless of requester type.

    1. Validates the hospital or patient exists.
    2. Inserts the request with status='open'.
    3. Runs find_matches() to query compatible, nearby, available donors.
    4. Inserts a Match row (response='pending') for each matched donor.
    5. Transitions request status to 'donors_notified' if matches were found.
    6. Returns the request with the matched donor count.
    """
    request = Request(
        hospital_id=payload.hospital_id,
        patient_id=payload.patient_id,
        requester_type=payload.requester_type,
        blood_type=payload.blood_type,
        units_needed=payload.units_needed,
        urgency=payload.urgency,
        status="open",
    )

    # Validate the owner exists
    if payload.requester_type == "hospital":
        hospital = db.get(Hospital, payload.hospital_id)
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
    else:
        patient = db.get(Patient, payload.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

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
        requester_type=request.requester_type,
        hospital_id=request.hospital_id,
        patient_id=request.patient_id,
        blood_type=request.blood_type,
        units_needed=request.units_needed,
        urgency=request.urgency,
        status=request.status,
        created_at=request.created_at,
        matched_donors=len(donors),
    )


# ---------------------------------------------------------------------------
# Active requests feed
# ---------------------------------------------------------------------------
@router.get("/active")
def get_active_requests(db: Session = Depends(get_db)):
    """Public feed of non-closed requests for the live dashboard.

    Returns hospital name (for hospital requests) or patient name (for
    patient requests), approximate locations, and match counts.
    """
    # Hospital requests
    hospital_rows = (
        db.execute(
            select(
                Request.request_id,
                Request.blood_type,
                Request.units_needed,
                Request.urgency,
                Request.status,
                Request.requester_type,
                Request.created_at,
                Hospital.name.label("source_name"),
                func.ST_Y(cast(Hospital.location, Geometry)).label("latitude"),
                func.ST_X(cast(Hospital.location, Geometry)).label("longitude"),
                func.count(Match.match_id).label("match_count"),
                func.coalesce(
                    func.sum(cast(Match.response == "accepted", Integer)),
                    0,
                ).label("accepted_count"),
            )
            .join(Hospital, Request.hospital_id == Hospital.hospital_id)
            .outerjoin(Match, Request.request_id == Match.request_id)
            .where(Request.status != "closed", Request.requester_type == "hospital")
            .group_by(
                Request.request_id,
                Request.blood_type,
                Request.units_needed,
                Request.urgency,
                Request.status,
                Request.requester_type,
                Request.created_at,
                Hospital.name,
                Hospital.location,
            )
            .order_by(Request.created_at.desc())
        )
        .all()
    )

    # Patient requests
    patient_rows = (
        db.execute(
            select(
                Request.request_id,
                Request.blood_type,
                Request.units_needed,
                Request.urgency,
                Request.status,
                Request.requester_type,
                Request.created_at,
                Patient.name.label("source_name"),
                func.ST_Y(cast(Patient.location, Geometry)).label("latitude"),
                func.ST_X(cast(Patient.location, Geometry)).label("longitude"),
                func.count(Match.match_id).label("match_count"),
                func.coalesce(
                    func.sum(cast(Match.response == "accepted", Integer)),
                    0,
                ).label("accepted_count"),
            )
            .join(Patient, Request.patient_id == Patient.patient_id)
            .outerjoin(Match, Request.request_id == Match.request_id)
            .where(Request.status != "closed", Request.requester_type == "patient")
            .group_by(
                Request.request_id,
                Request.blood_type,
                Request.units_needed,
                Request.urgency,
                Request.status,
                Request.requester_type,
                Request.created_at,
                Patient.name,
                Patient.location,
            )
            .order_by(Request.created_at.desc())
        )
        .all()
    )

    def row_to_dict(r) -> dict:
        return {
            "request_id": str(r.request_id),
            "requester_type": r.requester_type,
            "source_name": r.source_name,
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

    # Merge and sort by created_at descending
    all_rows = [row_to_dict(r) for r in hospital_rows] + [row_to_dict(r) for r in patient_rows]
    all_rows.sort(key=lambda x: x["created_at"] or "", reverse=True)

    return all_rows


# ---------------------------------------------------------------------------
# Request matches detail
# ---------------------------------------------------------------------------
@router.get("/{request_id}/matches")
def get_request_matches(request_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return a request with its matched donors, including donor info and distance."""
    request = db.get(Request, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Resolve origin location for distance calculation
    if request.requester_type == "hospital":
        origin = db.get(Hospital, request.hospital_id).location
    else:
        origin = db.get(Patient, request.patient_id).location

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
                func.ST_Distance(Donor.location, origin).label("distance_m"),
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
        "requester_type": request.requester_type,
        "hospital_id": str(request.hospital_id) if request.hospital_id else None,
        "patient_id": str(request.patient_id) if request.patient_id else None,
        "blood_type": request.blood_type,
        "units_needed": request.units_needed,
        "urgency": request.urgency,
        "status": request.status,
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "matched_donors": len(matches),
        "matches": matches,
    }


# ---------------------------------------------------------------------------
# Supply stats
# ---------------------------------------------------------------------------
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
