"""Requester model — individuals who need blood for themselves or a loved one.

Replaces the hospital entity. Requesters submit requests and review
matched donors before accepting them.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base


class Requester(Base):
    __tablename__ = "requesters"

    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    # GEOGRAPHY(POINT, 4326) — PostGIS point for location.
    location: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # A requester can have many requests.
    requests: Mapped[list["Request"]] = relationship(
        "Request", back_populates="requester", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Requester {self.name}>"
