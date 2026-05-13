from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    code: str
    name: str
    display_order: int = 0

class CategoryUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

class CategoryResponse(BaseModel):
    id: int
    code: str
    name: str
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── ProductType ───────────────────────────────────────────────────────────────

class TypeCreate(BaseModel):
    category_id: int
    code: str
    name: str

class TypeUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None

class TypeResponse(BaseModel):
    id: int
    category_id: int
    code: str
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── ProductModel ──────────────────────────────────────────────────────────────

class ProductModelCreate(BaseModel):
    category_id: int
    code: str
    name: Optional[str] = None

class ProductModelUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None

class ProductModelResponse(BaseModel):
    id: int
    category_id: int
    code: str
    name: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
