"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2026-05-13

สร้างทุก table ในสถานะ final (รวม ALTER TABLE ทั้งหมดจาก Schema R3 แล้ว)
ใช้ CREATE TABLE IF NOT EXISTS เพื่อรองรับทั้ง fresh DB และ stamp บน existing DB
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Section A: Product Tree ───────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS categories (
          id            SERIAL PRIMARY KEY,
          code          VARCHAR(10)  UNIQUE NOT NULL,
          name          VARCHAR(100) NOT NULL,
          display_order INT DEFAULT 0,
          is_active     BOOLEAN DEFAULT TRUE,
          created_at    TIMESTAMP DEFAULT NOW(),
          updated_at    TIMESTAMP DEFAULT NOW(),
          CONSTRAINT categories_name_unique UNIQUE (name)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS types (
          id          SERIAL PRIMARY KEY,
          category_id INT NOT NULL REFERENCES categories(id),
          code        VARCHAR(30)  NOT NULL,
          name        VARCHAR(100) NOT NULL,
          is_active   BOOLEAN DEFAULT TRUE,
          created_at  TIMESTAMP DEFAULT NOW(),
          updated_at  TIMESTAMP DEFAULT NOW(),
          CONSTRAINT types_cat_code_unique UNIQUE (category_id, code)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS models (
          id          SERIAL PRIMARY KEY,
          category_id INT NOT NULL REFERENCES categories(id),
          code        VARCHAR(30) NOT NULL,
          name        VARCHAR(100),
          is_active   BOOLEAN DEFAULT TRUE,
          created_at  TIMESTAMP DEFAULT NOW(),
          updated_at  TIMESTAMP DEFAULT NOW(),
          CONSTRAINT models_cat_code_unique UNIQUE (category_id, code)
        )
    """)

    # ── Section B: Material Master ────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS material_groups (
          id         SERIAL PRIMARY KEY,
          code       VARCHAR(30)  UNIQUE NOT NULL,
          name       VARCHAR(100) NOT NULL,
          is_general BOOLEAN DEFAULT FALSE,
          is_active  BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT material_groups_name_unique UNIQUE (name)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS materials (
          id          SERIAL PRIMARY KEY,
          mat_id      VARCHAR(30)  UNIQUE NOT NULL,
          group_id    INT NOT NULL REFERENCES material_groups(id),
          name        VARCHAR(200) NOT NULL,
          unit        VARCHAR(20)  NOT NULL,
          description TEXT,
          is_active   BOOLEAN DEFAULT TRUE,
          created_at  TIMESTAMP DEFAULT NOW(),
          updated_at  TIMESTAMP DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS material_prices (
          id             SERIAL PRIMARY KEY,
          material_id    INT NOT NULL REFERENCES materials(id),
          price          NUMERIC(12,2) NOT NULL,
          effective_date DATE NOT NULL,
          note           TEXT,
          created_at     TIMESTAMP DEFAULT NOW(),
          created_by     VARCHAR(100),
          CONSTRAINT material_prices_unique UNIQUE (material_id, effective_date)
        )
    """)

    # ── Section C: Upholster ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS upholster_sources (
          id           SERIAL PRIMARY KEY,
          code         VARCHAR(20)  UNIQUE NOT NULL,
          name         VARCHAR(100) NOT NULL,
          default_unit VARCHAR(20)  NOT NULL,
          is_active    BOOLEAN DEFAULT TRUE,
          created_at   TIMESTAMP DEFAULT NOW(),
          CONSTRAINT upholster_sources_name_unique UNIQUE (name)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS upholster_collections (
          id         SERIAL PRIMARY KEY,
          source_id  INT NOT NULL REFERENCES upholster_sources(id),
          code       VARCHAR(50) NOT NULL,
          name       VARCHAR(100),
          is_active  BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT upholster_coll_unique UNIQUE (source_id, code)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS upholster_colors (
          id            SERIAL PRIMARY KEY,
          collection_id INT NOT NULL REFERENCES upholster_collections(id),
          code          VARCHAR(50) NOT NULL,
          name          VARCHAR(100),
          is_active     BOOLEAN DEFAULT TRUE,
          created_at    TIMESTAMP DEFAULT NOW(),
          CONSTRAINT upholster_col_unique UNIQUE (collection_id, code)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS upholster_prices (
          id             SERIAL PRIMARY KEY,
          color_id       INT NOT NULL REFERENCES upholster_colors(id),
          price          NUMERIC(12,2) NOT NULL,
          effective_date DATE NOT NULL,
          note           TEXT,
          created_at     TIMESTAMP DEFAULT NOW(),
          CONSTRAINT upholster_prices_unique UNIQUE (color_id, effective_date)
        )
    """)

    # ── Section D: Products + BOM ─────────────────────────────────────────────
    # รวม: standard_* (K), bom_source/inherits_bom_from_type (I) เข้าไปแล้ว
    op.execute("""
        CREATE TABLE IF NOT EXISTS products (
          id                     SERIAL PRIMARY KEY,
          code                   VARCHAR(50) UNIQUE NOT NULL,
          category_id            INT NOT NULL REFERENCES categories(id),
          type_id                INT NOT NULL REFERENCES types(id),
          model_id               INT NOT NULL REFERENCES models(id),
          display_name           VARCHAR(200),
          standard_width         NUMERIC(10,2),
          standard_depth         NUMERIC(10,2),
          standard_bed_depth     NUMERIC(10,2),
          status                 VARCHAR(20) DEFAULT 'DRAFT',
          notes                  TEXT,
          is_active              BOOLEAN DEFAULT TRUE,
          bom_source             VARCHAR(20) NOT NULL DEFAULT 'OWN',
          inherits_bom_from_type BOOLEAN DEFAULT FALSE,
          created_at             TIMESTAMP DEFAULT NOW(),
          updated_at             TIMESTAMP DEFAULT NOW(),
          CONSTRAINT products_unique UNIQUE (category_id, type_id, model_id),
          CONSTRAINT products_bom_source_check CHECK (bom_source IN ('OWN', 'TYPE_INHERITED'))
        )
    """)
    # รวม: type_id, reference_model_id, reference_width (Section I) เข้าไปแล้ว
    op.execute("""
        CREATE TABLE IF NOT EXISTS bom_versions (
          id                 SERIAL PRIMARY KEY,
          product_id         INT REFERENCES products(id),
          type_id            INT REFERENCES types(id),
          reference_model_id INT REFERENCES models(id),
          reference_width    NUMERIC(10,2),
          version_number     VARCHAR(10) NOT NULL,
          status             VARCHAR(20) DEFAULT 'DRAFT',
          effective_date     DATE,
          notes              TEXT,
          created_at         TIMESTAMP DEFAULT NOW(),
          created_by         VARCHAR(100),
          activated_at       TIMESTAMP,
          archived_at        TIMESTAMP,
          CONSTRAINT bom_versions_unique UNIQUE (product_id, version_number),
          CONSTRAINT bom_versions_scope_check CHECK (
            (product_id IS NOT NULL AND type_id IS NULL)
            OR (product_id IS NULL  AND type_id IS NOT NULL)
          )
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS bom_versions_one_active
          ON bom_versions (product_id) WHERE status = 'ACTIVE'
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS bom_versions_type_one_active
          ON bom_versions (type_id) WHERE status = 'ACTIVE' AND type_id IS NOT NULL
    """)
    # รวม: qty_base/width_step/step_increment (Section J) เข้าไปแล้ว
    # qty_check ขยายให้รองรับ qty_base ด้วย
    op.execute("""
        CREATE TABLE IF NOT EXISTS bom_lines (
          id                 SERIAL PRIMARY KEY,
          bom_version_id     INT NOT NULL REFERENCES bom_versions(id) ON DELETE CASCADE,
          line_order         INT NOT NULL DEFAULT 0,
          line_type          VARCHAR(30) NOT NULL,
          material_id        INT REFERENCES materials(id),
          section            VARCHAR(50),
          quantity_fixed     NUMERIC(12,4),
          quantity_formula   TEXT,
          unit               VARCHAR(20),
          note               TEXT,
          qty_base           NUMERIC(10,4),
          qty_width_step     NUMERIC(6,2),
          qty_step_increment NUMERIC(10,4),
          CONSTRAINT bom_lines_qty_check CHECK (
            (quantity_fixed   IS NOT NULL AND quantity_fixed > 0)
            OR (quantity_formula IS NOT NULL AND LENGTH(quantity_formula) > 0)
            OR (qty_base IS NOT NULL)
          ),
          CONSTRAINT bom_lines_type_check CHECK (
            (line_type = 'MATERIAL'             AND material_id IS NOT NULL AND section IS NULL)
            OR (line_type = 'UPHOLSTER_PLACEHOLDER' AND material_id IS NULL)
          )
        )
    """)

    # ── Section E: Variants ───────────────────────────────────────────────────
    # width เท่านั้น — depth/bed_depth ถูก drop (Section K)
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_variants (
          id                 SERIAL PRIMARY KEY,
          sku                VARCHAR(100) UNIQUE NOT NULL,
          product_id         INT NOT NULL REFERENCES products(id),
          upholster_color_id INT NOT NULL REFERENCES upholster_colors(id),
          width              NUMERIC(10,2),
          selling_price      NUMERIC(12,2),
          status             VARCHAR(20) DEFAULT 'ACTIVE',
          is_active          BOOLEAN DEFAULT TRUE,
          created_at         TIMESTAMP DEFAULT NOW(),
          updated_at         TIMESTAMP DEFAULT NOW(),
          CONSTRAINT product_variants_unique UNIQUE (product_id, upholster_color_id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS variant_bom_overrides (
          id                        SERIAL PRIMARY KEY,
          variant_id                INT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
          target_bom_line_id        INT NOT NULL REFERENCES bom_lines(id),
          override_material_id      INT REFERENCES materials(id),
          override_quantity_fixed   NUMERIC(12,4),
          override_quantity_formula TEXT,
          override_note             TEXT,
          created_at                TIMESTAMP DEFAULT NOW(),
          created_by                VARCHAR(100),
          CONSTRAINT variant_overrides_unique UNIQUE (variant_id, target_bom_line_id)
        )
    """)

    # ── Section F: Overhead ───────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS overhead_rates (
          id              SERIAL PRIMARY KEY,
          rate_type       VARCHAR(50) NOT NULL,
          category_id     INT REFERENCES categories(id),
          amount_per_unit NUMERIC(12,2),
          percentage      NUMERIC(5,2),
          effective_date  DATE NOT NULL,
          note            TEXT,
          created_at      TIMESTAMP DEFAULT NOW()
        )
    """)

    # ── Phase 2: Product BOM Overrides ────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_bom_overrides (
          id                          SERIAL PRIMARY KEY,
          product_id                  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          target_bom_line_id          INT NOT NULL REFERENCES bom_lines(id),
          override_material_id        INT REFERENCES materials(id),
          override_quantity_fixed     NUMERIC(12,4),
          override_quantity_formula   TEXT,
          override_qty_base           NUMERIC(10,4),
          override_qty_width_step     NUMERIC(6,2),
          override_qty_step_increment NUMERIC(10,4),
          override_note               TEXT,
          created_at                  TIMESTAMP DEFAULT NOW(),
          created_by                  VARCHAR(100),
          CONSTRAINT product_bom_overrides_unique UNIQUE (product_id, target_bom_line_id)
        )
    """)

    # ── Indexes ───────────────────────────────────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS idx_types_category ON types(category_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_models_category ON models(category_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_status ON products(status) WHERE is_active = TRUE")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bom_versions_product ON bom_versions(product_id, status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bom_versions_type ON bom_versions(type_id, status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_bom_source ON products(bom_source)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bom_lines_version ON bom_lines(bom_version_id, line_order)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_material_prices_lookup ON material_prices(material_id, effective_date DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_upholster_prices_lookup ON upholster_prices(color_id, effective_date DESC)")

    # ── Views ─────────────────────────────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_current_material_prices AS
        SELECT DISTINCT ON (material_id) material_id, price, effective_date
        FROM material_prices
        WHERE effective_date <= CURRENT_DATE
        ORDER BY material_id, effective_date DESC
    """)
    op.execute("""
        CREATE OR REPLACE VIEW v_current_upholster_prices AS
        SELECT DISTINCT ON (color_id) color_id, price, effective_date
        FROM upholster_prices
        WHERE effective_date <= CURRENT_DATE
        ORDER BY color_id, effective_date DESC
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_current_upholster_prices")
    op.execute("DROP VIEW IF EXISTS v_current_material_prices")
    op.execute("DROP TABLE IF EXISTS product_bom_overrides CASCADE")
    op.execute("DROP TABLE IF EXISTS variant_bom_overrides CASCADE")
    op.execute("DROP TABLE IF EXISTS product_variants CASCADE")
    op.execute("DROP TABLE IF EXISTS overhead_rates CASCADE")
    op.execute("DROP TABLE IF EXISTS bom_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS bom_versions CASCADE")
    op.execute("DROP TABLE IF EXISTS products CASCADE")
    op.execute("DROP TABLE IF EXISTS upholster_prices CASCADE")
    op.execute("DROP TABLE IF EXISTS upholster_colors CASCADE")
    op.execute("DROP TABLE IF EXISTS upholster_collections CASCADE")
    op.execute("DROP TABLE IF EXISTS upholster_sources CASCADE")
    op.execute("DROP TABLE IF EXISTS material_prices CASCADE")
    op.execute("DROP TABLE IF EXISTS materials CASCADE")
    op.execute("DROP TABLE IF EXISTS material_groups CASCADE")
    op.execute("DROP TABLE IF EXISTS models CASCADE")
    op.execute("DROP TABLE IF EXISTS types CASCADE")
    op.execute("DROP TABLE IF EXISTS categories CASCADE")
