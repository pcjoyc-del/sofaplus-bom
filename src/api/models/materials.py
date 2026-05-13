from sqlalchemy import String, Boolean, ForeignKey, Numeric, Text, Date, UniqueConstraint, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from datetime import date, datetime
from .base import Base, TimestampMixin


class MaterialGroup(Base, TimestampMixin):
    __tablename__ = "material_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_general: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    materials: Mapped[List["Material"]] = relationship("Material", back_populates="group")

    __table_args__ = (UniqueConstraint("name", name="material_groups_name_unique"),)


class Material(Base, TimestampMixin):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    mat_id: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    group_id: Mapped[int] = mapped_column(ForeignKey("material_groups.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    group: Mapped["MaterialGroup"] = relationship("MaterialGroup", back_populates="materials")
    prices: Mapped[List["MaterialPrice"]] = relationship("MaterialPrice", back_populates="material")


class MaterialPrice(Base):
    __tablename__ = "material_prices"

    id: Mapped[int] = mapped_column(primary_key=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    material: Mapped["Material"] = relationship("Material", back_populates="prices")

    __table_args__ = (UniqueConstraint("material_id", "effective_date", name="material_prices_unique"),)
