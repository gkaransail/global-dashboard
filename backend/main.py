from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.config import settings
from features import registry

app = FastAPI(title=settings.app_name, version=settings.version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
