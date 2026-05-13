from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas.master_data import TypeCreate, TypeUpdate, TypeResponse
from ..services.master_data import type_service
from ..models.master_data import ProductType

router = APIRouter(prefix="/types", tags=["Master Data"])


@router.get("", response_model=list[TypeResponse])
async def list_types(
    category_id: int | None = None,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if category_id:
        filters.append(ProductType.category_id == category_id)
    return await type_service.get_all(db, active_only=not include_inactive, filters=filters)


@router.post("", response_model=TypeResponse, status_code=201)
async def create_type(data: TypeCreate, db: AsyncSession = Depends(get_db)):
    return await type_service.create(db, obj_in=data.model_dump())


@router.get("/{id}", response_model=TypeResponse)
async def get_type(id: int, db: AsyncSession = Depends(get_db)):
    obj = await type_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Type not found")
    return obj


@router.put("/{id}", response_model=TypeResponse)
async def update_type(id: int, data: TypeUpdate, db: AsyncSession = Depends(get_db)):
    obj = await type_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Type not found")
    return await type_service.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/{id}", status_code=204)
async def delete_type(id: int, db: AsyncSession = Depends(get_db)):
    if not await type_service.soft_delete(db, id=id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Type not found")
