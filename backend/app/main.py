"""VitalLink API — FastAPI application entrypoint.

Mounts all REST routes under / and exposes a /health endpoint for
container orchestration and uptime monitoring. A background task
retries queued notification emails on a 60-second interval (TDD §6).
"""
import asyncio
import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.database import SessionLocal
from app.notifications import retry_fallback_queue

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background notification retry loop on app startup."""
    retry_task = asyncio.create_task(_retry_loop())
    yield
    retry_task.cancel()
    try:
        await retry_task
    except asyncio.CancelledError:
        pass


async def _retry_loop():
    """Periodically retry queued notification emails (TDD §6)."""
    while True:
        await asyncio.sleep(60)
        try:
            db = SessionLocal()
            try:
                result = retry_fallback_queue(db)
                if result["sent"] > 0:
                    logger.info("Background retry: sent %d, remaining %d", result["sent"], result["remaining"])
            finally:
                db.close()
        except Exception:
            logger.exception("Background retry loop error")


app = FastAPI(title="VitalLink API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://vitallink.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
