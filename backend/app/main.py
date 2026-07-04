from fastapi import FastAPI

from app.api import api_router

app = FastAPI(title="VitalLink API", version="0.1.0")
app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
