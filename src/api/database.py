from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from .config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.async_database_url,
    echo=settings.APP_DEBUG,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    # pgbouncer transaction mode ไม่รองรับ prepared statements
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
