"""Seed sample prices for leather/PU sources (SA, ICR, IFT, NTH)

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-16

ราคาสมมติสำหรับ Prototype — ต้องอัพเดตด้วยราคาจริงก่อน Production
- S/A SA+PVC  : 450 บาท/เมตร
- S/A SUEDE   : 480 บาท/เมตร
- Italy Creslux PVC  : 650 บาท/เมตร
- Italy Futura NAPPA : 850 บาท/เมตร
- หนังเทียม NTH STANDARD : 350 บาท/เมตร
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

EFFECTIVE_DATE = "2026-01-01"


def upgrade():
    # S/A SA+PVC — WHEAT, IVORY, MOCHA @ 450 บาท/เมตร
    op.execute(f"""
        INSERT INTO upholster_prices (color_id, price, effective_date)
        SELECT col.id, 450.00, '{EFFECTIVE_DATE}'
        FROM upholster_colors col
        JOIN upholster_collections c ON col.collection_id = c.id
        JOIN upholster_sources s ON c.source_id = s.id
        WHERE s.code = 'SA' AND c.code = 'SA+PVC'
        ON CONFLICT DO NOTHING;
    """)

    # S/A SUEDE — GREY, BLACK @ 480 บาท/เมตร
    op.execute(f"""
        INSERT INTO upholster_prices (color_id, price, effective_date)
        SELECT col.id, 480.00, '{EFFECTIVE_DATE}'
        FROM upholster_colors col
        JOIN upholster_collections c ON col.collection_id = c.id
        JOIN upholster_sources s ON c.source_id = s.id
        WHERE s.code = 'SA' AND c.code = 'SUEDE'
        ON CONFLICT DO NOTHING;
    """)

    # Italy Creslux PVC — WHEAT, IVORY, BROWN, BLACK @ 650 บาท/เมตร
    op.execute(f"""
        INSERT INTO upholster_prices (color_id, price, effective_date)
        SELECT col.id, 650.00, '{EFFECTIVE_DATE}'
        FROM upholster_colors col
        JOIN upholster_collections c ON col.collection_id = c.id
        JOIN upholster_sources s ON c.source_id = s.id
        WHERE s.code = 'ICR' AND c.code = 'PVC'
        ON CONFLICT DO NOTHING;
    """)

    # Italy Futura NAPPA — CREAM, CARAMEL, SLATE @ 850 บาท/เมตร
    op.execute(f"""
        INSERT INTO upholster_prices (color_id, price, effective_date)
        SELECT col.id, 850.00, '{EFFECTIVE_DATE}'
        FROM upholster_colors col
        JOIN upholster_collections c ON col.collection_id = c.id
        JOIN upholster_sources s ON c.source_id = s.id
        WHERE s.code = 'IFT' AND c.code = 'NAPPA'
        ON CONFLICT DO NOTHING;
    """)

    # หนังเทียม NTH STANDARD — WHITE, BEIGE, DARK-GREY, BLACK @ 350 บาท/เมตร
    op.execute(f"""
        INSERT INTO upholster_prices (color_id, price, effective_date)
        SELECT col.id, 350.00, '{EFFECTIVE_DATE}'
        FROM upholster_colors col
        JOIN upholster_collections c ON col.collection_id = c.id
        JOIN upholster_sources s ON c.source_id = s.id
        WHERE s.code = 'NTH' AND c.code = 'STANDARD'
        ON CONFLICT DO NOTHING;
    """)


def downgrade():
    op.execute("""
        DELETE FROM upholster_prices
        WHERE color_id IN (
            SELECT col.id
            FROM upholster_colors col
            JOIN upholster_collections c ON col.collection_id = c.id
            JOIN upholster_sources s ON c.source_id = s.id
            WHERE s.code IN ('SA', 'ICR', 'IFT', 'NTH')
        );
    """)
