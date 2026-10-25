import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "SMVITM AI-Powered Smart Inventory Management System"
    PROJECT_SUBTITLE: str = "AI-Powered Smart Inventory Management System for College Laboratories"
    COLLEGE_NAME: str = "Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM)"
    COLLEGE_LOCATION: str = "Bantakal, Udupi, Karnataka, India"
    DEPARTMENT: str = "Department of Artificial Intelligence and Data Science"
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "smvitm-secret-key-ai-ds-secure-token-2026-production-ready")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database: configured for PostgreSQL with automated SQLite fallback if PostgreSQL is not running
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./inventory_smvitm.db")
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
    
    # SMTP Email configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "inventory-alerts@sode-edu.in")
    SMTP_ENABLED: bool = os.getenv("SMTP_ENABLED", "false").lower() == "true"

    # AI Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
