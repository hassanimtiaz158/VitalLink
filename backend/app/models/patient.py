"""Patient model — individuals who need blood and submit requests directly.

Minimal table storing only what the matching engine needs: location for
geo-proximity search and blood_type for display in the live dashboard.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Text, CheckConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (
        CheckConstraint(
            "blood_type IN ('O-','O+','A-','A+','B-','B+','AB-','AB+')",
            name="ck_patients_blood_type",
        ),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    blood_type: Mapped[str] = mapped_column(Text, nullable=False)
    # GEOGRAPHY(POINT, 4326) — patient's location for radius matching.
    location: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )
    email: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # One patient can submit many requests.
    requests: Mapped[list["Request"]] = relationship(
        "Request", back_populates="patient", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Patient {self.name} ({self.blood_type})>"
