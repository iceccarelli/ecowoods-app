"""
Pydantic schemas for JobRequest endpoints.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class JobRequestCreate(BaseModel):
    services: Optional[List[str]] = None
    size: Optional[str] = None
    wood_type: Optional[str] = None
    width: Optional[str] = None
    thickness: Optional[str] = None
    color: Optional[str] = None
    property_type: Optional[str] = None
    home_levels: Optional[str] = None
    demolition_required: Optional[str] = None
    subfloor_type: Optional[str] = None
    timeframe: Optional[str] = None
    additional_details: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_name: Optional[str] = None


class JobRequestUpdate(BaseModel):
    status: Optional[str] = None
    services: Optional[List[str]] = None
    size: Optional[str] = None
    wood_type: Optional[str] = None
    width: Optional[str] = None
    thickness: Optional[str] = None
    color: Optional[str] = None
    property_type: Optional[str] = None
    home_levels: Optional[str] = None
    demolition_required: Optional[str] = None
    subfloor_type: Optional[str] = None
    timeframe: Optional[str] = None
    additional_details: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_name: Optional[str] = None


class JobRequestResponse(BaseModel):
    id: int
    user_id: int
    status: str
    services: Optional[List[str]] = None
    size: Optional[str] = None
    wood_type: Optional[str] = None
    width: Optional[str] = None
    thickness: Optional[str] = None
    color: Optional[str] = None
    property_type: Optional[str] = None
    home_levels: Optional[str] = None
    demolition_required: Optional[str] = None
    subfloor_type: Optional[str] = None
    timeframe: Optional[str] = None
    additional_details: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
