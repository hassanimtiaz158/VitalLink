"""Application configuration and database session management.

Exports:
  settings — Pydantic Settings loaded from environment variables / .env.
  engine   — SQLAlchemy engine bound to the PostGIS database.
  Base     — Declarative base for all ORM models.
  get_db   — FastAPI dependency yielding a scoped database session.
"""
from app.core.config import settings
from app.core.database import Base, get_db, engine

__all__ = ["settings", "Base", "get_db", "engine"]
