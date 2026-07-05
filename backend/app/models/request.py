"""Request model — blood shortage requests submitted by individuals.

State machine:
  open → donor_accepted → donor_confirmed → contact_shared → fulfilled → closed

Each request has a requester_id (the person needing blood) and is matched
to compatible donors via PostGIS proximity search.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Request(Base):
    __tablename__ = "requests"

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # FK to the requester who needs blood.
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("requesters.requester_id", ondelete="CASCADE"),
        nullable=False,
    )
    # ABO/Rh blood type — CHECK constraint enforced at DB level.
    blood_type: Mapped[str] = mapped_column(Text, nullable=False)
    # Number of units needed (1–10).
    units_needed: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Urgency level — critical, high, or routine.
    urgency: Mapped[str] = mapped_column(Text, nullable=False, default="high")
    # Request lifecycle status.
    status: Mapped[str] = mapped_column(Text, nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    requester: Mapped["Requester"] = relationship("Requester", back_populates="requests")
    matches: Mapped[list["Match"]] = relationship(
        "Match", back_populates="request", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "blood_type IN ('O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+')",
            name="ck_requests_blood_type",
        ),
        CheckConstraint("units_needed > 0", name="ck_requests_units_positive"),
        CheckConstraint(
            "urgency IN ('critical', 'high', 'routine')",
            name="ck_requests_urgency",
        ),
        CheckConstraint(
            "status IN ('open', 'donor_accepted', 'donor_confirmed', 'contact_shared', 'fulfilled', 'closed')",
            name="ck_requests_status",
        ),
    )

    def __repr__(self) -> str:
        return f"<Request {self.blood_type} ({self.urgency})>"
