"""
Job Request CRUD endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.job_request import JobRequest
from app.models.user import User
from app.schemas.job_request import JobRequestCreate, JobRequestResponse, JobRequestUpdate

router = APIRouter(prefix="/job-requests", tags=["Job Requests"])


@router.post("/", response_model=JobRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_job_request(
    data: JobRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new job request."""
    job = JobRequest(
        user_id=current_user.id,
        services=data.services,
        size=data.size,
        wood_type=data.wood_type,
        width=data.width,
        thickness=data.thickness,
        color=data.color,
        property_type=data.property_type,
        home_levels=data.home_levels,
        demolition_required=data.demolition_required,
        subfloor_type=data.subfloor_type,
        timeframe=data.timeframe,
        additional_details=data.additional_details,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        contact_name=data.contact_name,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


@router.get("/", response_model=list[JobRequestResponse])
async def list_job_requests(
    skip: int = 0,
    limit: int = 100,
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List job requests.
    - Regular users see only their own requests.
    - Admins see all requests.
    """
    query = select(JobRequest).order_by(JobRequest.created_at.desc())

    if not current_user.is_admin:
        query = query.where(JobRequest.user_id == current_user.id)

    if status_filter:
        query = query.where(JobRequest.status == status_filter)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{job_id}", response_model=JobRequestResponse)
async def get_job_request(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single job request by ID."""
    result = await db.execute(select(JobRequest).where(JobRequest.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job request not found")

    if job.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return job


@router.put("/{job_id}", response_model=JobRequestResponse)
async def update_job_request(
    job_id: int,
    data: JobRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a job request."""
    result = await db.execute(select(JobRequest).where(JobRequest.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job request not found")

    if job.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)

    await db.flush()
    await db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_request(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a job request."""
    result = await db.execute(select(JobRequest).where(JobRequest.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job request not found")

    if job.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(job)
    await db.flush()
