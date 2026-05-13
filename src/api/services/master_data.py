from .base import CRUDBase
from ..models.master_data import Category, ProductType, ProductModel

category_service = CRUDBase(Category)
type_service = CRUDBase(ProductType)
model_service = CRUDBase(ProductModel)
