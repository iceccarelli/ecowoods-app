"""
Pydantic schemas for Bid endpoints.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class BidCreate(BaseModel):
    job_request_id: int
    amount: float = Field(..., gt=0)
    currency: str = "CAD"
    timeframe: str | None = None
    pickup_date: str | None = None
    notes: str | None = None


class BidUpdate(BaseModel):
    amount: float | None = None
    currency: str | None = None
    timeframe: str | None = None
    pickup_date: str | None = None
    status: str | None = None
    notes: str | None = None


class BidResponse(BaseModel):
    id: int
    job_request_id: int
    bidder_id: int | None = None
    amount: float
    currency: str
    timeframe: str | None = None
    pickup_date: str | None = None
    status: str
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
