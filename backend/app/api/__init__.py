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
