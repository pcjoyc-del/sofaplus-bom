from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas.upholster import (
    UpholsterSourceCreate, UpholsterSourceUpdate, UpholsterSourceResponse,
    UpholsterCollectionCreate, UpholsterCollectionUpdate, UpholsterCollectionResponse,
    UpholsterColorCreate, UpholsterColorUpdate, UpholsterColorResponse,
    UpholsterPriceCreate, UpholsterPriceResponse,
)
from ..services.upholster import (
    source_service, collection_service, color_service,
    get_color_prices, add_color_price,
)
from ..models.upholster import UpholsterCollection, UpholsterColor

router = APIRouter(prefix="/upholster", tags=["Master Data - Upholster"])


# ── Sources ───────────────────────────────────────────────────────────────────

@router.get("/sources", response_model=list[UpholsterSourceResponse])
async def list_sources(include_inactive: bool = False, db: AsyncSession = Depends(get_db)):
    return await source_service.get_all(db, active_only=not include_inactive)


@router.post("/sources", response_model=UpholsterSourceResponse, status_code=201)
async def create_source(data: UpholsterSourceCreate, db: AsyncSession = Depends(get_db)):
    return await source_service.create(db, obj_in=data.model_dump())


@router.get("/sources/{id}", response_model=UpholsterSourceResponse)
async def get_source(id: int, db: AsyncSession = Depends(get_db)):
    obj = await source_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source not found")
    return obj


@router.put("/sources/{id}", response_model=UpholsterSourceResponse)
async def update_source(id: int, data: UpholsterSourceUpdate, db: AsyncSession = Depends(get_db)):
    obj = await source_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source not found")
    return await source_service.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/sources/{id}", status_code=204)
async def delete_source(id: int, db: AsyncSession = Depends(get_db)):
    if not await source_service.soft_delete(db, id=id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source not found")


# ── Collections ───────────────────────────────────────────────────────────────

@router.get("/collections", response_model=list[UpholsterCollectionResponse])
async def list_collections(
    source_id: int | None = None,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    filters = [UpholsterCollection.source_id == source_id] if source_id else []
    return await collection_service.get_all(db, active_only=not include_inactive, filters=filters)


@router.post("/collections", response_model=UpholsterCollectionResponse, status_code=201)
async def create_collection(data: UpholsterCollectionCreate, db: AsyncSession = Depends(get_db)):
    return await collection_service.create(db, obj_in=data.model_dump())


@router.get("/collections/{id}", response_model=UpholsterCollectionResponse)
async def get_collection(id: int, db: AsyncSession = Depends(get_db)):
    obj = await collection_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collection not found")
    return obj


@router.put("/collections/{id}", response_model=UpholsterCollectionResponse)
async def update_collection(id: int, data: UpholsterCollectionUpdate, db: AsyncSession = Depends(get_db)):
    obj = await collection_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collection not found")
    return await collection_service.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/collections/{id}", status_code=204)
async def delete_collection(id: int, db: AsyncSession = Depends(get_db)):
    if not await collection_service.soft_delete(db, id=id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collection not found")


# ── Colors ────────────────────────────────────────────────────────────────────

@router.get("/colors", response_model=list[UpholsterColorResponse])
async def list_colors(
    collection_id: int | None = None,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    filters = [UpholsterColor.collection_id == collection_id] if collection_id else []
    return await color_service.get_all(db, active_only=not include_inactive, filters=filters)


@router.post("/colors", response_model=UpholsterColorResponse, status_code=201)
async def create_color(data: UpholsterColorCreate, db: AsyncSession = Depends(get_db)):
    return await color_service.create(db, obj_in=data.model_dump())


@router.get("/colors/{id}", response_model=UpholsterColorResponse)
async def get_color(id: int, db: AsyncSession = Depends(get_db)):
    obj = await color_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Color not found")
    return obj


@router.put("/colors/{id}", response_model=UpholsterColorResponse)
async def update_color(id: int, data: UpholsterColorUpdate, db: AsyncSession = Depends(get_db)):
    obj = await color_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Color not found")
    return await color_service.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/colors/{id}", status_code=204)
async def delete_color(id: int, db: AsyncSession = Depends(get_db)):
    if not await color_service.soft_delete(db, id=id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Color not found")


@router.get("/colors/{id}/prices", response_model=list[UpholsterPriceResponse])
async def list_color_prices(id: int, db: AsyncSession = Depends(get_db)):
    obj = await color_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Color not found")
    return await get_color_prices(db, id)


@router.post("/colors/{id}/prices", response_model=UpholsterPriceResponse, status_code=201)
async def add_price(id: int, data: UpholsterPriceCreate, db: AsyncSession = Depends(get_db)):
    obj = await color_service.get(db, id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Color not found")
    return await add_color_price(db, id, data.model_dump())
