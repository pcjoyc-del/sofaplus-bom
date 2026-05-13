from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .base import CRUDBase
from ..models.upholster import UpholsterSource, UpholsterCollection, UpholsterColor, UpholsterPrice

source_service = CRUDBase(UpholsterSource)
collection_service = CRUDBase(UpholsterCollection)
color_service = CRUDBase(UpholsterColor)


async def get_color_prices(db: AsyncSession, color_id: int) -> list[UpholsterPrice]:
    result = await db.execute(
        select(UpholsterPrice)
        .where(UpholsterPrice.color_id == color_id)
        .order_by(UpholsterPrice.effective_date.desc())
    )
    return list(result.scalars().all())


async def add_color_price(db: AsyncSession, color_id: int, obj_in: dict) -> UpholsterPrice:
    from sqlalchemy.exc import IntegrityError
    from fastapi import HTTPException, status
    try:
        price = UpholsterPrice(color_id=color_id, **obj_in)
        db.add(price)
        await db.commit()
        await db.refresh(price)
        return price
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Price for this date already exists")
