from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


# ── UpholsterSource ───────────────────────────────────────────────────────────

class UpholsterSourceCreate(BaseModel):
    code: str
    name: str
    default_unit: str

class UpholsterSourceUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    default_unit: Optional[str] = None
    is_active: Optional[bool] = None

class UpholsterSourceResponse(BaseModel):
    id: int
    code: str
    name: str
    default_unit: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── UpholsterCollection ───────────────────────────────────────────────────────

class UpholsterCollectionCreate(BaseModel):
    source_id: int
    code: str
    name: Optional[str] = None

class UpholsterCollectionUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None

class UpholsterCollectionResponse(BaseModel):
    id: int
    source_id: int
    code: str
    name: Optional[str]
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── UpholsterColor ────────────────────────────────────────────────────────────

class UpholsterColorCreate(BaseModel):
    collection_id: int
    code: str
    name: Optional[str] = None

class UpholsterColorUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None

class UpholsterColorResponse(BaseModel):
    id: int
    collection_id: int
    code: str
    name: Optional[str]
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── UpholsterPrice ────────────────────────────────────────────────────────────

class UpholsterPriceCreate(BaseModel):
    price: Decimal
    effective_date: date
    note: Optional[str] = None

class UpholsterPriceResponse(BaseModel):
    id: int
    color_id: int
    price: Decimal
    effective_date: date
    note: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
