"""Add bom_number to bom_versions

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-13

bom_number = human-readable BOM identifier
Format: BOM-{CatCode}{TypeCode}{ModelCode}-v{version}
Example: BOM-SF2SCHANA-v1.0
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE bom_versions
        ADD COLUMN IF NOT EXISTS bom_number VARCHAR(50)
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE bom_versions DROP COLUMN IF EXISTS bom_number")
