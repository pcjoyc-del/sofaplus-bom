from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
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
