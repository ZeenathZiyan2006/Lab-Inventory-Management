import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, Base
from app.seed.demo_data import seed_database
import logging

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.labs import router as labs_router
from app.api.inventory import router as inventory_router
from app.api.qr import router as qr_router
from app.api.faults import router as faults_router
from app.api.transfers import router as transfers_router
from app.api.requests import router as requests_router
from app.api.timetable import router as timetable_router
from app.api.reports import router as reports_router
from app.api.notifications import router as notifications_router
from app.api.ai import router as ai_router
from app.api.audit import router as audit_router

logger = logging.getLogger("uvicorn")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables and seed demo data
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    try:
        seed_database(reset=False)
    except Exception as e:
        logger.warning(f"Seed initialization note: {e}")
    yield
    # Shutdown

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=f"{settings.PROJECT_SUBTITLE} — {settings.COLLEGE_NAME}, {settings.DEPARTMENT}",
    version="1.0.0",
    lifespan=lifespan
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# CORS Middleware (Supports localhost, local network Wi-Fi IP, and college lab subnets)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Mount API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(labs_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(qr_router, prefix="/api")
app.include_router(faults_router, prefix="/api")
app.include_router(transfers_router, prefix="/api")
app.include_router(requests_router, prefix="/api")
app.include_router(timetable_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(audit_router, prefix="/api")

@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "institution": settings.COLLEGE_NAME,
        "department": settings.DEPARTMENT,
        "system": settings.PROJECT_NAME
    }
