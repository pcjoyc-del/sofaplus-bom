"""Add material_type to upholster_sources, upholster_type to bom_lines

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-13

material_type ใน upholster_sources: ผ้า / หนัง / หนังเทียม
upholster_type ใน bom_lines: ผ้า / หนัง / หนังเทียม
ใช้ filter ตอน Generate Variants ใน Sprint 5
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # upholster_sources: ประเภทวัสดุ (ผ้า / หนัง / หนังเทียม)
    op.execute("""
        ALTER TABLE upholster_sources
        ADD COLUMN IF NOT EXISTS material_type VARCHAR(20) NOT NULL DEFAULT 'ผ้า'
    """)
    # อัปเดต sources ที่รู้ว่าเป็นหนัง
    op.execute("UPDATE upholster_sources SET material_type = 'หนัง'    WHERE code IN ('ICR','IFT')")
    op.execute("UPDATE upholster_sources SET material_type = 'หนังเทียม' WHERE code = 'NTH'")

    # bom_lines: Upholster Placeholder ระบุว่าต้องการผ้าหรือหนัง
    op.execute("""
        ALTER TABLE bom_lines
        ADD COLUMN IF NOT EXISTS upholster_type VARCHAR(20)
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE upholster_sources DROP COLUMN IF EXISTS material_type")
    op.execute("ALTER TABLE bom_lines DROP COLUMN IF EXISTS upholster_type")
