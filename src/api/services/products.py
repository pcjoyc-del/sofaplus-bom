from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from .base import CRUDBase
from ..models.products import Product, BomVersion, BomLine
from ..models.master_data import Category, ProductType, ProductModel

product_service = CRUDBase(Product)


def _build_product_code(category_id: int, type_id: int, model_id: int) -> str:
    return f"prd-{category_id}|{type_id}|{model_id}"


async def create_product(db: AsyncSession, *, obj_in: dict) -> Product:
    obj_in["code"] = _build_product_code(
        obj_in["category_id"], obj_in["type_id"], obj_in["model_id"]
    )
    # Auto-build display_name จาก Category + Type + Model ถ้าไม่ได้กรอก
    if not obj_in.get("display_name"):
        cat = await db.get(Category, obj_in["category_id"])
        ptype = await db.get(ProductType, obj_in["type_id"])
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
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Product with this Category + Type + Model + Size already exists",
        )


async def get_active_bom(db: AsyncSession, product_id: int) -> BomVersion | None:
    result = await db.execute(
        select(BomVersion).where(
            BomVersion.product_id == product_id,
            BomVersion.status == "ACTIVE",
        )
    )
    return result.scalar_one_or_none()


async def get_bom_versions(db: AsyncSession, product_id: int) -> list[BomVersion]:
    result = await db.execute(
        select(BomVersion)
        .where(BomVersion.product_id == product_id)
        .order_by(BomVersion.created_at.desc())
    )
    return list(result.scalars().all())


async def create_bom_version(db: AsyncSession, *, product_id: int, obj_in: dict) -> BomVersion:
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
    from datetime import datetime, date
    bom = await db.get(BomVersion, bom_id)
    if not bom:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM version not found")
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
        select(BomLine)
        .where(BomLine.bom_version_id == bom_version_id)
        .order_by(BomLine.line_order)
    )
    return list(result.scalars().all())


async def add_bom_line(db: AsyncSession, *, bom_version_id: int, obj_in: dict) -> BomLine:
    line = BomLine(bom_version_id=bom_version_id, **obj_in)
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return line


async def bulk_add_bom_lines(
    db: AsyncSession, *, bom_version_id: int, items: list[dict]
) -> list[BomLine]:
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


async def copy_bom_from(
    db: AsyncSession, *, target_product_id: int, source_product_id: int
) -> BomVersion:
    source_bom = await get_active_bom(db, source_product_id)
    if not source_bom:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source product has no active BOM")
    source_lines = await get_bom_lines(db, source_bom.id)
    versions = await get_bom_versions(db, target_product_id)
    next_version = f"1.{len(versions)}" if versions else "1.0"
    new_bom = BomVersion(
        product_id=target_product_id,
        version_number=next_version,
        status="DRAFT",
        notes=f"Copied from product {source_product_id} v{source_bom.version_number}",
    )
    db.add(new_bom)
    await db.flush()
    for line in source_lines:
        db.add(BomLine(
            bom_version_id=new_bom.id,
            line_order=line.line_order, line_type=line.line_type,
            material_id=line.material_id, section=line.section,
            quantity_fixed=line.quantity_fixed, quantity_formula=line.quantity_formula,
            unit=line.unit, note=line.note,
            qty_base=line.qty_base, qty_width_step=line.qty_width_step,
            qty_step_increment=line.qty_step_increment,
        ))
    await db.commit()
    await db.refresh(new_bom)
    return new_bom
