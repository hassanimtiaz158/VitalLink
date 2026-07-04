"""SQLAlchemy engine, session factory, and declarative base.

The engine is created once at import time using the DATABASE_URL from
settings.  `get_db` is a FastAPI dependency that yields a scoped session
and guarantees cleanup after each request.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
