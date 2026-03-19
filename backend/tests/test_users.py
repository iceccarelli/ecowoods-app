"""
Tests for user management endpoints.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_users_as_admin(client: AsyncClient, auth_headers):
    """GET /api/v1/users/ as admin returns user list."""
    response = await client.get("/api/v1/users/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_users_as_regular_user(client: AsyncClient, user_headers):
    """GET /api/v1/users/ as non-admin returns 403."""
    response = await client.get("/api/v1/users/", headers=user_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_user_by_id(client: AsyncClient, auth_headers, admin_user):
    """GET /api/v1/users/{id} returns user details."""
    response = await client.get(f"/api/v1/users/{admin_user.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testadmin"


@pytest.mark.asyncio
async def test_update_user(client: AsyncClient, auth_headers, admin_user):
    """PUT /api/v1/users/{id} updates user info."""
    response = await client.put(
        f"/api/v1/users/{admin_user.id}",
        json={"full_name": "Updated Admin Name", "phone": "555-9999"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Admin Name"
    assert data["phone"] == "555-9999"


@pytest.mark.asyncio
async def test_get_nonexistent_user(client: AsyncClient, auth_headers):
    """GET /api/v1/users/99999 returns 404."""
    response = await client.get("/api/v1/users/99999", headers=auth_headers)
    assert response.status_code == 404
