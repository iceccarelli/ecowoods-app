"""
Tests for calendar event CRUD endpoints.
"""

import pytest
from httpx import AsyncClient

EVENT_PAYLOAD = {
    "title": "Floor Installation - Smith Residence",
    "description": "Install oak hardwood in living room",
    "start_date": "2026-04-15",
    "end_date": "2026-04-17",
    "event_type": "job",
}


@pytest.mark.asyncio
async def test_create_event(client: AsyncClient, user_headers):
    """POST /api/v1/calendar/ creates a new event."""
    response = await client.post("/api/v1/calendar/", json=EVENT_PAYLOAD, headers=user_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == EVENT_PAYLOAD["title"]
    assert data["event_type"] == "job"
    assert data["start_date"] == "2026-04-15"


@pytest.mark.asyncio
async def test_create_event_unauthenticated(client: AsyncClient):
    """POST /api/v1/calendar/ without auth returns 401."""
    response = await client.post("/api/v1/calendar/", json=EVENT_PAYLOAD)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_events(client: AsyncClient, user_headers):
    """GET /api/v1/calendar/ returns events list."""
    await client.post("/api/v1/calendar/", json=EVENT_PAYLOAD, headers=user_headers)
    response = await client.get("/api/v1/calendar/", headers=user_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_events_date_filter(client: AsyncClient, user_headers):
    """GET /api/v1/calendar/?start_date=X&end_date=Y filters by date."""
    await client.post("/api/v1/calendar/", json=EVENT_PAYLOAD, headers=user_headers)
    response = await client.get(
        "/api/v1/calendar/?start_date=2026-04-01&end_date=2026-04-30",
        headers=user_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_event_by_id(client: AsyncClient, user_headers):
    """GET /api/v1/calendar/{id} returns a single event."""
    create_resp = await client.post("/api/v1/calendar/", json=EVENT_PAYLOAD, headers=user_headers)
    event_id = create_resp.json()["id"]

    response = await client.get(f"/api/v1/calendar/{event_id}", headers=user_headers)
    assert response.status_code == 200
    assert response.json()["id"] == event_id


@pytest.mark.asyncio
async def test_update_event(client: AsyncClient, user_headers):
    """PUT /api/v1/calendar/{id} updates the event."""
    create_resp = await client.post("/api/v1/calendar/", json=EVENT_PAYLOAD, headers=user_headers)
    event_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/v1/calendar/{event_id}",
        json={"title": "Updated Title", "event_type": "deadline"},
        headers=user_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["event_type"] == "deadline"


@pytest.mark.asyncio
async def test_delete_event(client: AsyncClient, user_headers):
    """DELETE /api/v1/calendar/{id} removes the event."""
    create_resp = await client.post("/api/v1/calendar/", json=EVENT_PAYLOAD, headers=user_headers)
    event_id = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/calendar/{event_id}", headers=user_headers)
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_get_nonexistent_event(client: AsyncClient, user_headers):
    """GET /api/v1/calendar/99999 returns 404."""
    response = await client.get("/api/v1/calendar/99999", headers=user_headers)
    assert response.status_code == 404
