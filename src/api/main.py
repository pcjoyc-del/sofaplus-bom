from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .routes import health, categories, types, product_models, material_groups, materials, upholster, products, variants

settings = get_settings()

app = FastAPI(
    title="Sofa Plus+ BOM API",
    description="Bill of Materials Management System — Sofa House 1998 Co., Ltd.",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(types.router, prefix="/api")
app.include_router(product_models.router, prefix="/api")
app.include_router(material_groups.router, prefix="/api")
app.include_router(materials.router, prefix="/api")
app.include_router(upholster.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(variants.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Sofa Plus+ BOM API", "docs": "/api/docs"}
