"""Notification service for VitalLink.

Handles:
  - Signed JWT tokens for one-click donor response links.
  - Email dispatch via Resend free-tier API.
  - Fallback queue when rate limits are hit.
"""
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
import resend
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.donor import Donor
from app.models.match import Match
from app.models.request import Request

logger = logging.getLogger(__name__)

# In-memory fallback queue for emails that failed due to rate limits.
_fallback_queue: list[dict] = []


# ---------------------------------------------------------------------------
# JWT token helpers
# ---------------------------------------------------------------------------

def sign_response_token(match_id: UUID) -> str:
    """Create a short-lived JWT encoding the match_id."""
    payload = {
        "match_id": str(match_id),
        "exp": datetime.now(timezone.utc)
        + timedelta(days=settings.RESPONSE_TOKEN_EXPIRY_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(
        payload,
        settings.RESPONSE_TOKEN_SECRET,
        algorithm="HS256",
    )


def verify_response_token(token: str) -> UUID | None:
    """Decode and verify a response token."""
    try:
        payload = jwt.decode(
            token,
            settings.RESPONSE_TOKEN_SECRET,
            algorithms=["HS256"],
        )
        return UUID(payload["match_id"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Email composition
# ---------------------------------------------------------------------------

def _build_response_url(match_id: UUID) -> str:
    """Build the full one-click response URL with signed token."""
    token = sign_response_token(match_id)
    return f"{settings.BASE_URL}/api/matches/{match_id}/respond?token={token}"


def _build_donor_notification_html(
    donor_name: str,
    requester_name: str,
    blood_type: str,
    urgency: str,
    distance_km: float,
    response_url: str,
) -> str:
    """Build HTML email for a donor who was accepted by a requester."""
    urgency_color = {
        "critical": "#dc2626",
        "high": "#f59e0b",
        "routine": "#22c55e",
    }.get(urgency, "#6b7280")

    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B7F79;">VitalLink — You've Been Selected!</h2>
        <p>Hi {donor_name},</p>
        <p>
            <strong style="color: {urgency_color}; text-transform: uppercase;">
                {urgency}
            </strong>
            request from <strong>{requester_name}</strong>:
        </p>
        <ul>
            <li>Blood type needed: <strong>{blood_type}</strong></li>
            <li>Distance: <strong>{distance_km:.1f} km</strong></li>
        </ul>
        <p>Your blood type is a match. If you can donate, click below to confirm:</p>
        <a href="{response_url}"
           style="display: inline-block; padding: 14px 28px;
                  background: #1B7F79; color: #fff; text-decoration: none;
                  border-radius: 6px; font-weight: bold; font-size: 16px;">
            I'm In!
        </a>
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
            This link expires in {settings.RESPONSE_TOKEN_EXPIRY_DAYS} days.
            You are receiving this because you registered as a donor on VitalLink.
        </p>
    </body>
    </html>
    """


def _build_email_subject(requester_name: str, blood_type: str, urgency: str) -> str:
    """Build the email subject line."""
    return f"[VitalLink] {urgency.upper()}: {requester_name} needs {blood_type}"


# ---------------------------------------------------------------------------
# Resend dispatch
# ---------------------------------------------------------------------------

def _send_email(to: str, subject: str, html: str) -> bool:
    """Send a single email via Resend. Returns True on success."""
    if not settings.RESEND_API_KEY or settings.RESEND_API_KEY.startswith("re_xxx"):
        logger.warning("RESEND_API_KEY not configured — treating email to %s as sent (dev mode)", to)
        return True

    try:
        resend.Emails.send(
            {
                "from": settings.RESEND_FROM_EMAIL,
                "to": [to],
                "subject": subject,
                "html": html,
            }
        )
        return True
    except resend.errors.RateLimitError:
        logger.warning("Resend rate limit hit — queuing email for %s", to)
        return False
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def notify_accepted_donor(
    match: Match,
    donor: Donor,
    request: Request,
    requester_name: str,
    db: Session,
) -> dict:
    """Send notification email to a donor accepted by a requester.

    The email includes a one-click response link.
    Does NOT commit — caller should commit the session.
    """
    subject = _build_email_subject(requester_name, request.blood_type, request.urgency)

    # Calculate distance
    from sqlalchemy import func, select, cast
    from geoalchemy2 import Geometry
    from app.models.requester import Requester

    requester = db.get(Requester, request.requester_id)
    distance_km = 0.0
    if requester:
        distance_m = db.execute(
            select(func.ST_Distance(Donor.location, requester.location))
        ).scalar()
        distance_km = round(distance_m / 1000, 1) if distance_m else 0.0

    html = _build_donor_notification_html(
        donor_name=donor.name,
        requester_name=requester_name,
        blood_type=request.blood_type,
        urgency=request.urgency,
        distance_km=distance_km,
        response_url=_build_response_url(match.match_id),
    )

    success = _send_email(donor.email, subject, html)

    if success:
        match.notified_at = datetime.now(timezone.utc)
    else:
        _fallback_queue.append({
            "match_id": str(match.match_id),
            "donor_email": donor.email,
            "subject": subject,
            "html": html,
        })

    return {"sent": 1 if success else 0, "queued": 0 if success else 1}


def retry_fallback_queue(db: Session) -> dict:
    """Retry queued emails from the fallback queue."""
    if not _fallback_queue:
        return {"sent": 0, "remaining": 0}

    still_queued: list[dict] = []
    sent = 0

    for entry in _fallback_queue:
        success = _send_email(entry["donor_email"], entry["subject"], entry["html"])
        if success:
            match = db.get(Match, UUID(entry["match_id"]))
            if match:
                match.notified_at = datetime.now(timezone.utc)
            sent += 1
        else:
            still_queued.append(entry)

    _fallback_queue.clear()
    _fallback_queue.extend(still_queued)

    db.commit()
    return {"sent": sent, "remaining": len(_fallback_queue)}
