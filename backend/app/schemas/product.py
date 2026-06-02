"""Pydantic schemas for Product endpoints."""

from datetime import datetime

from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    category: str = "flooring"
    image_url: str | None = None
    in_stock: bool = True


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = None
    category: str | None = None
    image_url: str | None = None
    in_stock: bool | None = None


class ProductResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    price: float
    category: str
    image_url: str | None = None
    in_stock: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    model_config = {"from_attributes": True}
