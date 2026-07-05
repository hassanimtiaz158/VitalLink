"""Message model — in-app chat between requester and donor.

Scoped to a specific match. Once both parties confirm (contact_shared),
they can communicate directly in the app without exposing personal contact info.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.match_id", ondelete="CASCADE"),
        nullable=False,
    )
    # Sender type — 'requester' or 'donor'
    sender_type: Mapped[str] = mapped_column(Text, nullable=False)
    # Sender ID — either requester_id or donor_id
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Message body
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    match: Mapped["Match"] = relationship("Match", back_populates="messages")

    def __repr__(self) -> str:
        return f"<Message {self.sender_type}:{self.sender_id[:8]}>"
