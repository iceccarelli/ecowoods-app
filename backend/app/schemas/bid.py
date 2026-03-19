"""
Pydantic schemas for Bid endpoints.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BidCreate(BaseModel):
    job_request_id: int
    amount: float = Field(..., gt=0)
    currency: str = "CAD"
    timeframe: Optional[str] = None
    pickup_date: Optional[str] = None
    notes: Optional[str] = None


class BidUpdate(BaseModel):
    amount: Optional[float] = None
    currency: Optional[str] = None
    timeframe: Optional[str] = None
    pickup_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class BidResponse(BaseModel):
    id: int
    job_request_id: int
    bidder_id: Optional[int] = None
    amount: float
    currency: str
    timeframe: Optional[str] = None
    pickup_date: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
