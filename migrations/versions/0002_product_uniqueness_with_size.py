"""Product uniqueness includes standard size (width, depth, bed_depth)

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-13

เปลี่ยน unique constraint ของ products จาก (cat, type, model)
เป็น (cat, type, model, width, depth, bed_depth)
ใช้ COALESCE(col, 0) เพื่อ handle NULL — 0cm ไม่ใช่ค่า valid จริง
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unique")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS products_unique ON products (
            category_id, type_id, model_id,
            COALESCE(standard_width,    0),
            COALESCE(standard_depth,    0),
            COALESCE(standard_bed_depth, 0)
        )
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS products_unique")
    op.execute("""
        ALTER TABLE products
        ADD CONSTRAINT products_unique UNIQUE (category_id, type_id, model_id)
    """)
