from sqlalchemy import (
    String, Boolean, ForeignKey, Numeric, Text, Date,
    Integer, UniqueConstraint, CheckConstraint, DateTime, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from datetime import date, datetime
from .base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    type_id: Mapped[int] = mapped_column(ForeignKey("types.id"), nullable=False)
    model_id: Mapped[int] = mapped_column(ForeignKey("models.id"), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    standard_width: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    standard_depth: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    standard_bed_depth: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # 3-tier BOM support (Section I) — 'OWN' | 'TYPE_INHERITED'
    bom_source: Mapped[str] = mapped_column(String(20), default="OWN", nullable=False)
    inherits_bom_from_type: Mapped[bool] = mapped_column(Boolean, default=False)

    bom_versions: Mapped[List["BomVersion"]] = relationship("BomVersion", back_populates="product")
    variants: Mapped[List["ProductVariant"]] = relationship("ProductVariant", back_populates="product")

    __table_args__ = (
        UniqueConstraint("category_id", "type_id", "model_id", name="products_unique"),
        CheckConstraint("bom_source IN ('OWN', 'TYPE_INHERITED')", name="products_bom_source_check"),
    )


class BomVersion(Base):
    __tablename__ = "bom_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    # product_id nullable: NULL = Type-level BOM (Section I)
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True)
    type_id: Mapped[Optional[int]] = mapped_column(ForeignKey("types.id"), nullable=True)
    reference_model_id: Mapped[Optional[int]] = mapped_column(ForeignKey("models.id"), nullable=True)
    reference_width: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    version_number: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    effective_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="bom_versions")
    lines: Mapped[List["BomLine"]] = relationship(
        "BomLine", back_populates="bom_version", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("product_id", "version_number", name="bom_versions_unique"),
        CheckConstraint(
            "(product_id IS NOT NULL AND type_id IS NULL) OR (product_id IS NULL AND type_id IS NOT NULL)",
            name="bom_versions_scope_check",
        ),
    )


class BomLine(Base):
    __tablename__ = "bom_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    bom_version_id: Mapped[int] = mapped_column(
        ForeignKey("bom_versions.id", ondelete="CASCADE"), nullable=False
    )
    line_order: Mapped[int] = mapped_column(Integer, default=0)
    line_type: Mapped[str] = mapped_column(String(30), nullable=False)  # MATERIAL | UPHOLSTER_PLACEHOLDER
    material_id: Mapped[Optional[int]] = mapped_column(ForeignKey("materials.id"), nullable=True)
    section: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    quantity_fixed: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    quantity_formula: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Model 1 Linear Step fields (Section J)
    # qty = qty_base + ((variant_width - standard_width) / qty_width_step) * qty_step_increment
    qty_base: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)
    qty_width_step: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    qty_step_increment: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)

    bom_version: Mapped["BomVersion"] = relationship("BomVersion", back_populates="lines")


class OverheadRate(Base):
    __tablename__ = "overhead_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    rate_type: Mapped[str] = mapped_column(String(50), nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    amount_per_unit: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    percentage: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ProductBomOverride(Base):
    """Product-level override สำหรับ Type-inherited BOM (Phase 2)"""
    __tablename__ = "product_bom_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    target_bom_line_id: Mapped[int] = mapped_column(ForeignKey("bom_lines.id"), nullable=False)
    override_material_id: Mapped[Optional[int]] = mapped_column(ForeignKey("materials.id"), nullable=True)
    override_quantity_fixed: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    override_quantity_formula: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    override_qty_base: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)
    override_qty_width_step: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    override_qty_step_increment: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)
    override_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    __table_args__ = (
        UniqueConstraint("product_id", "target_bom_line_id", name="product_bom_overrides_unique"),
    )
