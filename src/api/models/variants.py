from sqlalchemy import String, Boolean, ForeignKey, Numeric, Text, UniqueConstraint, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from datetime import datetime
from .base import Base, TimestampMixin


class ProductVariant(Base, TimestampMixin):
    __tablename__ = "product_variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    upholster_color_id: Mapped[int] = mapped_column(ForeignKey("upholster_colors.id"), nullable=False)
    # width เท่านั้น — depth/bed_depth ถูก drop (Section K / Q2)
    width: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    selling_price: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    product: Mapped["Product"] = relationship("Product", back_populates="variants")
    overrides: Mapped[List["VariantBomOverride"]] = relationship(
        "VariantBomOverride", back_populates="variant", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("product_id", "upholster_color_id", name="product_variants_unique"),
    )


class VariantBomOverride(Base):
    __tablename__ = "variant_bom_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int] = mapped_column(
        ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False
    )
    target_bom_line_id: Mapped[int] = mapped_column(ForeignKey("bom_lines.id"), nullable=False)
    override_material_id: Mapped[Optional[int]] = mapped_column(ForeignKey("materials.id"), nullable=True)
    override_quantity_fixed: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    override_quantity_formula: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    override_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    variant: Mapped["ProductVariant"] = relationship("ProductVariant", back_populates="overrides")

    __table_args__ = (
        UniqueConstraint("variant_id", "target_bom_line_id", name="variant_overrides_unique"),
    )
