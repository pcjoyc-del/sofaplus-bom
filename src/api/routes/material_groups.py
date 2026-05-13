from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas.materials import MaterialGroupCreate, MaterialGroupUpdate, MaterialGroupResponse
from ..services.materials import material_group_service
from ..models.materials import MaterialGroup

router = APIRouter(prefix="/material-groups", tags=["Master Data"])


@router.get("", response_model=list[MaterialGroupResponse])
async def list_material_groups(
    include_inactive: bool = False,
    include_general: bool = True,
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if not include_general:
        filters.append(MaterialGroup.is_general == False)
    return await material_group_service.get_all(db, active_only=not include_inactive, filters=filters)


@router.post("", response_model=MaterialGroupResponse, status_code=201)
async def create_material_group(data: MaterialGroupCreate, db: AsyncSession = Depends(get_db)):
    return await material_group_service.create(db, obj_in=data.model_dump())


@router.get("/{id}", response_model=MaterialGroupResponse)
async def get_material_group(id: int, db: AsyncSession = Depends(get_db)):
    obj = await material_group_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material group not found")
    return obj


@router.put("/{id}", response_model=MaterialGroupResponse)
async def update_material_group(id: int, data: MaterialGroupUpdate, db: AsyncSession = Depends(get_db)):
    obj = await material_group_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material group not found")
    return await material_group_service.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/{id}", status_code=204)
async def delete_material_group(id: int, db: AsyncSession = Depends(get_db)):
    if not await material_group_service.soft_delete(db, id=id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material group not found")
