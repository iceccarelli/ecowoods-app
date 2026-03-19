"""
Tests for bid CRUD endpoints.
"""

import pytest
from httpx import AsyncClient


async def _create_job(client: AsyncClient, headers: dict) -> int:
    """Helper: create a job request and return its ID."""
    resp = await client.post(
        "/api/v1/job-requests/",
        json={"services": ["Hardwood Installation"], "size": "300"},
        headers=headers,
    )
    return resp.json()["id"]


BID_PAYLOAD = {
    "amount": 4500.00,
    "currency": "CAD",
    "timeframe": "2 weeks",
    "pickup_date": "2026-04-01",
    "notes": "Includes materials and labour",
}


@pytest.mark.asyncio
async def test_create_bid(client: AsyncClient, auth_headers):
    """POST /api/v1/bids/ creates a new bid."""
    job_id = await _create_job(client, auth_headers)
    payload = {**BID_PAYLOAD, "job_request_id": job_id}

    response = await client.post("/api/v1/bids/", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == 4500.00
    assert data["status"] == "submitted"
    assert data["job_request_id"] == job_id


@pytest.mark.asyncio
async def test_create_bid_invalid_amount(client: AsyncClient, auth_headers):
    """POST /api/v1/bids/ with amount <= 0 returns 422."""
    job_id = await _create_job(client, auth_headers)
    payload = {**BID_PAYLOAD, "job_request_id": job_id, "amount": -100}

    response = await client.post("/api/v1/bids/", json=payload, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_bids(client: AsyncClient, auth_headers):
    """GET /api/v1/bids/ returns bids list."""
    job_id = await _create_job(client, auth_headers)
    payload = {**BID_PAYLOAD, "job_request_id": job_id}
    await client.post("/api/v1/bids/", json=payload, headers=auth_headers)

    response = await client.get("/api/v1/bids/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_bids_by_job(client: AsyncClient, auth_headers):
    """GET /api/v1/bids/?job_request_id=X filters by job."""
    job_id = await _create_job(client, auth_headers)
    payload = {**BID_PAYLOAD, "job_request_id": job_id}
    await client.post("/api/v1/bids/", json=payload, headers=auth_headers)

    response = await client.get(f"/api/v1/bids/?job_request_id={job_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert all(b["job_request_id"] == job_id for b in data)


@pytest.mark.asyncio
async def test_get_bid_by_id(client: AsyncClient, auth_headers):
    """GET /api/v1/bids/{id} returns a single bid."""
    job_id = await _create_job(client, auth_headers)
    payload = {**BID_PAYLOAD, "job_request_id": job_id}
    create_resp = await client.post("/api/v1/bids/", json=payload, headers=auth_headers)
    bid_id = create_resp.json()["id"]

    response = await client.get(f"/api/v1/bids/{bid_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == bid_id


@pytest.mark.asyncio
async def test_update_bid(client: AsyncClient, auth_headers):
    """PUT /api/v1/bids/{id} updates the bid."""
    job_id = await _create_job(client, auth_headers)
    payload = {**BID_PAYLOAD, "job_request_id": job_id}
    create_resp = await client.post("/api/v1/bids/", json=payload, headers=auth_headers)
    bid_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/v1/bids/{bid_id}",
        json={"amount": 5000.00, "status": "accepted"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["amount"] == 5000.00
    assert data["status"] == "accepted"


@pytest.mark.asyncio
async def test_delete_bid(client: AsyncClient, auth_headers):
    """DELETE /api/v1/bids/{id} removes the bid."""
    job_id = await _create_job(client, auth_headers)
    payload = {**BID_PAYLOAD, "job_request_id": job_id}
    create_resp = await client.post("/api/v1/bids/", json=payload, headers=auth_headers)
    bid_id = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/bids/{bid_id}", headers=auth_headers)
    assert response.status_code == 204
