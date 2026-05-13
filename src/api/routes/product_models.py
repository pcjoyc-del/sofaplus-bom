from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas.master_data import ProductModelCreate, ProductModelUpdate, ProductModelResponse
from ..services.master_data import model_service
from ..models.master_data import ProductModel

router = APIRouter(prefix="/models", tags=["Master Data"])


@router.get("", response_model=list[ProductModelResponse])
async def list_models(
    category_id: int | None = None,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if category_id:
        filters.append(ProductModel.category_id == category_id)
    return await model_service.get_all(db, active_only=not include_inactive, filters=filters)


@router.post("", response_model=ProductModelResponse, status_code=201)
async def create_model(data: ProductModelCreate, db: AsyncSession = Depends(get_db)):
    return await model_service.create(db, obj_in=data.model_dump())


@router.get("/{id}", response_model=ProductModelResponse)
async def get_model(id: int, db: AsyncSession = Depends(get_db)):
    obj = await model_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model not found")
    return obj


@router.put("/{id}", response_model=ProductModelResponse)
async def update_model(id: int, data: ProductModelUpdate, db: AsyncSession = Depends(get_db)):
    obj = await model_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model not found")
    return await model_service.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/{id}", status_code=204)
async def delete_model(id: int, db: AsyncSession = Depends(get_db)):
    if not await model_service.soft_delete(db, id=id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model not found")
