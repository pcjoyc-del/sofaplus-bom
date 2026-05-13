import re
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from .base import CRUDBase
from ..models.products import Product, BomVersion, BomLine
from ..models.master_data import Category, ProductType, ProductModel
from ..models.materials import Material, MaterialPrice

product_service = CRUDBase(Product)


def _build_product_code(category_id: int, type_id: int, model_id: int) -> str:
    return f"prd-{category_id}|{type_id}|{model_id}"


def _clean(code: str) -> str:
    return re.sub(r'[^A-Za-z0-9]', '', code)


def _generate_bom_number(cat_code: str, type_code: str, model_code: str, version: str) -> str:
    return f"BOM-{_clean(cat_code)}{_clean(type_code)}{_clean(model_code)}-v{version}"


async def create_product(db: AsyncSession, *, obj_in: dict) -> Product:
    obj_in["code"] = _build_product_code(
        obj_in["category_id"], obj_in["type_id"], obj_in["model_id"]
    )
    if not obj_in.get("display_name"):
        cat   = await db.get(Category,     obj_in["category_id"])
        ptype = await db.get(ProductType,  obj_in["type_id"])
        model = await db.get(ProductModel, obj_in["model_id"])
        if cat and ptype and model:
            obj_in["display_name"] = f"{cat.name} | {ptype.code} | {model.code}"
    try:
        product = Product(**obj_in)
        db.add(product)
        await db.commit()
        await db.refresh(product)
        return product
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Product with this Category + Type + Model + Size already exists")


async def get_active_bom(db: AsyncSession, product_id: int) -> BomVersion | None:
    result = await db.execute(
        select(BomVersion).where(BomVersion.product_id == product_id, BomVersion.status == "ACTIVE")
    )
    return result.scalar_one_or_none()


async def get_bom_versions(db: AsyncSession, product_id: int) -> list[BomVersion]:
    result = await db.execute(
        select(BomVersion).where(BomVersion.product_id == product_id).order_by(BomVersion.created_at.desc())
    )
    return list(result.scalars().all())


async def create_bom_version(db: AsyncSession, *, product_id: int, obj_in: dict) -> BomVersion:
    # Auto-generate bom_number from Product → Category + Type + Model codes
    product = await db.get(Product, product_id)
    if product:
        cat   = await db.get(Category,     product.category_id)
        ptype = await db.get(ProductType,  product.type_id)
        model = await db.get(ProductModel, product.model_id)
        if cat and ptype and model:
            obj_in["bom_number"] = _generate_bom_number(
                cat.code, ptype.code, model.code, obj_in.get("version_number", "1.0")
            )
    try:
        bom = BomVersion(product_id=product_id, **obj_in)
        db.add(bom)
        await db.commit()
        await db.refresh(bom)
        return bom
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "BOM version number already exists")


async def activate_bom(db: AsyncSession, bom_id: int) -> BomVersion:
    bom = await db.get(BomVersion, bom_id)
    if not bom:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM version not found")

    # Validate: ต้องมีทั้ง Material และ Upholster Placeholder
    lines = await get_bom_lines(db, bom_id)
    has_material   = any(l.line_type == "MATERIAL"              for l in lines)
    has_upholster  = any(l.line_type == "UPHOLSTER_PLACEHOLDER" for l in lines)
    if not has_material:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "BOM ต้องมี Material line อย่างน้อย 1 รายการก่อน Activate")
    if not has_upholster:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "BOM ต้องมี Upholster Placeholder อย่างน้อย 1 รายการก่อน Activate")

    existing = await get_active_bom(db, bom.product_id)
    if existing and existing.id != bom_id:
        existing.status = "ARCHIVED"
        existing.archived_at = datetime.now()
    bom.status = "ACTIVE"
    bom.activated_at = datetime.now()
    bom.effective_date = date.today()
    await db.commit()
    await db.refresh(bom)
    return bom


async def get_bom_lines(db: AsyncSession, bom_version_id: int) -> list[BomLine]:
    result = await db.execute(
        select(BomLine).where(BomLine.bom_version_id == bom_version_id).order_by(BomLine.line_order)
    )
    return list(result.scalars().all())


async def add_bom_line(db: AsyncSession, *, bom_version_id: int, obj_in: dict) -> BomLine:
    line = BomLine(bom_version_id=bom_version_id, **obj_in)
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return line


async def bulk_add_bom_lines(db: AsyncSession, *, bom_version_id: int, items: list[dict]) -> list[BomLine]:
    existing = await get_bom_lines(db, bom_version_id)
    base_order = max((l.line_order for l in existing), default=0) + 1
    new_lines = []
    for i, item in enumerate(items):
        line = BomLine(
            bom_version_id=bom_version_id,
            line_type="MATERIAL",
            line_order=item.get("line_order") or (base_order + i),
            material_id=item["material_id"],
            quantity_fixed=item["quantity_fixed"],
            unit=item.get("unit"),
            note=item.get("note"),
        )
        db.add(line)
        new_lines.append(line)
    await db.commit()
    for line in new_lines:
        await db.refresh(line)
    return new_lines


async def update_bom_line(db: AsyncSession, *, line_id: int, obj_in: dict) -> BomLine:
    line = await db.get(BomLine, line_id)
    if not line:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM line not found")
    for k, v in obj_in.items():
        setattr(line, k, v)
    await db.commit()
    await db.refresh(line)
    return line


async def delete_bom_line(db: AsyncSession, line_id: int) -> bool:
    line = await db.get(BomLine, line_id)
    if not line:
        return False
    await db.delete(line)
    await db.commit()
    return True


async def get_bom_cost(db: AsyncSession, bom_version_id: int) -> dict:
    """คำนวณต้นทุนวัสดุต่อ BOM line ใช้ราคาปัจจุบัน (effective_date <= today)"""
    bom = await db.get(BomVersion, bom_version_id)
    if not bom:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM version not found")

    lines = await get_bom_lines(db, bom_version_id)
    result_lines = []
    total = 0.0

    for line in lines:
        if line.line_type == "MATERIAL" and line.material_id:
            mat = await db.get(Material, line.material_id)
            price_result = await db.execute(
                select(MaterialPrice)
                .where(
                    MaterialPrice.material_id == line.material_id,
                    MaterialPrice.effective_date <= date.today(),
                )
                .order_by(MaterialPrice.effective_date.desc())
                .limit(1)
            )
            mat_price = price_result.scalar_one_or_none()
            unit_price = float(mat_price.price) if mat_price else None
            qty = float(line.quantity_fixed) if line.quantity_fixed else None
            line_cost = round(unit_price * qty, 2) if unit_price and qty else None
            if line_cost:
                total += line_cost
            result_lines.append({
                "bom_line_id": line.id,
                "line_order": line.line_order,
                "line_type": line.line_type,
                "material_id": line.material_id,
                "material_name": mat.name if mat else None,
                "mat_id_code": mat.mat_id if mat else None,
                "unit": line.unit,
                "quantity": qty,
                "unit_price": unit_price,
                "line_cost": line_cost,
                "price_date": mat_price.effective_date if mat_price else None,
            })
        else:
            result_lines.append({
                "bom_line_id": line.id,
                "line_order": line.line_order,
                "line_type": line.line_type,
                "section": line.section,
                "upholster_type": line.upholster_type,
                "unit": line.unit,
                "quantity": float(line.quantity_fixed) if line.quantity_fixed else None,
                "unit_price": None,
                "line_cost": None,
                "price_date": None,
            })

    return {
        "bom_version_id": bom_version_id,
        "bom_number": bom.bom_number,
        "lines": result_lines,
        "total_material_cost": round(total, 2),
    }


async def copy_bom_from(db: AsyncSession, *, target_product_id: int, source_product_id: int) -> BomVersion:
    source_bom = await get_active_bom(db, source_product_id)
    if not source_bom:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source product has no active BOM")
    source_lines = await get_bom_lines(db, source_bom.id)
    versions = await get_bom_versions(db, target_product_id)
    next_version = f"1.{len(versions)}" if versions else "1.0"
    new_bom = await create_bom_version(db, product_id=target_product_id, obj_in={
        "version_number": next_version,
        "notes": f"Copied from product {source_product_id} v{source_bom.version_number}",
    })
    for line in source_lines:
        db.add(BomLine(
            bom_version_id=new_bom.id,
            line_order=line.line_order, line_type=line.line_type,
            material_id=line.material_id, section=line.section,
            upholster_type=line.upholster_type,
            quantity_fixed=line.quantity_fixed, quantity_formula=line.quantity_formula,
            unit=line.unit, note=line.note,
            qty_base=line.qty_base, qty_width_step=line.qty_width_step,
            qty_step_increment=line.qty_step_increment,
        ))
    await db.commit()
    await db.refresh(new_bom)
    return new_bom
