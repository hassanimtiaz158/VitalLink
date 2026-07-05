"""REST API route handlers for VitalLink.

Endpoints:
  POST   /donors                        — Register a new donor.
  PATCH  /donors/{id}/availability      — Toggle donor availability.
  POST   /requesters                    — Register a requester.
  POST   /requests                      — Submit a shortage request.
  GET    /requests/{id}/candidate-donors — Get ranked candidate donors.
  POST   /requests/{id}/accept-donor/{donor_id} — Requester accepts a donor.
  POST   /requests/{id}/verify          — Verify a request with code.
  PATCH  /requests/{id}/status          — Update request status.
  GET    /requests/active               — List all open requests.
  GET    /requests/stats/supply         — Aggregated blood supply counts.
  PATCH  /matches/{id}/respond          — Donor confirms/declines.
  GET    /matches/{id}/messages         — Get chat messages.
  POST   /matches/{id}/messages         — Send a chat message.
  POST   /donors/{id}/block             — Block a requester.
"""
from fastapi import APIRouter

from app.api.donors import router as donors_router
from app.api.requesters import router as requesters_router
from app.api.requests import router as requests_router
from app.api.matches import router as matches_router

api_router = APIRouter()
api_router.include_router(donors_router)
api_router.include_router(requesters_router)
api_router.include_router(requests_router)
api_router.include_router(matches_router)
