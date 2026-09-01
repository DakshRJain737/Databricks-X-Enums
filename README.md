# Campus.AI — Team Enums

FastAPI backend + React (Vite) frontend for the four Tier-1 features from your deck:
Placement Readiness, PDF Doubt-Clearing, CP/GitHub Leaderboard, Facility Utilisation.

The app runs **fully end-to-end without any Databricks setup** — every Genie call
gracefully falls back to a clearly-labeled mock response until you plug in real
credentials. Fill in `backend/.env` whenever you're ready to go live.

## 1. Run the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # edit values as needed (works empty too)
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Check `http://localhost:8000/api/health` —
`databricks_genie_live` tells you if it's in mock or live mode. Interactive API
docs: `http://localhost:8000/docs`.

## 2. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api` to `localhost:8000`
(see `vite.config.js`). Sign up, then explore the four features from the sidebar.

## 3. Databricks — what to get, and where (Free Edition)

Databricks Free Edition gives you a real workspace, SQL warehouse, and Genie —
enough to run this fully live. Here's exactly what to grab:

| .env variable | Where to get it | Required for Tier 1? |
|---|---|---|
| `DATABRICKS_HOST` | Your workspace URL — shown in the browser address bar once logged in, e.g. `https://dbc-xxxxxxxx-xxxx.cloud.databricks.com` | ✅ Yes |
| `DATABRICKS_TOKEN` | Workspace → your username (top-right) → **Settings → Developer → Access tokens → Manage → Generate new token**. Copy immediately, it's shown once. | ✅ Yes |
| `DATABRICKS_WAREHOUSE_ID` | Sidebar → **SQL Warehouses** → open the (Free Edition gives you one "Serverless Starter Warehouse" by default) → the ID is in the URL: `.../sql/warehouses/<this-part>` | ✅ Yes |
| `GENIE_CAREER_ACADEMICS_SPACE_ID` | Sidebar → **Genie** → **New space** → point it at a table/schema with your drive/eligibility data → open the space → ID is in the URL: `.../genie/rooms/<this-part>` | ✅ Yes — this is the only space Tier 1 needs |
| `GENIE_RESEARCH_SPACE_ID`, `GENIE_CAMPUS_OPS_SPACE_ID`, `GENIE_COMMUNITY_SPACE_ID`, `GENIE_SAFETY_SPACE_ID` | Same as above, one Genie space each, for later tiers/features | ❌ Leave blank for now |
| `FOUNDATION_MODEL_ENDPOINT` | Sidebar → **Serving** → check the endpoint list for `databricks-meta-llama-3-3-70b-instruct` (pay-per-token, available by default on Free Edition). If named differently in your workspace, use that exact name. | Only used for free-text summarization (e.g. forum digest, stretch goal) |

**Not required to get the app running (safe to leave as-is / local defaults):**
- `LAKEBASE_URL` — this scaffold uses local SQLite by default (`DATABASE_URL` in `.env`, already set). Only switch to real Lakebase Postgres if you want persistent multi-user storage; Free Edition's Lakebase is in **Compute → Lakebase → Create instance**, connection details on the instance page.
- `REDIS_URL` — not used by this scaffold. Ignore unless you add caching/rate-limiting later.
- `JWT_SECRET` — generate your own random string, don't fetch it from Databricks:
  ```bash
  openssl rand -hex 32
  ```

### Rotate any token you've shared

If you ever paste a `DATABRICKS_TOKEN` into a chat, doc, or ticket — treat it as
compromised: revoke it under **Settings → Developer → Access tokens** and issue a
new one before deploying.

## Project structure

```
backend/
  app/
    core/        # config, db, security (JWT), databricks (Genie client)
    routers/      # auth, users, placement, pdf_qa, leaderboard, facility
    main.py
  requirements.txt
  .env.example
frontend/
  src/
    api/          # axios client
    components/   # Layout, GenieBadge
    pages/        # Login, Signup, Dashboard, Placement, PdfQa, Leaderboard, Facility
    auth.jsx
    App.jsx
  package.json
  vite.config.js
```

## Notes

- **Mock vs live Genie**: every page shows a badge — "Mock" (no space configured),
  "Live Genie" (real Databricks call succeeded), or "Genie error" (call failed —
  check host/token/space ID). Nothing breaks in mock mode; it's there so you can
  demo and develop before Databricks is fully wired up.
- **PDF Doubt-Clearing** uses local TF-IDF retrieval (scikit-learn) over the
  uploaded PDF's chunks as a stand-in for Databricks Vector Search — swap
  `app/routers/pdf_qa.py`'s retrieval step for a real Vector Search index when
  ready.
- **CP/GitHub Leaderboard** calls the real public GitHub REST API and Codeforces
  API — no keys needed for those two.
- **Facility Utilisation** is simulated (per your deck's data-honesty statement)
  — swap `app/routers/facility.py`'s `simulated_occupancy()` for a real
  Lakeflow streaming source when you have sensor data.
# Databricks-X-Enums
