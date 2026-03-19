"""
Pydantic schemas for JobRequest endpoints.
"""

from datetime import datetime

from pydantic import BaseModel


class JobRequestCreate(BaseModel):
    services: list[str] | None = None
    size: str | None = None
    wood_type: str | None = None
    width: str | None = None
    thickness: str | None = None
    color: str | None = None
    property_type: str | None = None
    home_levels: str | None = None
    demolition_required: str | None = None
    subfloor_type: str | None = None
    timeframe: str | None = None
    additional_details: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    contact_name: str | None = None


class JobRequestUpdate(BaseModel):
    status: str | None = None
    services: list[str] | None = None
    size: str | None = None
    wood_type: str | None = None
    width: str | None = None
    thickness: str | None = None
    color: str | None = None
    property_type: str | None = None
    home_levels: str | None = None
    demolition_required: str | None = None
    subfloor_type: str | None = None
    timeframe: str | None = None
    additional_details: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    contact_name: str | None = None


class JobRequestResponse(BaseModel):
    id: int
    user_id: int
    status: str
    services: list[str] | None = None
    size: str | None = None
    wood_type: str | None = None
    width: str | None = None
    thickness: str | None = None
    color: str | None = None
    property_type: str | None = None
    home_levels: str | None = None
    demolition_required: str | None = None
    subfloor_type: str | None = None
    timeframe: str | None = None
    additional_details: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    contact_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
