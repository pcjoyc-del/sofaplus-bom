from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas.materials import (
    MaterialCreate, MaterialUpdate, MaterialResponse,
    MaterialPriceCreate, MaterialPriceResponse,
)
from ..services.materials import material_service, get_material_prices, add_material_price
from ..models.materials import Material

router = APIRouter(prefix="/materials", tags=["Master Data"])


@router.get("", response_model=list[MaterialResponse])
async def list_materials(
    group_id: int | None = None,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if group_id:
        filters.append(Material.group_id == group_id)
    return await material_service.get_all(db, active_only=not include_inactive, filters=filters)


@router.post("", response_model=MaterialResponse, status_code=201)
async def create_material(data: MaterialCreate, db: AsyncSession = Depends(get_db)):
    return await material_service.create(db, obj_in=data.model_dump())


@router.get("/{id}", response_model=MaterialResponse)
async def get_material(id: int, db: AsyncSession = Depends(get_db)):
    obj = await material_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")
    return obj


@router.put("/{id}", response_model=MaterialResponse)
async def update_material(id: int, data: MaterialUpdate, db: AsyncSession = Depends(get_db)):
    obj = await material_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")
    return await material_service.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/{id}", status_code=204)
async def delete_material(id: int, db: AsyncSession = Depends(get_db)):
    if not await material_service.soft_delete(db, id=id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")


@router.get("/{id}/prices", response_model=list[MaterialPriceResponse])
async def list_material_prices(id: int, db: AsyncSession = Depends(get_db)):
    obj = await material_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")
    return await get_material_prices(db, id)


@router.post("/{id}/prices", response_model=MaterialPriceResponse, status_code=201)
async def add_price(id: int, data: MaterialPriceCreate, db: AsyncSession = Depends(get_db)):
    obj = await material_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")
    return await add_material_price(db, id, data.model_dump())
