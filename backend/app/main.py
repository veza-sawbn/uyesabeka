"""TASAP API application factory and entrypoint (uvicorn app.main:app)."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.routers import attendance, auth, dashboard, learners, providers, sites, stipends

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(
    title="TASAP API",
    description="Training Attendance, Stipend & Audit Platform",
    version=__version__,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(learners.router)
app.include_router(attendance.router)
app.include_router(dashboard.router)
app.include_router(stipends.router)
app.include_router(sites.router)
app.include_router(providers.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "version": __version__}


@app.get("/", tags=["health"])
def root():
    return {"service": "tasap-api", "docs": "/docs", "version": __version__}
