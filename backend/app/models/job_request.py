"""
JobRequest ORM model.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class JobRequest(Base):
    __tablename__ = "job_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="pending", nullable=False, index=True)

    # Services selected by the user
    services = Column(JSON, nullable=True)

    # Flooring details
    size = Column(String(50), nullable=True)
    wood_type = Column(String(100), nullable=True)
    width = Column(String(50), nullable=True)
    thickness = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    property_type = Column(String(100), nullable=True)
    home_levels = Column(String(100), nullable=True)
    demolition_required = Column(String(10), nullable=True)
    subfloor_type = Column(String(100), nullable=True)
    timeframe = Column(String(100), nullable=True)

    # Additional info
    additional_details = Column(Text, nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    contact_name = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user = relationship("User", backref="job_requests", lazy="selectin")
    bids = relationship("Bid", back_populates="job_request", lazy="selectin", cascade="all, delete-orphan")
