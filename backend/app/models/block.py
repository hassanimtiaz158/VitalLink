"""Block model — allows donors to block/report requesters.

When a donor blocks a requester, that requester's future requests
are hidden from the donor's candidate list.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Block(Base):
    __tablename__ = "blocks"

    block_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # The donor who is blocking
    donor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donors.donor_id", ondelete="CASCADE"),
        nullable=False,
    )
    # The requester being blocked
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("requesters.requester_id", ondelete="CASCADE"),
        nullable=False,
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("donor_id", "requester_id", name="uq_block_donor_requester"),
    )

    def __repr__(self) -> str:
        return f"<Block donor={self.donor_id} requester={self.requester_id}>"
