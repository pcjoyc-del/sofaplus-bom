from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas.master_data import CategoryCreate, CategoryUpdate, CategoryResponse
from ..services.master_data import category_service

router = APIRouter(prefix="/categories", tags=["Master Data"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(include_inactive: bool = False, db: AsyncSession = Depends(get_db)):
    return await category_service.get_all(db, active_only=not include_inactive)


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db)):
    return await category_service.create(db, obj_in=data.model_dump())


@router.get("/{id}", response_model=CategoryResponse)
async def get_category(id: int, db: AsyncSession = Depends(get_db)):
    obj = await category_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return obj


@router.put("/{id}", response_model=CategoryResponse)
async def update_category(id: int, data: CategoryUpdate, db: AsyncSession = Depends(get_db)):
    obj = await category_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return await category_service.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/{id}", status_code=204)
async def delete_category(id: int, db: AsyncSession = Depends(get_db)):
    if not await category_service.soft_delete(db, id=id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
