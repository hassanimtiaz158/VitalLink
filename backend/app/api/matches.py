import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.match import Match
from app.models.request import Request
from app.notifications import verify_response_token
from app.api.schemas import MatchResponse

router = APIRouter(prefix="/matches", tags=["matches"])


def _recompute_request_status(request: Request, db: Session) -> None:
    """Recompute request.status based on how many donors have accepted.

    Lifecycle transitions:
      - donors_notified → partially_fulfilled  (≥1 accepted, < units_needed)
      - donors_notified → fulfilled            (accepted ≥ units_needed)
      - partially_fulfilled → fulfilled        (accepted ≥ units_needed)
    """
    accepted_count: int = db.execute(
        select(func.count()).where(
            Match.request_id == request.request_id,
            Match.response == "accepted",
        )
    ).scalar()

    if accepted_count >= request.units_needed:
        request.status = "fulfilled"
    elif accepted_count > 0:
        request.status = "partially_fulfilled"


@router.get("/{match_id}/respond")
def respond_via_link(
    match_id: uuid.UUID,
    token: str = Query(...),
    response: str = Query(..., pattern=r"^(accepted|declined)$"),
):
    """One-click response endpoint hit by the "I can help" email link.

    Validates the signed JWT token, updates the match response, and
    recomputes the request status. Returns a simple HTML confirmation.
    """
    token_match_id = verify_response_token(token)
    if token_match_id is None or token_match_id != match_id:
        raise HTTPException(status_code=403, detail="Invalid or expired token")

    db: Session = next(get_db())
    try:
        match = db.get(Match, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")

        if match.response != "pending":
            raise HTTPException(
                status_code=409,
                detail=f"Match already responded with '{match.response}'",
            )

        match.response = response

        request = db.get(Request, match.request_id)
        if request:
            _recompute_request_status(request, db)

        db.commit()

        return {
            "status": "ok",
            "match_id": str(match.match_id),
            "response": match.response,
            "request_status": request.status if request else None,
        }
    finally:
        db.close()


@router.patch("/{match_id}/respond", response_model=MatchResponse)
def respond_to_match(
    match_id: uuid.UUID,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """API endpoint for donors to accept or decline a match.

    Validates the signed JWT token from query params, updates the match
    response, and auto-transitions request.status when enough donors
    have accepted.
    """
    token_match_id = verify_response_token(token)
    if token_match_id is None or token_match_id != match_id:
        raise HTTPException(status_code=403, detail="Invalid or expired token")

    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.response != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Match already responded with '{match.response}'",
        )

    match.response = "accepted"

    request = db.get(Request, match.request_id)
    if request:
        _recompute_request_status(request, db)

    db.commit()
    db.refresh(match)

    accepted_count: int = db.execute(
        select(func.count()).where(
            Match.request_id == match.request_id,
            Match.response == "accepted",
        )
    ).scalar()

    return MatchResponse(
        match_id=match.match_id,
        request_id=match.request_id,
        donor_id=match.donor_id,
        response=match.response,
        notified_at=match.notified_at,
        request_status=request.status if request else "unknown",
        accepted_count=accepted_count,
        units_needed=request.units_needed if request else 0,
    )
