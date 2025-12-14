# Supabase Setup Guide for Admin Dashboard

This guide will help you set up Supabase as the database for the admin dashboard.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. A Supabase project created

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: Your project name (e.g., "SNIP-tool")
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (takes ~2 minutes)

## Step 2: Run the Database Migration

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the contents of `supabase_migration.sql`
4. Paste it into the SQL Editor
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
6. You should see "Success. No rows returned"

This will create:

- Three tables: `sessions`, `session_steps`, `chat_messages`
- Two enum types: `session_status`, `step_type`
- Indexes for performance
- A trigger to auto-update `updated_at` timestamps

## Step 3: Get Your Database Connection String

1. In Supabase dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string**
3. Select **URI** tab
4. Copy the connection string (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)

**Important**: Replace `[YOUR-PASSWORD]` with the database password you set when creating the project.

## Step 4: Configure Your Backend

### Option A: Environment Variable (Recommended)

Add the connection string to your `.env` file:

```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Security Note**: Never commit your `.env` file to git! Make sure it's in `.gitignore`.

### Option B: Render Environment Variables

If deploying to Render:

1. Go to your Render service dashboard
2. Navigate to **Environment** tab
3. Add a new environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Your Supabase connection string
4. Save and redeploy

## Step 5: Initialize the Database (Optional)

If you want to verify the setup, you can run the initialization script:

```bash
cd backend
python -c "from database import init_db; init_db()"
```

Or use the test script:

```bash
cd backend
python test_admin_setup.py
```

## Step 6: Verify the Setup

1. In Supabase dashboard, go to **Table Editor**
2. You should see three tables:
   - `sessions`
   - `session_steps`
   - `chat_messages`
3. Try creating a test session through your API
4. Check the tables to see if data appears

## Connection String Format

Supabase uses PostgreSQL, so your connection string should look like:

```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

The backend code automatically handles:

- Converting `postgres://` to `postgresql://` (if needed)
- Connection pooling
- SSL connections (Supabase requires SSL)

## Troubleshooting

### Connection Refused

- Check that your IP is allowed in Supabase **Settings** → **Database** → **Connection pooling**
- Verify the connection string is correct
- Make sure you replaced `[YOUR-PASSWORD]` with your actual password

### SSL Required

Supabase requires SSL connections. The SQLAlchemy driver should handle this automatically, but if you get SSL errors:

1. Make sure you're using `postgresql://` (not `postgres://`)
2. Add `?sslmode=require` to your connection string if needed

### Tables Not Found

- Make sure you ran the migration SQL in the Supabase SQL Editor
- Check that you're connected to the correct database
- Verify the migration completed without errors

## Security Best Practices

1. **Never commit connection strings** to version control
2. **Use environment variables** for all sensitive data
3. **Enable Row Level Security (RLS)** in Supabase if you need additional security (see migration file comments)
4. **Rotate passwords** regularly
5. **Use connection pooling** for production (Supabase provides this automatically)

## Next Steps

Once your database is set up:

1. Your admin dashboard at `/admin` will automatically use Supabase
2. All session data will be stored in Supabase
3. You can query data directly in Supabase SQL Editor
4. You can set up backups in Supabase dashboard

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [SQLAlchemy PostgreSQL](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html)
