import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, CheckConstraint, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        # Prevent the same donor being matched to the same request twice.
        UniqueConstraint("request_id", "donor_id", name="uq_match_request_donor"),
        CheckConstraint(
            "response IN ('pending','accepted','declined')",
            name="ck_matches_response",
        ),
    )

    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Each match ties to exactly one request; CASCADE removes matches when
    # the parent request is deleted.
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("requests.request_id", ondelete="CASCADE"),
        nullable=False,
    )
    # Each match ties to exactly one donor; CASCADE removes matches when
    # the parent donor is deleted.
    donor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donors.donor_id", ondelete="CASCADE"),
        nullable=False,
    )
    # Timestamp when the email notification was dispatched.
    notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Donor response — starts as 'pending' on match creation.
    response: Mapped[str] = mapped_column(Text, default="pending")

    # Relationships
    request: Mapped["Request"] = relationship(
        "Request", back_populates="matches"
    )
    donor: Mapped["Donor"] = relationship(
        "Donor", back_populates="matches"
    )

    def __repr__(self) -> str:
        return f"<Match {self.match_id} ({self.response})>"
