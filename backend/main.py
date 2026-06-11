"""
FinanceIQ backend — FastAPI application entry point.

Startup sequence
────────────────
  1. FastAPI app created
  2. Feature auto-discovery: every features/<name>/ with manifest.py + router.py
     is loaded and mounted at /api/v1/<name>
  3. Background scheduler starts — pre-warms expensive cache entries on a fixed
     schedule so users always hit warm cache (see core/scheduler.py for details)
  4. App ready — uvicorn begins accepting requests

Shutdown sequence
─────────────────
  1. FastAPI signals lifespan context to exit
  2. Scheduler shuts down gracefully (waits for running jobs to finish)
  3. Process exits
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core import scheduler as _scheduler
from core.config import settings
from core.exceptions import AppException, app_exception_handler, http_exception_handler, unhandled_exception_handler
from features import registry


# ── Lifespan: start/stop background scheduler ────────────────────────────────
# FastAPI lifespan replaces the old @app.on_event("startup") pattern.
# Code before `yield` runs at startup; code after `yield` runs at shutdown.

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    _scheduler.start()
    yield
    # ── Shutdown ──
    _scheduler.shutdown()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Institutional-grade market intelligence: options flow, reversal signals, insider tracking, sector rotation, and AI research.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
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


# ── Built-in endpoints ────────────────────────────────────────────────────────

@app.get(f"{settings.api_prefix}/features")
async def list_features():
    """Returns all registered feature manifests — the frontend uses this to build the sidebar."""
    return registry.get_manifests()


@app.get(f"{settings.api_prefix}/health")
async def health():
    return {"status": "ok", "version": settings.version}


@app.get(f"{settings.api_prefix}/scheduler/status")
async def scheduler_status():
    """
    Live status of all background warm-up jobs.

    Shows each job's last run time, status (ok/error), and when it will
    next fire. Useful for verifying the cache is being kept warm.
    """
    return _scheduler.get_status()


@app.get("/")
async def root():
    return {
        "name":     settings.app_name,
        "version":  settings.version,
        "features": [m["id"] for m in registry.get_manifests()],
        "docs":     "/docs",
    }
