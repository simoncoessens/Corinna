# Database Setup

This directory contains the database models and connection configuration for the admin dashboard.

## Quick Start

### Supabase (Recommended for All Environments)

**All environments (local and production) should use Supabase.**

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Run the migration**: Copy `supabase_migration.sql` and run it in Supabase SQL Editor
3. **Set environment variable** in `.env` file:
   ```bash
   DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-[REGION].pooler.supabase.com:5432/postgres
   ```
   Use the **Session pooler** connection string from Supabase Dashboard.
4. **Verify setup**: Run `python -m database.init_supabase`

**Note**: In production, `DATABASE_URL` is **required** and must point to Supabase. SQLite fallback is only for local development.

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions.

## Files

- `models.py` - SQLAlchemy models for sessions, steps, and chat messages
- `connection.py` - Database connection and session management
- `supabase_migration.sql` - SQL migration for Supabase
- `init_supabase.py` - Python script to initialize database programmatically
- `SUPABASE_SETUP.md` - Detailed Supabase setup guide

## Database Schema

### Tables

- **sessions** - Complete assessment sessions
- **session_steps** - Individual steps/API calls within sessions
- **chat_messages** - Chat messages between users and the main agent

### Models

- `Session` - Main session model
- `SessionStep` - Individual step tracking
- `ChatMessage` - Chat message storage

## Connection String Format

### Supabase

```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### Local PostgreSQL

```
postgresql://user:password@localhost:5432/dbname
```

### SQLite (default)

```
sqlite:///path/to/database.db
```

## Usage

```python
from database import get_db, Session, SessionStep, ChatMessage

# In FastAPI endpoints
@app.get("/sessions")
def get_sessions(db: Session = Depends(get_db)):
    return db.query(Session).all()

# Outside FastAPI
from database.connection import get_db_context

with get_db_context() as db:
    session = db.query(Session).first()
```
