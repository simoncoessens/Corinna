# Deployment Guide

This guide covers deploying the SNIP-tool backend with Supabase database.

## Environment Variables

### Required for Production

**DATABASE_URL** (REQUIRED)

- Supabase Session Pooler connection string
- Format: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-[REGION].pooler.supabase.com:5432/postgres`
- Get from: Supabase Dashboard → Settings → Database → Connection string → Session pooler
- **Never commit this to version control!**

### Other Required Variables

- `OPENAI_API_KEY` - OpenAI API key for LLM operations
- `QDRANT_URL` - Qdrant vector database URL
- `REDIS_URL` - Redis cache URL
- `ADMIN_USERNAME` - Admin dashboard username
- `ADMIN_PASSWORD` - Admin dashboard password (change in production!)

## Deployment Platforms

### Render.com

1. **Create a new Web Service**

   - Connect your GitHub repository
   - Select the `backend` directory as root
   - Build command: `pip install -r requirements.txt && cd agents/company_matcher && pip install -e . && cd ../company_researcher && pip install -e . && cd ../service_categorizer && pip install -e . && cd ../main_agent && pip install -e .`
   - Start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

2. **Set Environment Variables**

   - Go to your service → Environment
   - Add all required environment variables
   - **Important**: Set `DATABASE_URL` to your Supabase connection string

3. **Deploy**
   - Render will automatically deploy on git push
   - Check logs to verify database connection

### Docker

1. **Build the image**:

   ```bash
   docker build -t snip-tool-backend ./backend
   ```

2. **Run with environment variables**:
   ```bash
   docker run -d \
     -p 8001:8001 \
     -e DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-[REGION].pooler.supabase.com:5432/postgres" \
     -e OPENAI_API_KEY="your-key" \
     -e QDRANT_URL="http://qdrant:6333" \
     -e REDIS_URL="redis://redis:6379/0" \
     -e ADMIN_USERNAME="admin" \
     -e ADMIN_PASSWORD="your-secure-password" \
     snip-tool-backend
   ```

### Docker Compose

Update `infra/docker-compose.yml` to include the backend service with environment variables.

## Verification

After deployment, verify:

1. **Health Check**: `GET /health` should return `{"status": "healthy"}`

2. **Database Connection**: Check startup logs for:

   ```
   ✓ Database: PostgreSQL/Supabase (aws-1-eu-west-1.pooler.supabase.com:5432/postgres)
   ✓ Database initialized and connected
   ```

3. **Admin Dashboard**: Visit `https://your-domain.com/admin` and verify it loads

4. **Create a Test Session**: Use the API to create a session and verify it appears in Supabase

## Troubleshooting

### Database Connection Fails

- Verify `DATABASE_URL` is set correctly
- Check Supabase dashboard for connection issues
- Ensure your IP is allowed (if using IP restrictions)
- Verify password is URL-encoded (special characters like `^` become `%5E`)

### SQLite Fallback in Production

If you see "⚠ Database: SQLite" in logs:

- `DATABASE_URL` environment variable is not set
- Set it in your deployment platform's environment variables
- Restart the service after setting

### Connection Pool Errors

- Supabase pooler handles connection pooling automatically
- If you see pool errors, check Supabase dashboard for connection limits
- Consider upgrading your Supabase plan if needed

## Security Notes

1. **Never commit `.env` files** - They're in `.gitignore` for a reason
2. **Use environment variables** in your deployment platform
3. **Rotate passwords** regularly
4. **Use strong admin passwords** for the admin dashboard
5. **Enable IP restrictions** in Supabase if possible

## Local Development

For local development, you can use either:

1. **Supabase** (recommended): Set `DATABASE_URL` in `.env` file
2. **SQLite** (fallback): Don't set `DATABASE_URL`, it will use SQLite automatically

The code automatically detects production vs development and enforces Supabase in production.
