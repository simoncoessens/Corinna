"""Database connection and session management."""

import os
from pathlib import Path
from contextlib import contextmanager
from typing import Generator

# Load environment variables from .env file if available
try:
    from dotenv import load_dotenv
    # Load .env from root directory first (project-wide config)
    root_path = Path(__file__).resolve().parent.parent.parent
    root_env_path = root_path / ".env"
    if root_env_path.exists():
        load_dotenv(root_env_path, override=False)  # Don't override if already set
    
    # Also load .env from backend directory (backend-specific overrides)
    backend_path = Path(__file__).resolve().parent.parent
    backend_env_path = backend_path / ".env"
    if backend_env_path.exists():
        load_dotenv(backend_env_path, override=True)  # Backend .env takes precedence
except ImportError:
    pass  # dotenv not installed, skip

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session as SQLAlchemySession

from .models import Base

# Database URL - defaults to SQLite for local dev only, requires PostgreSQL/Supabase in production
# In production (detected by presence of PORT env var or RENDER env), DATABASE_URL must be set
_is_production = os.getenv("RENDER") is not None or os.getenv("PORT") is not None

if _is_production:
    # In production, DATABASE_URL is required
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise ValueError(
            "DATABASE_URL environment variable is required in production. "
            "Please set it to your Supabase connection string."
        )
    if DATABASE_URL.startswith("sqlite"):
        raise ValueError(
            "SQLite cannot be used in production. "
            "Please set DATABASE_URL to your Supabase PostgreSQL connection string."
        )
else:
    # Local development: default to SQLite if not set, but prefer Supabase if available
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{Path(__file__).parent.parent / 'data' / 'corinna.db'}"
    )

# Handle Render's postgres:// vs postgresql:// URL format
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Create engine
# For SQLite, we need check_same_thread=False for FastAPI's async handling
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# For PostgreSQL (including Supabase), configure connection pooling and SSL
if DATABASE_URL.startswith("postgresql://"):
    # Supabase and most PostgreSQL providers require SSL
    # If sslmode is not in the URL, add it
    if "sslmode" not in DATABASE_URL:
        separator = "&" if "?" in DATABASE_URL else "?"
        DATABASE_URL = f"{DATABASE_URL}{separator}sslmode=require"
    
    # Connection pool settings for production
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        echo=False,
        pool_size=5,  # Number of connections to maintain
        max_overflow=10,  # Additional connections that can be created
        pool_pre_ping=True,  # Verify connections before using them
        pool_recycle=3600,  # Recycle connections after 1 hour
    )
else:
    # SQLite configuration
    engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Initialize the database, creating all tables."""
    # Create data directory if using SQLite
    if DATABASE_URL.startswith("sqlite"):
        db_path = Path(DATABASE_URL.replace("sqlite:///", ""))
        db_path.parent.mkdir(parents=True, exist_ok=True)
    
    Base.metadata.create_all(bind=engine)
    print("✓ Database initialized")


def get_db() -> Generator[SQLAlchemySession, None, None]:
    """
    Dependency for FastAPI endpoints that need database access.
    
    Usage:
        @app.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[SQLAlchemySession, None, None]:
    """
    Context manager for database access outside of FastAPI endpoints.
    
    Usage:
        with get_db_context() as db:
            session = db.query(Session).first()
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

