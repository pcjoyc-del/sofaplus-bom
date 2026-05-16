from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas.products import (
    ProductCreate, ProductUpdate, ProductResponse,
    BomVersionCreate, BomVersionResponse,
    BomLineCreate, BomLineUpdate, BomLineResponse,
    BomLineBulkCreate, BomFullResponse, BomCostResponse,
    BomCopyToRequest, BomCopyToResponse, BomCopyToResult,
)
from ..services.products import (
    product_service, create_product, get_active_bom,
    get_bom_versions, create_bom_version, activate_bom,
    get_bom_lines, add_bom_line, bulk_add_bom_lines,
    update_bom_line, delete_bom_line, copy_bom_from, get_bom_cost,
)
from ..models.products import Product

router = APIRouter(prefix="/products", tags=["Products & BOM"])


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProductResponse])
async def list_products(
    category_id: int | None = None,
    type_id: int | None = None,
    status: str | None = None,
    has_active_bom: bool = False,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import exists, select as sa_select, case, func
    from ..models.products import BomVersion as BV
    filters = []
    if category_id:    filters.append(Product.category_id == category_id)
    if type_id:        filters.append(Product.type_id == type_id)
    if status:         filters.append(Product.status == status)
    if has_active_bom:
        filters.append(
            exists(sa_select(BV.id).where(BV.product_id == Product.id, BV.status == "ACTIVE"))
        )
    products = await product_service.get_all(db, active_only=not include_inactive, filters=filters)
    active_ids: set[int] = set()
    any_ids: set[int] = set()
    if products:
        ids = [p.id for p in products]
        r1 = await db.execute(sa_select(BV.product_id).where(BV.product_id.in_(ids), BV.status == "ACTIVE").distinct())
        active_ids = {r.product_id for r in r1}
        r2 = await db.execute(sa_select(BV.product_id).where(BV.product_id.in_(ids)).distinct())
        any_ids = {r.product_id for r in r2}
    result = []
    for p in products:
        resp = ProductResponse.model_validate(p)
        resp.bom_status = "ACTIVE" if p.id in active_ids else "DRAFT" if p.id in any_ids else "NONE"
        result.append(resp)
    return result


@router.post("", response_model=ProductResponse, status_code=201)
async def create_product_endpoint(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    return await create_product(db, obj_in=data.model_dump())


@router.get("/{id}", response_model=ProductResponse)
async def get_product(id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    from ..models.products import BomVersion as BV
    obj = await product_service.get(db, id)
    if not obj: raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    r_active = await db.execute(sa_select(BV.id).where(BV.product_id == id, BV.status == "ACTIVE").limit(1))
    r_any    = await db.execute(sa_select(BV.id).where(BV.product_id == id).limit(1))
    resp = ProductResponse.model_validate(obj)
    resp.bom_status = "ACTIVE" if r_active.first() else "DRAFT" if r_any.first() else "NONE"
    return resp


@router.put("/{id}", response_model=ProductResponse)
async def update_product(id: int, data: ProductUpdate, db: AsyncSession = Depends(get_db)):
    obj = await product_service.get(db, id)
    if not obj: raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return await product_service.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/{id}", status_code=204)
async def delete_product(id: int, db: AsyncSession = Depends(get_db)):
    if not await product_service.soft_delete(db, id=id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")


# ── BOM Versions ──────────────────────────────────────────────────────────────

@router.get("/{id}/bom", response_model=BomFullResponse)
async def get_product_bom(id: int, db: AsyncSession = Depends(get_db)):
    versions = await get_bom_versions(db, id)
    if not versions: raise HTTPException(status.HTTP_404_NOT_FOUND, "No BOM found")
    bom = next((v for v in versions if v.status == "ACTIVE"), versions[0])
    return BomFullResponse(version=bom, lines=await get_bom_lines(db, bom.id))


@router.get("/{id}/bom/versions", response_model=list[BomVersionResponse])
async def list_bom_versions(id: int, db: AsyncSession = Depends(get_db)):
    return await get_bom_versions(db, id)


@router.post("/{id}/bom/versions", response_model=BomVersionResponse, status_code=201)
async def create_bom_version_endpoint(id: int, data: BomVersionCreate, db: AsyncSession = Depends(get_db)):
    obj = await product_service.get(db, id)
    if not obj: raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return await create_bom_version(db, product_id=id, obj_in=data.model_dump())


@router.post("/{id}/bom/copy", response_model=BomVersionResponse, status_code=201)
async def copy_bom(id: int, source_product_id: int, db: AsyncSession = Depends(get_db)):
    obj = await product_service.get(db, id)
    if not obj: raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return await copy_bom_from(db, target_product_id=id, source_product_id=source_product_id)


@router.post("/{id}/bom/copy-to", response_model=BomCopyToResponse)
async def copy_bom_to_many(id: int, data: BomCopyToRequest, db: AsyncSession = Depends(get_db)):
    """Copy Active BOM ของ Product นี้ไปให้หลาย Products พร้อมกัน"""
    source = await product_service.get(db, id)
    if not source: raise HTTPException(status.HTTP_404_NOT_FOUND, "Source product not found")

    results: list[BomCopyToResult] = []
    for target_id in data.target_product_ids:
        target = await product_service.get(db, target_id)
        if not target:
            results.append(BomCopyToResult(
                product_id=target_id, product_name=None,
                success=False, error="Product not found"
            ))
            continue
        try:
            new_bom = await copy_bom_from(db, target_product_id=target_id, source_product_id=id)
            results.append(BomCopyToResult(
                product_id=target_id,
                product_name=target.display_name or target.code,
                success=True,
                bom_number=new_bom.bom_number,
            ))
        except HTTPException as e:
            results.append(BomCopyToResult(
                product_id=target_id,
                product_name=target.display_name or target.code,
                success=False,
                error=str(e.detail),
            ))
        except Exception as e:
            results.append(BomCopyToResult(
                product_id=target_id,
                product_name=target.display_name or target.code,
                success=False,
                error=str(e),
            ))

    copied = sum(1 for r in results if r.success)
    return BomCopyToResponse(copied=copied, failed=len(results) - copied, results=results)


@router.post("/bom/versions/{bom_id}/activate", response_model=BomVersionResponse)
async def activate_bom_version(bom_id: int, db: AsyncSession = Depends(get_db)):
    return await activate_bom(db, bom_id)


@router.get("/bom/versions/{bom_id}/cost", response_model=BomCostResponse)
async def get_bom_cost_endpoint(bom_id: int, db: AsyncSession = Depends(get_db)):
    return await get_bom_cost(db, bom_id)


# ── BOM Lines ─────────────────────────────────────────────────────────────────

@router.get("/bom/versions/{bom_id}", response_model=BomVersionResponse)
async def get_bom_version(bom_id: int, db: AsyncSession = Depends(get_db)):
    from ..models.products import BomVersion as BomVersionModel
    obj = await db.get(BomVersionModel, bom_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM version not found")
    return obj


@router.get("/bom/versions/{bom_id}/lines", response_model=list[BomLineResponse])
async def list_bom_lines(bom_id: int, db: AsyncSession = Depends(get_db)):
    return await get_bom_lines(db, bom_id)


@router.post("/bom/versions/{bom_id}/lines", response_model=BomLineResponse, status_code=201)
async def add_line(bom_id: int, data: BomLineCreate, db: AsyncSession = Depends(get_db)):
    return await add_bom_line(db, bom_version_id=bom_id, obj_in=data.model_dump())


@router.post("/bom/versions/{bom_id}/lines/bulk", response_model=list[BomLineResponse], status_code=201)
async def add_lines_bulk(bom_id: int, data: BomLineBulkCreate, db: AsyncSession = Depends(get_db)):
    return await bulk_add_bom_lines(
        db, bom_version_id=bom_id,
        items=[item.model_dump() for item in data.lines]
    )


@router.put("/bom/lines/{line_id}", response_model=BomLineResponse)
async def update_line(line_id: int, data: BomLineUpdate, db: AsyncSession = Depends(get_db)):
    return await update_bom_line(db, line_id=line_id, obj_in=data.model_dump(exclude_unset=True))


@router.delete("/bom/lines/{line_id}", status_code=204)
async def delete_line(line_id: int, db: AsyncSession = Depends(get_db)):
    if not await delete_bom_line(db, line_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM line not found")
