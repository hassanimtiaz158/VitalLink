"""REST API route handlers for VitalLink (TDD §4).

Endpoints:
  POST   /donors                        — Register a new donor.
  PATCH  /donors/{id}/availability      — Toggle donor availability.
  POST   /hospitals                     — Register a hospital.
  POST   /requests                      — Submit a shortage request and trigger matching.
  GET    /requests/active               — List all open requests.
  GET    /requests/stats/supply         — Aggregated blood supply counts.
  GET    /matches/{id}/respond?token=   — One-click "I can help" response.
  PATCH  /matches/{id}/respond           — Update match status (accepted/declined).
"""
from fastapi import APIRouter

from app.api.donors import router as donors_router
from app.api.hospitals import router as hospitals_router
from app.api.requests import router as requests_router
from app.api.matches import router as matches_router

api_router = APIRouter()
api_router.include_router(donors_router)
api_router.include_router(hospitals_router)
api_router.include_router(requests_router)
api_router.include_router(matches_router)
