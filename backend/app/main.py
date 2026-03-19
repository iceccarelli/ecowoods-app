"""
EcoWoods API - Main application entry point.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base
from app.core.security import get_password_hash
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.job_requests import router as job_requests_router
from app.api.bids import router as bids_router
from app.api.calendar_events import router as calendar_router

# Import all models so they are registered with Base.metadata
from app.models.user import User  # noqa: F401
from app.models.job_request import JobRequest  # noqa: F401
from app.models.bid import Bid  # noqa: F401
from app.models.calendar_event import CalendarEvent  # noqa: F401

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_default_admin(engine_ref):
    """Create a default admin user if none exists."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from sqlalchemy import select

    session_factory = async_sessionmaker(engine_ref, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        result = await session.execute(select(User).where(User.is_admin == True))  # noqa: E712
        admin = result.scalar_one_or_none()
        if not admin:
            admin_user = User(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                email="admin@ecowoods.ca",
                full_name="EcoWoods Admin",
                is_admin=True,
                is_active=True,
            )
            session.add(admin_user)
            await session.commit()
            logger.info("Default admin user created (username: admin, password: admin123)")
        else:
            logger.info("Admin user already exists, skipping creation")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: create tables and seed data on startup."""
    logger.info("Starting EcoWoods API...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    await create_default_admin(engine)

    yield

    logger.info("Shutting down EcoWoods API...")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="REST API for EcoWoods Hardwood Flooring - Job Requests, Bids, and Calendar Management",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(job_requests_router, prefix="/api/v1")
app.include_router(bids_router, prefix="/api/v1")
app.include_router(calendar_router, prefix="/api/v1")

# Serve admin dashboard static files
# Try multiple possible locations for the admin dashboard
DASHBOARD_PATHS = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "admin-dashboard"),  # /app/admin-dashboard
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "admin-dashboard"),  # parent
    "/app/admin-dashboard",  # Docker absolute path
]

for dash_path in DASHBOARD_PATHS:
    if os.path.isdir(dash_path) and os.path.exists(os.path.join(dash_path, "index.html")):
        app.mount("/admin", StaticFiles(directory=dash_path, html=True), name="admin-dashboard")
        logger.info(f"Admin dashboard mounted from: {dash_path}")
        break
else:
    logger.warning("Admin dashboard directory not found, /admin will not be available")


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "admin_dashboard": "/admin/index.html",
        "api_prefix": "/api/v1",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": settings.APP_VERSION}
