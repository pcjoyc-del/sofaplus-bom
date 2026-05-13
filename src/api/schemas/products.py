from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional
from datetime import datetime, date
from decimal import Decimal

UPHOLSTER_SECTIONS = ['ที่นั่ง', 'พนักพิง', 'ข้าง', 'ทั้งหมด']
UPHOLSTER_TYPES = ['ผ้า', 'หนัง', 'หนังเทียม']


# ── Product ───────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    category_id: int
    type_id: int
    model_id: int
    display_name: Optional[str] = None
    standard_width: Optional[Decimal] = None
    standard_depth: Optional[Decimal] = None
    standard_bed_depth: Optional[Decimal] = None
    status: str = "ACTIVE"
    notes: Optional[str] = None

class ProductUpdate(BaseModel):
    display_name: Optional[str] = None
    standard_width: Optional[Decimal] = None
    standard_depth: Optional[Decimal] = None
    standard_bed_depth: Optional[Decimal] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: int
    code: str
    category_id: int
    type_id: int
    model_id: int
    display_name: Optional[str]
    standard_width: Optional[Decimal]
    standard_depth: Optional[Decimal]
    standard_bed_depth: Optional[Decimal]
    status: str
    notes: Optional[str]
    is_active: bool
    bom_source: str
    bom_status: str = "NONE"   # NONE | DRAFT | ACTIVE — computed, not stored
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── BOM Version ───────────────────────────────────────────────────────────────

class BomVersionCreate(BaseModel):
    version_number: str = "1.0"
    notes: Optional[str] = None

class BomVersionResponse(BaseModel):
    id: int
    product_id: Optional[int]
    version_number: str
    bom_number: Optional[str]
    status: str
    effective_date: Optional[date]
    notes: Optional[str]
    created_at: datetime
    created_by: Optional[str]
    activated_at: Optional[datetime]
    model_config = ConfigDict(from_attributes=True)


# ── BOM Cost ──────────────────────────────────────────────────────────────────

class BomLineCostItem(BaseModel):
    bom_line_id: int
    line_order: int
    line_type: str
    material_id: Optional[int] = None
    material_name: Optional[str] = None
    mat_id_code: Optional[str] = None
    section: Optional[str] = None
    upholster_type: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    line_cost: Optional[float] = None
    price_date: Optional[date] = None

class BomCostResponse(BaseModel):
    bom_version_id: int
    bom_number: Optional[str]
    lines: list[BomLineCostItem]
    total_material_cost: float
    overhead_rate: Optional[float] = None      # % เช่น 3.5
    overhead_cost: Optional[float] = None      # บาท
    total_estimated_cost: Optional[float] = None  # material + overhead


# ── BOM Line ──────────────────────────────────────────────────────────────────

class BomLineCreate(BaseModel):
    line_type: str  # MATERIAL | UPHOLSTER_PLACEHOLDER
    line_order: int = 0
    # MATERIAL
    material_id: Optional[int] = None
    quantity_fixed: Optional[Decimal] = None
    unit: Optional[str] = None
    note: Optional[str] = None
    # UPHOLSTER_PLACEHOLDER
    section: Optional[str] = None
    upholster_type: Optional[str] = None   # ผ้า / หนัง / หนังเทียม
    quantity_formula: Optional[str] = None
    qty_base: Optional[Decimal] = None
    qty_width_step: Optional[Decimal] = None
    qty_step_increment: Optional[Decimal] = None

    @model_validator(mode="after")
    def check_line_type(self):
        if self.line_type == "MATERIAL" and not self.material_id:
            raise ValueError("material_id is required for MATERIAL lines")
        if self.line_type == "UPHOLSTER_PLACEHOLDER" and not self.section:
            raise ValueError("section is required for UPHOLSTER_PLACEHOLDER lines")
        return self

class BomLineUpdate(BaseModel):
    line_order: Optional[int] = None
    material_id: Optional[int] = None
    quantity_fixed: Optional[Decimal] = None
    unit: Optional[str] = None
    note: Optional[str] = None
    section: Optional[str] = None
    upholster_type: Optional[str] = None
    quantity_formula: Optional[str] = None
    qty_base: Optional[Decimal] = None
    qty_width_step: Optional[Decimal] = None
    qty_step_increment: Optional[Decimal] = None

class BomLineResponse(BaseModel):
    id: int
    bom_version_id: int
    line_order: int
    line_type: str
    material_id: Optional[int]
    section: Optional[str]
    upholster_type: Optional[str]
    quantity_fixed: Optional[Decimal]
    quantity_formula: Optional[str]
    unit: Optional[str]
    note: Optional[str]
    qty_base: Optional[Decimal]
    qty_width_step: Optional[Decimal]
    qty_step_increment: Optional[Decimal]
    model_config = ConfigDict(from_attributes=True)

class BomFullResponse(BaseModel):
    version: BomVersionResponse
    lines: list[BomLineResponse]


# ── Bulk Add Lines ────────────────────────────────────────────────────────────

class BomLineBulkItem(BaseModel):
    material_id: int
    quantity_fixed: float
    unit: Optional[str] = None
    note: Optional[str] = None
    line_order: Optional[int] = None

class BomLineBulkCreate(BaseModel):
    lines: list[BomLineBulkItem]
