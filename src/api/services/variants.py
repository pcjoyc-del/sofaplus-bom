import re
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert as sa_insert
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from ..models.products import Product, BomVersion, BomLine, OverheadRate
from ..models.variants import ProductVariant, VariantBomOverride
from ..models.master_data import Category, ProductType, ProductModel
from ..models.materials import Material, MaterialPrice
from ..models.upholster import UpholsterColor, UpholsterCollection, UpholsterSource, UpholsterPrice
from ..schemas.variants import VariantResponse, VariantPreviewItem, ResolvedBomLine, ResolvedBomResponse


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
        await db.execute(sa_insert(ProductVariant.__table__).values(
            product_id=product_id, sku=sku,
            upholster_color_id=color_id,
            width=obj_in.get("width"),
            selling_price=obj_in.get("selling_price"),
            status="ACTIVE", is_active=True,
        ))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"Variant {sku} มีอยู่แล้ว")

    result = await db.execute(select(ProductVariant).where(ProductVariant.sku == sku))
    v = result.scalar_one()
    return await _enrich(db, v)


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

    # ตรวจ existing ก่อน
    existing_r = await db.execute(
        select(ProductVariant.upholster_color_id)
        .where(ProductVariant.product_id == product_id, ProductVariant.is_active == True)
    )
    existing_ids = set(existing_r.scalars().all())

    # Build rows to insert
    rows: list[dict] = []
    for color_id in color_ids:
        if color_id in existing_ids:
            continue
        color, coll, src = await _get_color_info(db, color_id)
        if not color or not coll or not src:
            continue
        sku = build_sku(cat.code, ptype.code, model.code, src.code, coll.code, color.code)
        rows.append({"product_id": product_id, "sku": sku,
                     "upholster_color_id": color_id,
                     "width": width, "selling_price": selling_price,
                     "status": "ACTIVE", "is_active": True})

    if not rows:
        return []

    # Core-level INSERT ข้าม ORM relationship management (ป้องกัน MissingGreenlet)
    await db.execute(sa_insert(ProductVariant.__table__).values(rows))
    await db.commit()

    # Fetch inserted variants by SKU
    new_skus = [r["sku"] for r in rows]
    result = await db.execute(
        select(ProductVariant).where(ProductVariant.sku.in_(new_skus))
    )
    created = list(result.scalars().all())
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


# ── Resolve BOM per SKU (FR-11) ───────────────────────────────────────────────

async def resolve_bom(db: AsyncSession, variant_id: int) -> ResolvedBomResponse:
    variant = await db.get(ProductVariant, variant_id)
    if not variant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Variant not found")

    product = await db.get(Product, variant.product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    # Get Active BOM
    bom_r = await db.execute(
        select(BomVersion).where(BomVersion.product_id == product.id, BomVersion.status == "ACTIVE").limit(1)
    )
    bom = bom_r.scalar_one_or_none()
    if not bom:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Product ไม่มี Active BOM")

    # Get BOM lines
    lines_r = await db.execute(
        select(BomLine).where(BomLine.bom_version_id == bom.id).order_by(BomLine.line_order)
    )
    lines = list(lines_r.scalars().all())

    # Get variant overrides map (FR-10 — logic ready, UI Phase 2)
    ov_r = await db.execute(
        select(VariantBomOverride).where(VariantBomOverride.variant_id == variant_id)
    )
    overrides = {o.target_bom_line_id: o for o in ov_r.scalars().all()}

    # Upholster info of this variant
    color, coll, src = await _get_color_info(db, variant.upholster_color_id)

    # Width: variant override หรือ standard
    standard_w = float(product.standard_width) if product.standard_width else 0.0
    variant_w  = float(variant.width) if variant.width else standard_w

    resolved_lines = []
    total = 0.0

    for line in lines:
        ov = overrides.get(line.id)

        if line.line_type == "MATERIAL":
            mat_id = (ov.override_material_id if ov and ov.override_material_id else line.material_id)
            qty    = float(ov.override_quantity_fixed if ov and ov.override_quantity_fixed else line.quantity_fixed or 0)
            mat    = await db.get(Material, mat_id) if mat_id else None

            # ราคาปัจจุบัน
            price_r = await db.execute(
                select(MaterialPrice)
                .where(MaterialPrice.material_id == mat_id, MaterialPrice.effective_date <= date.today())
                .order_by(MaterialPrice.effective_date.desc()).limit(1)
            )
            mp = price_r.scalar_one_or_none()
            unit_price = float(mp.price) if mp else None
            line_cost  = round(unit_price * qty, 2) if unit_price and qty else None
            if line_cost:
                total += line_cost

            resolved_lines.append(ResolvedBomLine(
                bom_line_id=line.id, line_order=line.line_order,
                line_type="MATERIAL",
                material_id=mat_id,
                material_name=mat.name if mat else None,
                mat_id_code=mat.mat_id if mat else None,
                unit=line.unit, quantity=qty,
                unit_price=unit_price, line_cost=line_cost,
                price_date=mp.effective_date if mp else None,
                is_overridden=ov is not None,
            ))

        else:  # UPHOLSTER_PLACEHOLDER
            # คำนวณ qty — Linear Step หรือ Fixed
            if line.qty_base is not None and line.qty_width_step:
                qty = float(line.qty_base) + (
                    (variant_w - standard_w) / float(line.qty_width_step)
                ) * float(line.qty_step_increment or 0)
                qty_formula = True
            else:
                qty = float(line.quantity_fixed or 0)
                qty_formula = False
            qty = round(qty, 4)

            # ราคาผ้าปัจจุบัน
            uph_price_r = await db.execute(
                select(UpholsterPrice)
                .where(UpholsterPrice.color_id == variant.upholster_color_id,
                       UpholsterPrice.effective_date <= date.today())
                .order_by(UpholsterPrice.effective_date.desc()).limit(1)
            )
            up = uph_price_r.scalar_one_or_none()
            unit_price = float(up.price) if up else None
            line_cost  = round(unit_price * qty, 2) if unit_price and qty else None
            if line_cost:
                total += line_cost

            resolved_lines.append(ResolvedBomLine(
                bom_line_id=line.id, line_order=line.line_order,
                line_type="UPHOLSTER",
                section=line.section,
                source_name=src.name if src else None,
                collection_code=coll.code if coll else None,
                color_code=color.code if color else None,
                unit=line.unit or (src.default_unit if src else None),
                quantity=qty, unit_price=unit_price, line_cost=line_cost,
                price_date=up.effective_date if up else None,
                qty_formula_used=qty_formula,
            ))

    # Overhead (same logic as BOM cost)
    overhead_rate = overhead_cost = None
    total_estimated = round(total, 2)
    if total > 0:
        for cat_id in [product.category_id, None]:
            cond = OverheadRate.category_id == cat_id if cat_id is not None else OverheadRate.category_id.is_(None)
            rate_r = await db.execute(
                select(OverheadRate)
                .where(OverheadRate.effective_date <= date.today(),
                       OverheadRate.rate_type == "GENERAL_MATERIAL", cond)
                .order_by(OverheadRate.effective_date.desc()).limit(1)
            )
            rate_obj = rate_r.scalar_one_or_none()
            if rate_obj and rate_obj.percentage:
                overhead_rate = float(rate_obj.percentage)
                overhead_cost = round(total * overhead_rate / 100, 2)
                total_estimated = round(total + overhead_cost, 2)
                break

    return ResolvedBomResponse(
        variant_id=variant_id, sku=variant.sku,
        product_name=product.display_name,
        bom_number=bom.bom_number,
        variant_width=variant_w if variant.width else None,
        standard_width=standard_w,
        lines=resolved_lines,
        total_material_cost=round(total, 2),
        overhead_rate=overhead_rate,
        overhead_cost=overhead_cost,
        total_estimated_cost=total_estimated,
    )


# ── Soft Delete ────────────────────────────────────────────────────────────────

async def delete_variant(db: AsyncSession, variant_id: int) -> bool:
    v = await db.get(ProductVariant, variant_id)
    if not v:
        return False
    v.is_active = False
    await db.commit()
    return True
