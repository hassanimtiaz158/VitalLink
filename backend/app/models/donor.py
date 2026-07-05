"""Donor model — registered blood donors with ABO/Rh type and geolocation.

GEOGRAPHY(POINT, 4326) is used for PostGIS ST_DWithin radius matching.
The `available` flag allows donors to opt out without deleting their record.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base


class Donor(Base):
    __tablename__ = "donors"

    donor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    # ABO/Rh blood type — CHECK constraint enforced at DB level.
    blood_type: Mapped[str] = mapped_column(Text, nullable=False)
    # GEOGRAPHY(POINT, 4326) — PostGIS point for radius matching.
    location: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )
    # When false, matching engine skips this donor entirely.
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    # Medical safety: prevents matching donors who recently donated.
    last_donation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # One donor can appear in many matches.
    matches: Mapped[list["Match"]] = relationship(
        "Match", back_populates="donor", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Donor {self.name} ({self.blood_type})>"
