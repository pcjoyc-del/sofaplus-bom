import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

# เพิ่ม project root เข้า sys.path เพื่อ import src.api.models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ใช้ DIRECT_URL (port 5432) สำหรับ migrations — หลีกเลี่ยง pgbouncer transaction mode
direct_url = os.getenv("DIRECT_URL")
if not direct_url:
    raise ValueError("DIRECT_URL ไม่พบใน .env — ต้องใช้สำหรับ Alembic migrations")
config.set_main_option("sqlalchemy.url", direct_url)

# Import ทุก model เพื่อให้ autogenerate ทำงานถูกต้อง
from src.api.models.base import Base
from src.api.models import (  # noqa: F401
    master_data, materials, upholster, products, variants
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
