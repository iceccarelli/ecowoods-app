"""
Pydantic schemas for CalendarEvent endpoints.
"""

from datetime import datetime

from pydantic import BaseModel


class CalendarEventCreate(BaseModel):
    title: str
    description: str | None = None
    start_date: str
    end_date: str | None = None
    event_type: str = "job"
    job_request_id: int | None = None


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    event_type: str | None = None
    job_request_id: int | None = None


class CalendarEventResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    start_date: str
    end_date: str | None = None
    event_type: str
    job_request_id: int | None = None
    created_by: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
