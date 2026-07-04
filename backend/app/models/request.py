import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, CheckConstraint, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Request(Base):
    __tablename__ = "requests"
    __table_args__ = (
        # Prevents orphaned requests if a hospital is deleted.
        CheckConstraint(
            "blood_type IN ('O-','O+','A-','A+','B-','B+','AB-','AB+')",
            name="ck_requests_blood_type",
        ),
        CheckConstraint(
            "urgency IN ('critical','high','routine')",
            name="ck_requests_urgency",
        ),
        CheckConstraint(
            "status IN ('open','donors_notified','partially_fulfilled','fulfilled','closed')",
            name="ck_requests_status",
        ),
        CheckConstraint("units_needed > 0", name="ck_requests_units_positive"),
    )

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # FK to the hospital that created this request.
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.hospital_id", ondelete="RESTRICT"),
        nullable=False,
    )
    blood_type: Mapped[str] = mapped_column(Text, nullable=False)
    units_needed: Mapped[int] = mapped_column(Integer, nullable=False)
    # Determines match radius: critical=30km, high=15km, routine=8km.
    urgency: Mapped[str] = mapped_column(Text, nullable=False)
    # Lifecycle state machine — transitions via application logic.
    status: Mapped[str] = mapped_column(Text, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    hospital: Mapped["Hospital"] = relationship(
        "Hospital", back_populates="requests"
    )
    matches: Mapped[list["Match"]] = relationship(
        "Match", back_populates="request", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Request {self.blood_type} x{self.units_needed} ({self.urgency})>"
