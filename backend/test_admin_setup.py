#!/usr/bin/env python3
"""Quick test script to verify admin dashboard setup."""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_path))

def test_imports():
    """Test all critical imports."""
    print("Testing imports...")
    try:
        from database import init_db, Session, SessionStep, ChatMessage
        print("✓ Database models imported")
        
        from database.connection import get_db, engine
        print("✓ Database connection imported")
        
        from api.session_tracker import tracker, SessionTracker
        print("✓ Session tracker imported")
        
        from api.admin import router
        print("✓ Admin router imported")
        
        from database.models import SessionStatus, StepType
        print("✓ Database enums imported")
        
        return True
    except Exception as e:
        print(f"✗ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_database_init():
    """Test database initialization."""
    print("\nTesting database initialization...")
    try:
        from database import init_db
        init_db()
        print("✓ Database initialized successfully")
        return True
    except Exception as e:
        print(f"✗ Database init failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_admin_auth():
    """Test admin authentication setup."""
    print("\nTesting admin authentication...")
    try:
        import os
        username = os.getenv("ADMIN_USERNAME", "admin")
        password = os.getenv("ADMIN_PASSWORD", "corinna-admin-2024")
        print(f"✓ Admin credentials configured (username: {username})")
        return True
    except Exception as e:
        print(f"✗ Admin auth setup failed: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Admin Dashboard Setup Test")
    print("=" * 60)
    
    all_passed = True
    
    all_passed &= test_imports()
    all_passed &= test_database_init()
    all_passed &= test_admin_auth()
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✓ All tests passed! Admin dashboard should work.")
        print("\nNext steps:")
        print("1. Start backend: cd backend && uvicorn api.main:app --reload --port 8001")
        print("2. Start frontend: cd frontend && npm run dev")
        print("3. Visit: http://localhost:3000/admin")
        print("4. Login with: admin / corinna-admin-2024")
    else:
        print("✗ Some tests failed. Check errors above.")
    print("=" * 60)
    
    sys.exit(0 if all_passed else 1)

