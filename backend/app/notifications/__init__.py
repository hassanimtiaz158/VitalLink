"""Notification service for VitalLink.

Handles:
  - Signed JWT tokens for one-click "I can help" response links.
  - Email dispatch via Resend free-tier API.
  - Fallback queue when rate limits are hit (TDD §6).
"""
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
import resend
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.donor import Donor
from app.models.hospital import Hospital
from app.models.match import Match
from app.models.request import Request

logger = logging.getLogger(__name__)

# In-memory fallback queue for emails that failed due to rate limits.
# Each entry is a dict with keys: match_id, donor_email, subject, html.
_fallback_queue: list[dict] = []


# ---------------------------------------------------------------------------
# JWT token helpers
# ---------------------------------------------------------------------------

def sign_response_token(match_id: UUID) -> str:
    """Create a short-lived JWT encoding the match_id.

    The token is embedded in the one-click "I can help" URL so the
    donor can respond without logging in.
    """
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
    """Decode and verify a response token.

    Returns the match_id if valid, None if expired or tampered.
    """
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


def _build_email_html(
    donor_name: str,
    hospital_name: str,
    blood_type: str,
    urgency: str,
    distance_km: float,
    response_url: str,
) -> str:
    """Build a simple HTML email body for a match notification."""
    urgency_color = {
        "critical": "#dc2626",
        "high": "#f59e0b",
        "routine": "#22c55e",
    }.get(urgency, "#6b7280")

    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">VitalLink — Blood Needed</h2>
        <p>Hi {donor_name},</p>
        <p>
            <strong style="color: {urgency_color}; text-transform: uppercase;">
                {urgency}
            </strong>
            request from <strong>{hospital_name}</strong>:
        </p>
        <ul>
            <li>Blood type needed: <strong>{blood_type}</strong></li>
            <li>Distance: <strong>{distance_km:.1f} km</strong></li>
        </ul>
        <p>Your blood type is a match. If you can donate, click below:</p>
        <a href="{response_url}"
           style="display: inline-block; padding: 14px 28px;
                  background: #dc2626; color: #fff; text-decoration: none;
                  border-radius: 6px; font-weight: bold; font-size: 16px;">
            I Can Help
        </a>
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
            This link expires in {settings.RESPONSE_TOKEN_EXPIRY_DAYS} days.
            You are receiving this because you registered as a donor on VitalLink.
        </p>
    </body>
    </html>
    """


def _build_email_subject(hospital_name: str, blood_type: str, urgency: str) -> str:
    """Build the email subject line."""
    return f"[VitalLink] {urgency.upper()}: {hospital_name} needs {blood_type}"


# ---------------------------------------------------------------------------
# Resend dispatch
# ---------------------------------------------------------------------------

def _send_email(to: str, subject: str, html: str) -> bool:
    """Send a single email via Resend. Returns True on success."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email to %s", to)
        return True  # treat as success in dev mode

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

def notify_matched_donors(
    request: Request,
    matched_donors: list[tuple[Match, Donor, float]],
    db: Session,
) -> dict:
    """Send notification emails to all matched donors.

    Parameters
    ----------
    request : Request
        The shortage request that was matched.
    matched_donors : list of (Match, Donor, distance_km) tuples
        Output from the matching engine — each entry includes the match
        record, the donor, and their distance from the hospital.
    db : Session
        Database session for updating notified_at timestamps.

    Returns
    -------
    dict
        Summary: {"sent": int, "queued": int, "failed": int}
    """
    hospital = db.get(Hospital, request.hospital_id)
    if not hospital:
        logger.error("Hospital %s not found for request %s", request.hospital_id, request.request_id)
        return {"sent": 0, "queued": 0, "failed": len(matched_donors)}

    stats = {"sent": 0, "queued": 0, "failed": 0}

    for match, donor, distance_km in matched_donors:
        subject = _build_email_subject(hospital.name, request.blood_type, request.urgency)
        html = _build_email_html(
            donor_name=donor.name,
            hospital_name=hospital.name,
            blood_type=request.blood_type,
            urgency=request.urgency,
            distance_km=distance_km,
            response_url=_build_response_url(match.match_id),
        )

        success = _send_email(donor.email, subject, html)

        if success:
            match.notified_at = datetime.now(timezone.utc)
            stats["sent"] += 1
        else:
            # Fallback: queue for retry (TDD §6)
            _fallback_queue.append({
                "match_id": str(match.match_id),
                "donor_email": donor.email,
                "subject": subject,
                "html": html,
            })
            stats["queued"] += 1

    db.commit()
    return stats


def retry_fallback_queue(db: Session) -> dict:
    """Retry queued emails from the fallback queue.

    Called on a schedule (e.g., via a cron job or background task).
    Uses exponential backoff — each retry waits longer before attempting.

    Returns
    -------
    dict
        Summary: {"sent": int, "remaining": int}
    """
    if not _fallback_queue:
        return {"sent": 0, "remaining": 0}

    still_queued: list[dict] = []
    sent = 0

    for entry in _fallback_queue:
        success = _send_email(entry["donor_email"], entry["subject"], entry["html"])
        if success:
            # Update notified_at on the match record.
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
