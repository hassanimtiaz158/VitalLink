"""Match model — links a request to a specific donor with response tracking.

State flow:
  pending → accepted_by_requester → donor_confirmed → contact_shared

Once both sides confirm, contact info is revealed and chat is enabled.
"""
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Match(Base):
    __tablename__ = "matches"

    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("requests.request_id", ondelete="CASCADE"),
        nullable=False,
    )
    donor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donors.donor_id", ondelete="CASCADE"),
        nullable=False,
    )
    # Response status — tracks the negotiation state.
    response: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    # Timestamps for audit trail.
    notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    contact_shared_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    request: Mapped["Request"] = relationship("Request", back_populates="matches")
    donor: Mapped["Donor"] = relationship("Donor", back_populates="matches")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="match", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "response IN ('pending', 'accepted_by_requester', 'donor_confirmed', 'contact_shared', 'declined')",
            name="ck_matches_response",
        ),
    )

    def __repr__(self) -> str:
        return f"<Match {self.match_id} response={self.response}>"
