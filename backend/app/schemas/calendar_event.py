"""
Pydantic schemas for CalendarEvent endpoints.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    event_type: str = "job"
    job_request_id: Optional[int] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    event_type: Optional[str] = None
    job_request_id: Optional[int] = None


class CalendarEventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    event_type: str
    job_request_id: Optional[int] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
