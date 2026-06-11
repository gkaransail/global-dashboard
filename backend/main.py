from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.config import settings
from core.exceptions import AppException, app_exception_handler, http_exception_handler, unhandled_exception_handler
from features import registry

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Institutional-grade market intelligence: options flow, reversal signals, insider tracking, sector rotation, and AI research.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Auto-discover and mount all features
_features_dir = Path(__file__).parent / "features"
registry.discover(_features_dir)
registry.mount_all(app, prefix=settings.api_prefix)


@app.get(f"{settings.api_prefix}/features")
async def list_features():
    """Returns all registered feature manifests — the frontend uses this to build the sidebar."""
    return registry.get_manifests()


@app.get(f"{settings.api_prefix}/health")
async def health():
    return {"status": "ok", "version": settings.version}


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.version,
        "features": [m["id"] for m in registry.get_manifests()],
        "docs": "/docs",
    }
