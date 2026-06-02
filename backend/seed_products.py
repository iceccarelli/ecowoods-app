"""Seed hardwood products. Run: python seed_products.py"""

import asyncio
import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./ecowoods.db")
from app.core.database import Base, async_session_factory, engine
from app.models.product import Product

PRODUCTS = [
    (
        "White Oak Wide Plank - Natural",
        '7.5" wide-plank white oak, matte UV-cured finish.',
        9.50,
        "flooring",
        "https://picsum.photos/id/1015/600/400",
    ),
    (
        "White Oak Herringbone",
        "Classic herringbone white oak, engineered.",
        13.75,
        "flooring",
        "https://picsum.photos/id/1016/600/400",
    ),
    (
        "European Oak Engineered - Wire Brushed",
        "Wide-plank European oak, wire-brushed, click-lock.",
        11.25,
        "flooring",
        "https://picsum.photos/id/1018/600/400",
    ),
    (
        "American Walnut Engineered",
        "Rich American walnut, engineered core.",
        12.50,
        "flooring",
        "https://picsum.photos/id/1019/600/400",
    ),
    (
        "Maple Hardwood - Natural",
        'Bright solid maple, 3/4" thick.',
        7.95,
        "flooring",
        "https://picsum.photos/id/1020/600/400",
    ),
    (
        "Red Oak Solid - Gunstock",
        'Solid red oak, gunstock stain, 3.25" strip.',
        6.95,
        "flooring",
        "https://picsum.photos/id/1021/600/400",
    ),
    (
        "Hickory Wide Plank",
        "Character-grade hickory, scratch-resistant.",
        8.95,
        "flooring",
        "https://picsum.photos/id/1022/600/400",
    ),
    (
        "White Oak - Chevron",
        "On-trend chevron white oak, engineered.",
        14.50,
        "flooring",
        "https://picsum.photos/id/1024/600/400",
    ),
    (
        "Engineered Oak - Matte White Wash",
        "Light white-washed oak, Scandinavian look.",
        10.50,
        "flooring",
        "https://picsum.photos/id/1025/600/400",
    ),
    (
        "Professional Installation - Per Sq Ft",
        "Expert install. Free in-home measure.",
        3.50,
        "tools",
        "https://picsum.photos/id/1026/600/400",
    ),
    (
        "Sand & Refinish Service - Per Sq Ft",
        "Sanding, staining, 3-coat finish.",
        4.25,
        "tools",
        "https://picsum.photos/id/1027/600/400",
    ),
    (
        "Old Floor Removal & Disposal - Per Sq Ft",
        "Demolition and eco-disposal.",
        2.00,
        "tools",
        "https://picsum.photos/id/1028/600/400",
    ),
]


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session_factory() as s:
        from sqlalchemy import select

        existing = (await s.execute(select(Product))).scalars().all()
        if existing:
            print(f"Already {len(existing)} products, skipping.")
            return
        for name, desc, price, cat, img in PRODUCTS:
            s.add(Product(name=name, description=desc, price=price, category=cat, image_url=img))
        await s.commit()
        print(f"Seeded {len(PRODUCTS)} products.")


asyncio.run(main())
