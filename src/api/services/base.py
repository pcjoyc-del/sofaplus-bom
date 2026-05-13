from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from typing import TypeVar, Generic, Type, Any
from fastapi import HTTPException, status
from ..models.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class CRUDBase(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: int) -> ModelType | None:
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()

    async def get_all(
        self,
        db: AsyncSession,
        *,
        active_only: bool = True,
        filters: list[Any] | None = None,
        limit: int = 500,
    ) -> list[ModelType]:
        q = select(self.model)
        if active_only and hasattr(self.model, "is_active"):
            q = q.where(self.model.is_active == True)
        if filters:
            for f in filters:
                q = q.where(f)
        q = q.limit(limit)
        result = await db.execute(q)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, *, obj_in: dict) -> ModelType:
        try:
            obj = self.model(**obj_in)
            db.add(obj)
            await db.commit()
            await db.refresh(obj)
            return obj
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Duplicate entry — code or name already exists",
            )

    async def update(self, db: AsyncSession, *, db_obj: ModelType, obj_in: dict) -> ModelType:
        try:
            for k, v in obj_in.items():
                setattr(db_obj, k, v)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Duplicate entry — code or name already exists",
            )

    async def soft_delete(self, db: AsyncSession, *, id: int) -> bool:
        obj = await self.get(db, id)
        if obj is None:
            return False
        if hasattr(obj, "is_active"):
            obj.is_active = False
            await db.commit()
        return True
