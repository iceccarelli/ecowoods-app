"""
Tests for authentication endpoints: register, login, me.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """POST /api/v1/auth/register creates a new user."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "newuser",
            "password": "securepass123",
            "email": "new@example.com",
            "full_name": "New User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "newuser"
    assert data["email"] == "new@example.com"
    assert data["is_active"] is True
    assert data["is_admin"] is False


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient, regular_user):
    """POST /api/v1/auth/register with existing username returns 400."""
    response = await client.post(
        "/api/v1/auth/register",
        json={"username": "testuser", "password": "anotherpass"},
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, regular_user):
    """POST /api/v1/auth/login returns a JWT token."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "userpass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "testuser"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, regular_user):
    """POST /api/v1/auth/login with wrong password returns 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """POST /api/v1/auth/login with unknown user returns 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "ghost", "password": "nopass"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, user_headers):
    """GET /api/v1/auth/me returns current user info."""
    response = await client.get("/api/v1/auth/me", headers=user_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    """GET /api/v1/auth/me without token returns 401."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
