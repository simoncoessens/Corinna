# Corinna – hand-over checklist (Simon Coessens → Università di Bari)

Goal: move hosting and all paid third-party accounts from Simon's personal
accounts to an account owned by the University of Bari (Prof. Antonio Davola
or a delegate), without losing the live URL or the stored assessment sessions.

## 1. What is running today

| Piece | Where | Owner today | Notes |
|---|---|---|---|
| Source code | github.com/simoncoessens/Corinna | Simon (admin), Vittorio (write) | public repo; Render builds `main` but **auto-deploy is OFF** – deploy manually from the dashboard |
| Frontend | https://snip-tool.onrender.com | Simon's Render workspace (credit card) | Render service `corrina-frontend`, Node runtime (root dir `frontend/`), Starter plan |
| Backend API | https://snip-tool-backend.onrender.com | Simon's Render workspace | Render service `corinna-backend`, Docker (`backend/Dockerfile`), Starter plan, region Virginia |
| LLM calls | OpenRouter (Kimi K2 / K2-thinking) | Simon's OpenRouter account | prepaid credits |
| Web search | Tavily | Simon's Tavily account | API key |
| DSA knowledge base | Qdrant (vector DB) + OpenAI embeddings | Simon | `QDRANT_URL` / `OPENAI_EMBEDDING_API_KEY` |
| Session database | Supabase (Postgres, eu-west-1) | Simon's Supabase org | stores assessment sessions + admin stats |
| Optional | DeepSeek (only if a DeepSeek model is selected in admin panel) | Simon | `OPENAI_API_KEY` + `OPENAI_BASE_URL` |

Environment variables needed by the services are listed in `render.yaml`
(with `sync: false` for every secret) and in `.env.example`.

## 2. Constraints that shape the plan

* **Render cannot transfer services between workspaces**, and a free (Hobby)
  workspace cannot have extra members. Recreating the services in Bari's own
  workspace is the supported route; `render.yaml` makes that a one-click
  Blueprint deploy.
* **OpenRouter API keys cannot be moved** to another account. Credits can be
  moved into an *organization*, but the simplest path is a fresh Bari
  OpenRouter account + fresh key.
* **Supabase projects can be transferred** between organizations (Simon must
  be owner of his org and at least member of the target org). The connection
  string stays the same after transfer, so no data migration is needed.
* GitHub repositories can be transferred to another user/organization and
  the old URL redirects.

## 3. Order of operations

### A. Bari side – create accounts (≈30 min, Antonio or delegate)
1. GitHub account/org for the university (if none yet).
2. Render account, workspace with a university payment method.
3. OpenRouter account, buy credits (start with $20–50), create one API key
   named `corinna-prod`.
4. Tavily account, create API key.
5. OpenAI account + API key (only for embeddings; a few cents/month).
6. Supabase account (free tier is enough) – create an organization, then
   invite Simon as a *member* of it so he can transfer the project.
7. Qdrant: either Qdrant Cloud free cluster (then re-run the knowledge-base
   ingestion script in `backend/knowledge_base/`) or reuse the existing URL.

### B. Simon side – hand over
1. Merge the `fix/openrouter-max-tokens` PR first (the app is currently
   returning HTTP 500 on every agent call, see §5).
2. Transfer GitHub repo `Corinna` to the Bari GitHub account
   (Settings → Danger zone → Transfer). Keep Vittorio as collaborator.
3. Transfer the Supabase project to Bari's organization
   (Project → Settings → General → Transfer project).
4. Send Antonio the non-secret values: `QDRANT_URL`, `CORS_ALLOWED_ORIGINS`,
   `NEXT_PUBLIC_API_URL`, the admin username, and the list of secret names
   he must generate himself. **Never send the current secrets** – they get
   revoked in step D.

### C. Bari side – deploy
1. Render → New → Blueprint → select the transferred repo → Render reads
   `render.yaml` and asks for every `sync: false` secret.
2. Because the names `snip-tool` and `snip-tool-backend` are still taken by
   Simon's services, first deploy under temporary names (e.g. `corinna` and
   `corinna-backend`), and set `NEXT_PUBLIC_API_URL` / `CORS_ALLOWED_ORIGINS`
   accordingly. Verify: `GET /health` returns `healthy`, run one assessment
   end-to-end in the UI, check the admin panel.
3. Optional: to keep the historic URL, Simon deletes his two services, then
   Bari renames its services to `snip-tool` / `snip-tool-backend` and
   updates the two URL env vars. Expect a few minutes of downtime.

### D. Simon side – close down (only after C is verified)
1. Suspend, then delete both Render services; remove the card from the
   Render workspace.
2. OpenRouter: delete the `snip-tool` key; spend or keep remaining credit.
3. Tavily / OpenAI: revoke the keys used by Corinna.
4. Supabase: after the transfer nothing remains in Simon's org.
5. Rotate `ADMIN_PASSWORD` (Bari sets its own).

## 4. Running costs (order of magnitude)

* Render: 2 × Starter web services = $14/month (invoiced Jun/Jul/Aug 2026).
  Free tier is possible but services sleep after inactivity and the backend
  needs the 512 MB. The leftover `snip-tool-redis` (Valkey, free) was deleted on
  2026-09-06; Redis is no longer used.
* OpenRouter: ≈ $0.05–0.20 per full assessment with Kimi K2 (the current
  key used $11 of $20 credit over the whole project so far).
* Tavily: free tier (1 000 searches/month) has been sufficient.
* OpenAI embeddings: cents. Supabase + Qdrant: free tiers.

## 5. Known issue fixed on 2026-09-06

Since OpenRouter dropped Amazon Bedrock as a provider for the Kimi models,
requests without an explicit `max_tokens` are forwarded with the provider's
advertised maximum, which Novita and Google reject with HTTP 400. Every agent
call therefore failed with HTTP 500 while `/health` still reported healthy.
`get_chat_model()` and `create_llm()` now always send `max_tokens`
(default 16384, override with `OPENROUTER_MAX_TOKENS`). Deployed manually
(commit c47b0ba) and verified end-to-end on 2026-09-06.
