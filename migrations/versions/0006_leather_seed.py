"""Fix material_type for leather sources + seed collections/colors

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-15

- S/A, Italy Creslux, Italy Futura → material_type = 'หนัง'
- หนังเทียม → material_type = 'หนังเทียม'
- Add sample collections + colors for all leather sources
"""
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    # Fix material_type
    op.execute("""
        UPDATE upholster_sources SET material_type = 'หนัง'
        WHERE code IN ('SA', 'ICR', 'IFT');
    """)
    op.execute("""
        UPDATE upholster_sources SET material_type = 'หนังเทียม'
        WHERE code = 'NTH';
    """)

    # Collections for S/A (id = 4 in typical seed order, but use code-based lookup)
    op.execute("""
        INSERT INTO upholster_collections (source_id, code, name)
        SELECT id, 'SA+PVC', 'SA+PVC'
        FROM upholster_sources WHERE code = 'SA'
        ON CONFLICT DO NOTHING;
    """)
    op.execute("""
        INSERT INTO upholster_collections (source_id, code, name)
        SELECT id, 'SUEDE', 'SUEDE'
        FROM upholster_sources WHERE code = 'SA'
        ON CONFLICT DO NOTHING;
    """)

    # Colors for S/A SA+PVC
    op.execute("""
        INSERT INTO upholster_colors (collection_id, code, name)
        SELECT c.id, col.code, col.name
        FROM upholster_collections c
        JOIN upholster_sources s ON c.source_id = s.id
        CROSS JOIN (VALUES ('WHEAT','WHEAT'), ('IVORY','IVORY'), ('MOCHA','MOCHA')) AS col(code, name)
        WHERE s.code = 'SA' AND c.code = 'SA+PVC'
        ON CONFLICT DO NOTHING;
    """)
    op.execute("""
        INSERT INTO upholster_colors (collection_id, code, name)
        SELECT c.id, col.code, col.name
        FROM upholster_collections c
        JOIN upholster_sources s ON c.source_id = s.id
        CROSS JOIN (VALUES ('GREY','GREY'), ('BLACK','BLACK')) AS col(code, name)
        WHERE s.code = 'SA' AND c.code = 'SUEDE'
        ON CONFLICT DO NOTHING;
    """)

    # Collections + Colors for Italy Creslux (ICR)
    op.execute("""
        INSERT INTO upholster_collections (source_id, code, name)
        SELECT id, 'PVC', 'PVC'
        FROM upholster_sources WHERE code = 'ICR'
        ON CONFLICT DO NOTHING;
    """)
    op.execute("""
        INSERT INTO upholster_colors (collection_id, code, name)
        SELECT c.id, col.code, col.name
        FROM upholster_collections c
        JOIN upholster_sources s ON c.source_id = s.id
        CROSS JOIN (VALUES ('WHEAT','WHEAT'), ('IVORY','IVORY'), ('BROWN','BROWN'), ('BLACK','BLACK')) AS col(code, name)
        WHERE s.code = 'ICR' AND c.code = 'PVC'
        ON CONFLICT DO NOTHING;
    """)

    # Collections + Colors for Italy Futura (IFT)
    op.execute("""
        INSERT INTO upholster_collections (source_id, code, name)
        SELECT id, 'NAPPA', 'NAPPA'
        FROM upholster_sources WHERE code = 'IFT'
        ON CONFLICT DO NOTHING;
    """)
    op.execute("""
        INSERT INTO upholster_colors (collection_id, code, name)
        SELECT c.id, col.code, col.name
        FROM upholster_collections c
        JOIN upholster_sources s ON c.source_id = s.id
        CROSS JOIN (VALUES ('CREAM','CREAM'), ('CARAMEL','CARAMEL'), ('SLATE','SLATE')) AS col(code, name)
        WHERE s.code = 'IFT' AND c.code = 'NAPPA'
        ON CONFLICT DO NOTHING;
    """)

    # Collections + Colors for หนังเทียม (NTH)
    op.execute("""
        INSERT INTO upholster_collections (source_id, code, name)
        SELECT id, 'STANDARD', 'Standard PU'
        FROM upholster_sources WHERE code = 'NTH'
        ON CONFLICT DO NOTHING;
    """)
    op.execute("""
        INSERT INTO upholster_colors (collection_id, code, name)
        SELECT c.id, col.code, col.name
        FROM upholster_collections c
        JOIN upholster_sources s ON c.source_id = s.id
        CROSS JOIN (VALUES ('WHITE','WHITE'), ('BEIGE','BEIGE'), ('DARK-GREY','DARK-GREY'), ('BLACK','BLACK')) AS col(code, name)
        WHERE s.code = 'NTH' AND c.code = 'STANDARD'
        ON CONFLICT DO NOTHING;
    """)


def downgrade():
    op.execute("""
        UPDATE upholster_sources SET material_type = 'ผ้า'
        WHERE code IN ('SA', 'ICR', 'IFT', 'NTH');
    """)
