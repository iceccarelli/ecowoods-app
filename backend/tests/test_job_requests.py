"""
Tests for job request CRUD endpoints.
"""

import pytest
from httpx import AsyncClient

JOB_PAYLOAD = {
    "services": ["Hardwood Installation", "Hardwood Refinishing"],
    "size": "500",
    "wood_type": "Oak",
    "width": '5"',
    "thickness": '3/4"',
    "color": "Natural",
    "property_type": "House",
    "home_levels": "Single Level",
    "demolition_required": "No",
    "subfloor_type": "Plywood",
    "timeframe": "Within 2 weeks",
    "additional_details": "Living room and hallway",
    "contact_name": "Test User",
    "contact_email": "test@example.com",
    "contact_phone": "555-0100",
}


@pytest.mark.asyncio
async def test_create_job_request(client: AsyncClient, user_headers):
    """POST /api/v1/job-requests creates a new job request."""
    response = await client.post("/api/v1/job-requests/", json=JOB_PAYLOAD, headers=user_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["wood_type"] == "Oak"
    assert "Hardwood Installation" in data["services"]
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_create_job_request_unauthenticated(client: AsyncClient):
    """POST /api/v1/job-requests without auth returns 401."""
    response = await client.post("/api/v1/job-requests/", json=JOB_PAYLOAD)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_job_requests(client: AsyncClient, user_headers):
    """GET /api/v1/job-requests/ returns user's job requests."""
    # Create one first
    await client.post("/api/v1/job-requests/", json=JOB_PAYLOAD, headers=user_headers)
    response = await client.get("/api/v1/job-requests/", headers=user_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_job_request_by_id(client: AsyncClient, user_headers):
    """GET /api/v1/job-requests/{id} returns a single job request."""
    create_resp = await client.post("/api/v1/job-requests/", json=JOB_PAYLOAD, headers=user_headers)
    job_id = create_resp.json()["id"]

    response = await client.get(f"/api/v1/job-requests/{job_id}", headers=user_headers)
    assert response.status_code == 200
    assert response.json()["id"] == job_id


@pytest.mark.asyncio
async def test_get_nonexistent_job_request(client: AsyncClient, user_headers):
    """GET /api/v1/job-requests/99999 returns 404."""
    response = await client.get("/api/v1/job-requests/99999", headers=user_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_job_request(client: AsyncClient, auth_headers):
    """PUT /api/v1/job-requests/{id} updates the job request."""
    create_resp = await client.post("/api/v1/job-requests/", json=JOB_PAYLOAD, headers=auth_headers)
    job_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/v1/job-requests/{job_id}",
        json={"status": "estimated", "wood_type": "Maple"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "estimated"
    assert data["wood_type"] == "Maple"


@pytest.mark.asyncio
async def test_delete_job_request(client: AsyncClient, auth_headers):
    """DELETE /api/v1/job-requests/{id} removes the job request."""
    create_resp = await client.post("/api/v1/job-requests/", json=JOB_PAYLOAD, headers=auth_headers)
    job_id = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/job-requests/{job_id}", headers=auth_headers)
    assert response.status_code == 204

    # Confirm it's gone
    get_resp = await client.get(f"/api/v1/job-requests/{job_id}", headers=auth_headers)
    assert get_resp.status_code == 404
