"""
CalendarEvent ORM model.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(String(50), nullable=False)
    end_date = Column(String(50), nullable=True)
    event_type = Column(String(50), default="job", nullable=False)

    # Link to job request (optional)
    job_request_id = Column(
        Integer, ForeignKey("job_requests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Creator
    created_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    job_request = relationship("JobRequest", backref="calendar_events", lazy="selectin")
    creator = relationship("User", backref="calendar_events", lazy="selectin")
