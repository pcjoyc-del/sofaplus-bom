from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


# ── MaterialGroup ─────────────────────────────────────────────────────────────

class MaterialGroupCreate(BaseModel):
    code: str
    name: str
    is_general: bool = False

class MaterialGroupUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    is_general: Optional[bool] = None
    is_active: Optional[bool] = None

class MaterialGroupResponse(BaseModel):
    id: int
    code: str
    name: str
    is_general: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Material ──────────────────────────────────────────────────────────────────

class MaterialCreate(BaseModel):
    mat_id: str
    group_id: int
    name: str
    unit: str
    description: Optional[str] = None

class MaterialUpdate(BaseModel):
    mat_id: Optional[str] = None
    group_id: Optional[int] = None
    name: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class MaterialResponse(BaseModel):
    id: int
    mat_id: str
    group_id: int
    name: str
    unit: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── MaterialPrice ─────────────────────────────────────────────────────────────

class MaterialPriceCreate(BaseModel):
    price: Decimal
    effective_date: date
    note: Optional[str] = None

class MaterialPriceResponse(BaseModel):
    id: int
    material_id: int
    price: Decimal
    effective_date: date
    note: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
