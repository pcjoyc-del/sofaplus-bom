import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from ..models.products import Product, BomVersion
from ..models.variants import ProductVariant
from ..models.master_data import Category, ProductType, ProductModel
from ..models.upholster import UpholsterColor, UpholsterCollection, UpholsterSource
from ..schemas.variants import VariantResponse, VariantPreviewItem


# ── SKU Generation ─────────────────────────────────────────────────────────────

def _short_code(s: str, max_len: int = 6) -> str:
    """ตัดรหัสให้สั้น: เอาส่วนแรกที่ไม่ใช่ตัวเลขล้วนก่อน '-'"""
    parts = re.sub(r'[^A-Za-z0-9-]', '', s).split('-')
    for part in parts:
        if not part.isdigit() and len(part) >= 2:
            return part.upper()[:max_len]
    return re.sub(r'[^A-Za-z0-9]', '', s).upper()[:max_len]


def build_sku(cat_code: str, type_code: str, model_code: str,
              src_code: str, coll_code: str, color_code: str) -> str:
    """Format: {CAT}-{TYPE}-{MODEL}-{SRC}-{COLL_SHORT}-{COLOR_SHORT}"""
    return (
        f"{re.sub(r'[^A-Z0-9]', '', cat_code.upper())}"
        f"-{re.sub(r'[^A-Z0-9]', '', type_code.upper())}"
        f"-{re.sub(r'[^A-Z0-9]', '', model_code.upper())}"
        f"-{src_code.upper()}"
        f"-{_short_code(coll_code)}"
        f"-{_short_code(color_code)}"
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_color_info(db: AsyncSession, color_id: int):
    """Return (color, collection, source) tuple"""
    color = await db.get(UpholsterColor, color_id)
    if not color:
        return None, None, None
    collection = await db.get(UpholsterCollection, color.collection_id)
    source = await db.get(UpholsterSource, collection.source_id) if collection else None
    return color, collection, source


async def _enrich(db: AsyncSession, variant: ProductVariant) -> VariantResponse:
    color, coll, src = await _get_color_info(db, variant.upholster_color_id)
    resp = VariantResponse.model_validate(variant)
    resp.source_code    = src.code if src else None
    resp.source_name    = src.name if src else None
    resp.collection_code = coll.code if coll else None
    resp.color_code      = color.code if color else None
    return resp


async def _assert_active_bom(db: AsyncSession, product_id: int):
    """BR-7: ต้องมี Active BOM ก่อนสร้าง Variant"""
    r = await db.execute(
        select(BomVersion.id).where(BomVersion.product_id == product_id, BomVersion.status == "ACTIVE").limit(1)
    )
    if not r.first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Product ต้องมี Active BOM ก่อนสร้าง Variant")


# ── List ───────────────────────────────────────────────────────────────────────

async def list_variants(db: AsyncSession, product_id: int) -> list[VariantResponse]:
    result = await db.execute(
        select(ProductVariant)
        .where(ProductVariant.product_id == product_id, ProductVariant.is_active == True)
        .order_by(ProductVariant.id)
    )
    variants = list(result.scalars().all())
    return [await _enrich(db, v) for v in variants]


# ── Create Single ──────────────────────────────────────────────────────────────

async def create_variant(db: AsyncSession, product_id: int, obj_in: dict) -> VariantResponse:
    await _assert_active_bom(db, product_id)

    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    color_id = obj_in["upholster_color_id"]
    color, coll, src = await _get_color_info(db, color_id)
    if not color or not coll or not src:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upholster color not found")

    cat   = await db.get(Category,     product.category_id)
    ptype = await db.get(ProductType,  product.type_id)
    model = await db.get(ProductModel, product.model_id)

    sku = build_sku(cat.code, ptype.code, model.code, src.code, coll.code, color.code)

    try:
        v = ProductVariant(
            product_id=product_id,
            sku=sku,
            upholster_color_id=color_id,
            width=obj_in.get("width"),
            selling_price=obj_in.get("selling_price"),
        )
        db.add(v)
        await db.commit()
        await db.refresh(v)
        return await _enrich(db, v)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"Variant {sku} มีอยู่แล้ว")


# ── Preview Bulk ───────────────────────────────────────────────────────────────

async def preview_bulk(db: AsyncSession, product_id: int, color_ids: list[int]) -> list[VariantPreviewItem]:
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    cat   = await db.get(Category,     product.category_id)
    ptype = await db.get(ProductType,  product.type_id)
    model = await db.get(ProductModel, product.model_id)

    # Existing variants for this product
    existing = await db.execute(
        select(ProductVariant.upholster_color_id)
        .where(ProductVariant.product_id == product_id, ProductVariant.is_active == True)
    )
    existing_color_ids = {r.upholster_color_id for r in existing}

    items = []
    for color_id in color_ids:
        color, coll, src = await _get_color_info(db, color_id)
        if not color or not coll or not src:
            continue
        sku = build_sku(cat.code, ptype.code, model.code, src.code, coll.code, color.code)
        items.append(VariantPreviewItem(
            upholster_color_id=color_id,
            sku=sku,
            source_code=src.code,
            source_name=src.name,
            collection_code=coll.code,
            color_code=color.code,
            already_exists=color_id in existing_color_ids,
        ))
    return items


# ── Bulk Create ────────────────────────────────────────────────────────────────

async def bulk_create_variants(
    db: AsyncSession, product_id: int, color_ids: list[int],
    selling_price=None, width=None
) -> list[VariantResponse]:
    await _assert_active_bom(db, product_id)

    product = await db.get(Product, product_id)
    cat   = await db.get(Category,     product.category_id)
    ptype = await db.get(ProductType,  product.type_id)
    model = await db.get(ProductModel, product.model_id)

    created = []
    skipped = []
    for color_id in color_ids:
        color, coll, src = await _get_color_info(db, color_id)
        if not color or not coll or not src:
            continue
        sku = build_sku(cat.code, ptype.code, model.code, src.code, coll.code, color.code)
        try:
            v = ProductVariant(
                product_id=product_id, sku=sku,
                upholster_color_id=color_id,
                width=width, selling_price=selling_price,
            )
            db.add(v)
            await db.flush()
            created.append(v)
        except IntegrityError:
            await db.rollback()
            skipped.append(sku)

    await db.commit()
    for v in created:
        await db.refresh(v)
    return [await _enrich(db, v) for v in created]


# ── Update ─────────────────────────────────────────────────────────────────────

async def update_variant(db: AsyncSession, variant_id: int, obj_in: dict) -> VariantResponse:
    v = await db.get(ProductVariant, variant_id)
    if not v:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Variant not found")
    for k, val in obj_in.items():
        if val is not None:
            setattr(v, k, val)
    await db.commit()
    await db.refresh(v)
    return await _enrich(db, v)


# ── Soft Delete ────────────────────────────────────────────────────────────────

async def delete_variant(db: AsyncSession, variant_id: int) -> bool:
    v = await db.get(ProductVariant, variant_id)
    if not v:
        return False
    v.is_active = False
    await db.commit()
    return True
