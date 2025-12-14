#!/usr/bin/env python3
"""
Initialize Supabase database with schema.

This script can be used to verify your Supabase connection and initialize
the database schema programmatically (alternative to running the SQL migration).

Usage:
    python -m database.init_supabase
"""

import os
import sys
from pathlib import Path

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    # Load .env from backend directory
    backend_path = Path(__file__).resolve().parent.parent
    env_path = backend_path / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass  # dotenv not installed, skip

# Add backend to path
backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from database.connection import DATABASE_URL, engine, init_db
from database.models import Base


def main():
    """Initialize the Supabase database."""
    print("=" * 60)
    print("Supabase Database Initialization")
    print("=" * 60)
    
    # Check if DATABASE_URL is set
    if DATABASE_URL.startswith("sqlite"):
        print("⚠️  Warning: Using SQLite instead of PostgreSQL/Supabase")
        print(f"   Current DATABASE_URL: {DATABASE_URL}")
        print("   Set DATABASE_URL environment variable to your Supabase connection string")
        print("   Make sure .env file exists in backend/ directory with DATABASE_URL")
        sys.exit(1)
    elif DATABASE_URL.startswith("postgresql://"):
        print(f"✓ Using PostgreSQL database")
        # Mask password in output
        masked_url = DATABASE_URL.split("@")[0].split(":")[0:2]
        if len(masked_url) == 2:
            print(f"   Database: {masked_url[0]}://{masked_url[1]}:****@...")
        else:
            print(f"   Database: PostgreSQL")
    else:
        print(f"⚠️  Unknown database type: {DATABASE_URL[:20]}...")
    
    print("\nInitializing database schema...")
    
    try:
        # Test connection
        with engine.connect() as conn:
            print("✓ Database connection successful")
        
        # Initialize schema
        init_db()
        print("✓ Database schema created/verified")
        
        # Verify tables exist
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        expected_tables = ["sessions", "session_steps", "chat_messages"]
        missing_tables = [t for t in expected_tables if t not in tables]
        
        if missing_tables:
            print(f"⚠️  Missing tables: {', '.join(missing_tables)}")
        else:
            print(f"✓ All tables present: {', '.join(tables)}")
        
        print("\n" + "=" * 60)
        print("✓ Database initialization complete!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Error initializing database: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
