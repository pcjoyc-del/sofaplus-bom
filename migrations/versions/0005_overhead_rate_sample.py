"""Seed default overhead rate 3.5% (Q5.1 placeholder)

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-13

overhead_rates: rate_type=GENERAL_MATERIAL, category_id=NULL (global),
percentage=3.5, effective_date=2026-01-01
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT INTO overhead_rates (rate_type, category_id, percentage, effective_date, note)
        VALUES ('GENERAL_MATERIAL', NULL, 3.50, '2026-01-01',
                'Q5.1 placeholder — อัตรา General Material (ด้าย/น็อต/กาว) 3.5%% ของต้นทุนวัสดุหลัก')
        ON CONFLICT DO NOTHING;
    """)


def downgrade():
    op.execute("DELETE FROM overhead_rates WHERE rate_type = 'GENERAL_MATERIAL' AND category_id IS NULL;")
