from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .base import CRUDBase
from ..models.materials import MaterialGroup, Material, MaterialPrice

material_group_service = CRUDBase(MaterialGroup)
material_service = CRUDBase(Material)


async def get_material_prices(db: AsyncSession, material_id: int) -> list[MaterialPrice]:
    result = await db.execute(
        select(MaterialPrice)
        .where(MaterialPrice.material_id == material_id)
        .order_by(MaterialPrice.effective_date.desc())
    )
    return list(result.scalars().all())


async def add_material_price(db: AsyncSession, material_id: int, obj_in: dict) -> MaterialPrice:
    from sqlalchemy.exc import IntegrityError
    from fastapi import HTTPException, status
    try:
        price = MaterialPrice(material_id=material_id, **obj_in)
        db.add(price)
        await db.commit()
        await db.refresh(price)
        return price
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Price for this date already exists")
