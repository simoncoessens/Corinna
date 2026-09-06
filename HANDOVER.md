# Hosting Corinna yourself

One-page guide for the University of Bari. About one hour of work, most of it creating accounts.

## 1. Create the accounts

| Service | What it does | Cost | What to copy |
|---|---|---|---|
| render.com | Runs the app (two services) | $14 / month, needs a card | nothing yet |
| openrouter.ai | Language models | prepaid credits, $20 ≈ 100 assessments | buy credits, Keys → create key |
| app.tavily.com | Web search about the company | free (1 000 searches / month) | API key |
| platform.openai.com | Embeddings for the DSA text search | cents per month, add $5 | API keys → create key |
| supabase.com | Database with the assessment sessions | free | see step 2 |
| cloud.qdrant.io | Vector database with the DSA text | free cluster | cluster URL and API key |

## 2. Database (Supabase)

1. New project, any name, region Frankfurt. Save the database password.
2. SQL Editor → New query → paste `backend/database/supabase_migration.sql` → Run.
3. Connect → Session pooler → copy the connection string, fill in the password. This is `DATABASE_URL`.

## 3. DSA knowledge base (Qdrant)

1. Create a free cluster, copy URL and API key.
2. Load the DSA text once from a laptop:

```bash
export QDRANT_URL=... QDRANT_API_KEY=... OPENAI_EMBEDDING_API_KEY=...
cd backend && pip install -r requirements.txt && python -m knowledge_base.ingest
```

## 4. Deploy on Render

1. Log in to Render, open https://render.com/deploy?repo=https://github.com/simoncoessens/Corinna
2. Fill in the form (`OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `OPENAI_EMBEDDING_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `DATABASE_URL`, `ADMIN_PASSWORD`) and click Apply.
3. After about five minutes Render shows `corinna-uniba` (website) and `corinna-uniba-backend`.
4. Check that the backend URL is exactly `https://corinna-uniba-backend.onrender.com`. If Render added a suffix, put the real URL in the website's `NEXT_PUBLIC_API_URL` and redeploy it.

## 5. Check and hand over

Open the website and run one assessment. When it works, Simon switches off his copy and deletes his keys. Later code updates are applied with Manual Deploy → Deploy latest commit.

Reference for the current (Simon-hosted) setup: Render workspace with services `corinna-backend` and `corrina-frontend` (Starter, $14/month, auto-deploy off), OpenRouter, Tavily, OpenAI, Supabase (eu-west-1) and Qdrant all on Simon's accounts.
