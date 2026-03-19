"""
Bid ORM model.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_request_id = Column(
        Integer, ForeignKey("job_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bidder_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="CAD", nullable=False)
    timeframe = Column(String(100), nullable=True)
    pickup_date = Column(String(50), nullable=True)
    status = Column(String(50), default="submitted", nullable=False, index=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    job_request = relationship("JobRequest", back_populates="bids", lazy="selectin")
    bidder = relationship("User", backref="bids", lazy="selectin")
