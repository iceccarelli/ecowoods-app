"""
Tests for security utilities: password hashing and JWT tokens.
"""

from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)


def test_password_hash_and_verify():
    """Hashing and verifying a password works correctly."""
    raw = "my_secure_password"
    hashed = get_password_hash(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True


def test_password_verify_wrong():
    """Wrong password does not verify."""
    hashed = get_password_hash("correct")
    assert verify_password("wrong", hashed) is False


def test_create_and_decode_token():
    """JWT round-trip: create then decode."""
    payload = {"sub": "42", "role": "admin"}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "42"
    assert decoded["role"] == "admin"
    assert "exp" in decoded


def test_decode_invalid_token():
    """Invalid token returns None."""
    result = decode_access_token("this.is.not.a.valid.jwt")
    assert result is None


def test_decode_tampered_token():
    """Tampered token returns None."""
    token = create_access_token({"sub": "1"})
    tampered = token[:-5] + "XXXXX"
    result = decode_access_token(tampered)
    assert result is None
