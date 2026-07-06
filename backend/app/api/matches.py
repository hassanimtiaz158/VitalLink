"""Match response endpoints — donor confirmation and chat.

PATCH  /matches/{id}/respond          — Donor confirms or declines.
GET    /matches/{id}/messages         — Get chat messages.
POST   /matches/{id}/messages         — Send a chat message.
POST   /matches/{id}/report           — Report/block a requester.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.match import Match
from app.models.request import Request
from app.models.message import Message
from app.models.block import Block
from app.api.schemas import MatchResponse, MessageCreate, MessageResponse, BlockCreate

router = APIRouter(prefix="/matches", tags=["matches"])


def _recompute_request_status(request: Request, db: Session) -> None:
    """Recompute request.status based on match states.

    State machine:
      open → donor_accepted → contact_shared → fulfilled → closed
    """
    accepted_count = db.execute(
        select(func.count()).where(
            Match.request_id == request.request_id,
            Match.response.in_(["accepted_by_requester", "contact_shared"]),
        )
    ).scalar()

    shared_count = db.execute(
        select(func.count()).where(
            Match.request_id == request.request_id,
            Match.response == "contact_shared",
        )
    ).scalar()

    if shared_count > 0:
        request.status = "contact_shared"
    elif accepted_count > 0:
        request.status = "donor_accepted"


# ---------------------------------------------------------------------------
# Donor confirms or declines
# ---------------------------------------------------------------------------
@router.patch("/{match_id}/respond")
def respond_to_match(
    match_id: uuid.UUID,
    response: str,
    db: Session = Depends(get_db),
):
    """Donor confirms or declines a match.

    When donor confirms:
      - Match response → 'donor_confirmed'
      - Request status → 'donor_confirmed'
      - If enough donors confirmed, contact info is revealed to both parties

    When donor declines:
      - Match response → 'declined'
      - Request status recomputed
    """
    if response not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="Response must be 'accepted' or 'declined'")

    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.response not in ("accepted_by_requester", "pending"):
        raise HTTPException(status_code=400, detail="Match already responded to")

    if response == "accepted":
        match.response = "contact_shared"
        match.confirmed_at = datetime.now(timezone.utc)
        match.contact_shared_at = datetime.now(timezone.utc)

        request = db.get(Request, match.request_id)
        request.status = "contact_shared"
    else:
        match.response = "declined"
        request = db.get(Request, match.request_id)
        _recompute_request_status(request, db)

    db.commit()
    db.refresh(match)

    return {
        "match_id": str(match.match_id),
        "response": match.response,
        "request_status": match.request.status if match.request else None,
    }


# ---------------------------------------------------------------------------
# Chat messages
# ---------------------------------------------------------------------------
@router.get("/{match_id}/messages", response_model=list[MessageResponse])
def get_messages(match_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get all messages for a match (chat thread)."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    messages = db.execute(
        select(Message)
        .where(Message.match_id == match_id)
        .order_by(Message.created_at.asc())
    ).scalars().all()

    return [
        MessageResponse(
            message_id=m.message_id,
            match_id=m.match_id,
            sender_type=m.sender_type,
            sender_id=m.sender_id,
            body=m.body,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post("/{match_id}/messages", response_model=MessageResponse, status_code=201)
def send_message(
    match_id: uuid.UUID,
    payload: MessageCreate,
    db: Session = Depends(get_db),
):
    """Send a message in a match chat.

    Only available after contact_shared status.
    """
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.response != "contact_shared":
        raise HTTPException(
            status_code=400,
            detail="Chat is only available after both parties confirm",
        )

    message = Message(
        match_id=match_id,
        sender_type=payload.sender_type,
        sender_id=payload.sender_id,
        body=payload.body,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    return MessageResponse(
        message_id=message.message_id,
        match_id=message.match_id,
        sender_type=message.sender_type,
        sender_id=message.sender_id,
        body=message.body,
        created_at=message.created_at,
    )


# ---------------------------------------------------------------------------
# Report / Block
# ---------------------------------------------------------------------------
@router.post("/{match_id}/report")
def report_match(
    match_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Donor reports a match/requester and blocks future requests from them."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    request = db.get(Request, match.request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Check if already blocked
    existing = db.execute(
        select(Block).where(
            Block.donor_id == match.donor_id,
            Block.requester_id == request.requester_id,
        )
    ).scalars().first()

    if existing:
        return {"message": "Already blocked"}

    block = Block(
        donor_id=match.donor_id,
        requester_id=request.requester_id,
        reason="Reported via match",
    )
    db.add(block)

    # Also decline this match
    match.response = "declined"

    db.commit()

    return {"message": "Requester blocked and match declined"}
