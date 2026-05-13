from sqlalchemy import String, Boolean, ForeignKey, Numeric, Text, Date, UniqueConstraint, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from datetime import date, datetime
from .base import Base


class UpholsterSource(Base):
    __tablename__ = "upholster_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    default_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    collections: Mapped[List["UpholsterCollection"]] = relationship("UpholsterCollection", back_populates="source")

    __table_args__ = (UniqueConstraint("name", name="upholster_sources_name_unique"),)


class UpholsterCollection(Base):
    __tablename__ = "upholster_collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("upholster_sources.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    source: Mapped["UpholsterSource"] = relationship("UpholsterSource", back_populates="collections")
    colors: Mapped[List["UpholsterColor"]] = relationship("UpholsterColor", back_populates="collection")

    __table_args__ = (UniqueConstraint("source_id", "code", name="upholster_coll_unique"),)


class UpholsterColor(Base):
    __tablename__ = "upholster_colors"

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(ForeignKey("upholster_collections.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    collection: Mapped["UpholsterCollection"] = relationship("UpholsterCollection", back_populates="colors")
    prices: Mapped[List["UpholsterPrice"]] = relationship("UpholsterPrice", back_populates="color")

    __table_args__ = (UniqueConstraint("collection_id", "code", name="upholster_col_unique"),)


class UpholsterPrice(Base):
    __tablename__ = "upholster_prices"

    id: Mapped[int] = mapped_column(primary_key=True)
    color_id: Mapped[int] = mapped_column(ForeignKey("upholster_colors.id"), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    color: Mapped["UpholsterColor"] = relationship("UpholsterColor", back_populates="prices")

    __table_args__ = (UniqueConstraint("color_id", "effective_date", name="upholster_prices_unique"),)
