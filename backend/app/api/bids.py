"""
Bid CRUD endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_admin
from app.models.user import User
from app.models.bid import Bid
from app.models.job_request import JobRequest
from app.schemas.bid import BidCreate, BidUpdate, BidResponse

router = APIRouter(prefix="/bids", tags=["Bids"])


@router.post("/", response_model=BidResponse, status_code=status.HTTP_201_CREATED)
async def create_bid(
    data: BidCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new bid on a job request."""
    # Verify job request exists
    result = await db.execute(select(JobRequest).where(JobRequest.id == data.job_request_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job request not found",
        )

    bid = Bid(
        job_request_id=data.job_request_id,
        bidder_id=current_user.id,
        amount=data.amount,
        currency=data.currency,
        timeframe=data.timeframe,
        pickup_date=data.pickup_date,
        notes=data.notes,
    )
    db.add(bid)
    await db.flush()
    await db.refresh(bid)
    return bid


@router.get("/", response_model=List[BidResponse])
async def list_bids(
    job_request_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List bids.
    - Filter by job_request_id if provided.
    - Admins see all bids; regular users see bids on their own job requests or their own bids.
    """
    query = select(Bid).order_by(Bid.created_at.desc())

    if job_request_id:
        query = query.where(Bid.job_request_id == job_request_id)

    if not current_user.is_admin:
        # Users can see bids they made or bids on their jobs
        query = query.join(JobRequest, Bid.job_request_id == JobRequest.id).where(
            (Bid.bidder_id == current_user.id) | (JobRequest.user_id == current_user.id)
        )

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{bid_id}", response_model=BidResponse)
async def get_bid(
    bid_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single bid by ID."""
    result = await db.execute(select(Bid).where(Bid.id == bid_id))
    bid = result.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bid not found")
    return bid


@router.put("/{bid_id}", response_model=BidResponse)
async def update_bid(
    bid_id: int,
    data: BidUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a bid."""
    result = await db.execute(select(Bid).where(Bid.id == bid_id))
    bid = result.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bid not found")

    if bid.bidder_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bid, field, value)

    await db.flush()
    await db.refresh(bid)
    return bid


@router.delete("/{bid_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bid(
    bid_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a bid."""
    result = await db.execute(select(Bid).where(Bid.id == bid_id))
    bid = result.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bid not found")

    if bid.bidder_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(bid)
    await db.flush()
