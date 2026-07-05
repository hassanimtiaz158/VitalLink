"""Request model — blood shortage requests submitted by hospitals or patients.

Lifecycle: open → donors_notified → partially_fulfilled → fulfilled → closed.
CHECK constraints enforce valid blood types, urgency levels, and status values
at the database level (mirrored in Pydantic schemas).

A request belongs to exactly one of: hospital (via hospital_id) or patient
(via patient_id). The requester_type column discriminates between the two.

Trust model (verified_by_hospital):
  Hospital requests are created with verified_by_hospital=True — the hospital
  staff have confirmed the need is real as part of clinical workflow.

  Patient requests are created with verified_by_hospital=False and a short
  verification_code. The patient enters this code (obtained from hospital
  staff during triage) to unlock the request. This prevents false or duplicate
  requests from wasting donor notifications — a critical safeguard because
  donors receive real email alerts and may rearrange their schedules.

  See migration 003_add_verification.sql for full rationale.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, CheckConstraint, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Request(Base):
    __tablename__ = "requests"
    __table_args__ = (
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
        CheckConstraint(
            "requester_type IN ('patient', 'hospital')",
            name="ck_requests_requester_type",
        ),
    )

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # FK to the hospital that created this request (nullable for patient requests).
    hospital_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.hospital_id", ondelete="RESTRICT"),
        nullable=True,
    )
    # FK to the patient who created this request (nullable for hospital requests).
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.patient_id", ondelete="RESTRICT"),
        nullable=True,
    )
    # Discriminator: 'hospital' or 'patient'.
    requester_type: Mapped[str] = mapped_column(Text, nullable=False, default="hospital")
    blood_type: Mapped[str] = mapped_column(Text, nullable=False)
    units_needed: Mapped[int] = mapped_column(Integer, nullable=False)
    # Determines match radius: critical=30km, high=15km, routine=8km.
    urgency: Mapped[str] = mapped_column(Text, nullable=False)
    # Trust verification — hospital requests start verified, patient requests
    # start unverified and require a short code from hospital staff.
    # See migration 003_add_verification.sql for rationale.
    verified_by_hospital: Mapped[bool] = mapped_column(default=False)
    verification_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Lifecycle state machine — transitions via application logic.
    status: Mapped[str] = mapped_column(Text, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    hospital: Mapped["Hospital | None"] = relationship(
        "Hospital", back_populates="requests"
    )
    patient: Mapped["Patient | None"] = relationship(
        "Patient", back_populates="requests"
    )
    matches: Mapped[list["Match"]] = relationship(
        "Match", back_populates="request", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Request {self.blood_type} x{self.units_needed} ({self.urgency})>"
