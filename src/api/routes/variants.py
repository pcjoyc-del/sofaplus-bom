from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas.variants import (
    VariantCreate, VariantUpdate, VariantBulkCreate,
    VariantResponse, VariantPreviewItem, ResolvedBomResponse,
)
from ..services.variants import (
    list_variants, create_variant, preview_bulk,
    bulk_create_variants, update_variant, delete_variant, resolve_bom,
)

router = APIRouter(tags=["Variants"])


@router.get("/products/{product_id}/variants", response_model=list[VariantResponse])
async def get_variants(product_id: int, db: AsyncSession = Depends(get_db)):
    return await list_variants(db, product_id)


@router.post("/products/{product_id}/variants", response_model=VariantResponse, status_code=201)
async def create_variant_endpoint(product_id: int, data: VariantCreate, db: AsyncSession = Depends(get_db)):
    return await create_variant(db, product_id, data.model_dump())


@router.post("/products/{product_id}/variants/preview", response_model=list[VariantPreviewItem])
async def preview_bulk_endpoint(product_id: int, data: VariantBulkCreate, db: AsyncSession = Depends(get_db)):
    return await preview_bulk(db, product_id, data.color_ids)


@router.post("/products/{product_id}/variants/bulk", response_model=list[VariantResponse], status_code=201)
async def bulk_create_endpoint(product_id: int, data: VariantBulkCreate, db: AsyncSession = Depends(get_db)):
    return await bulk_create_variants(
        db, product_id, data.color_ids,
        selling_price=data.selling_price,
        width=data.width,
    )


@router.put("/variants/{variant_id}", response_model=VariantResponse)
async def update_variant_endpoint(variant_id: int, data: VariantUpdate, db: AsyncSession = Depends(get_db)):
    return await update_variant(db, variant_id, data.model_dump(exclude_none=True))


@router.get("/variants/{variant_id}/resolved-bom", response_model=ResolvedBomResponse)
async def get_resolved_bom(variant_id: int, db: AsyncSession = Depends(get_db)):
    return await resolve_bom(db, variant_id)


@router.delete("/variants/{variant_id}", status_code=204)
async def delete_variant_endpoint(variant_id: int, db: AsyncSession = Depends(get_db)):
    if not await delete_variant(db, variant_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Variant not found")
