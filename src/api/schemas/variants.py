from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class VariantCreate(BaseModel):
    upholster_color_id: int
    width: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None


class VariantUpdate(BaseModel):
    width: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    status: Optional[str] = None


class VariantBulkCreate(BaseModel):
    color_ids: list[int]
    selling_price: Optional[Decimal] = None
    width: Optional[Decimal] = None


class VariantPreviewItem(BaseModel):
    upholster_color_id: int
    sku: str
    source_code: str
    source_name: str
    collection_code: str
    color_code: str
    already_exists: bool


class ResolvedBomLine(BaseModel):
    bom_line_id: int
    line_order: int
    line_type: str                        # MATERIAL | UPHOLSTER
    # Material fields
    material_id: Optional[int] = None
    material_name: Optional[str] = None
    mat_id_code: Optional[str] = None
    # Upholster fields
    section: Optional[str] = None
    source_name: Optional[str] = None
    collection_code: Optional[str] = None
    color_code: Optional[str] = None
    # Qty & cost
    unit: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    line_cost: Optional[float] = None
    price_date: Optional[date] = None
    # Override flag
    is_overridden: bool = False
    qty_formula_used: bool = False        # True ถ้าใช้ Linear Step


class ResolvedBomResponse(BaseModel):
    variant_id: int
    sku: str
    product_name: Optional[str]
    bom_number: Optional[str]
    variant_width: Optional[float]
    standard_width: Optional[float]
    lines: list[ResolvedBomLine]
    total_material_cost: float
    overhead_rate: Optional[float] = None
    overhead_cost: Optional[float] = None
    total_estimated_cost: float


class VariantResponse(BaseModel):
    id: int
    sku: str
    product_id: int
    upholster_color_id: int
    width: Optional[Decimal]
    selling_price: Optional[Decimal]
    status: str
    is_active: bool
    created_at: datetime
    # Enriched fields (computed in service)
    source_code: Optional[str] = None
    source_name: Optional[str] = None
    collection_code: Optional[str] = None
    color_code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
