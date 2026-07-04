import uuid

from sqlalchemy import Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base


class Hospital(Base):
    __tablename__ = "hospitals"

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    # GEOGRAPHY(POINT, 4326) — WGS 84 lat/lng for PostGIS ST_DWithin queries.
    location: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )
    # Placeholder for future hospital verification workflow (TDD §11).
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # One hospital has many requests.
    requests: Mapped[list["Request"]] = relationship(
        "Request", back_populates="hospital", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Hospital {self.name}>"
