# Campus.AI — Team Enums

FastAPI backend + React (Vite) frontend for the Campus AI :
Placement Readiness, Teacher infomation, CP/GitHub Leaderboard, Facility Utilisation.Where do i stand

## 1. Run the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        #Windows
pip install -r requirements.txt
cp .env.example .env            # edit values as needed and mentioned below
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`

## 2. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` 

## 3. Databricks — 
Tier 1 means only 1 sql database and genie to work with ( easiest setup ) you will need to have campus related data or synthetic data in the databrics sql editor console and have its workspace url here
| `.env` variable | Required for Tier 1? |
|---|---|
| `DATABRICKS_HOST` | ✅ Yes |
| `DATABRICKS_TOKEN` | ✅ Yes |
| `DATABRICKS_WAREHOUSE_ID` | ✅ Yes |
| `GENIE_CAREER_ACADEMICS_SPACE_ID` | ✅ Yes |
| `GENIE_RESEARCH_SPACE_ID`, `GENIE_CAMPUS_OPS_SPACE_ID`, `GENIE_COMMUNITY_SPACE_ID`, `GENIE_SAFETY_SPACE_ID` | ❌ Leave blank for now — same setup, one Genie space each, for later tiers/features |
| `FOUNDATION_MODEL_ENDPOINT` | Used for free-text summarization — `databricks-meta-llama-3-3-70b-instruct` |
| `JWT_SECRET` | Generate your own: `openssl rand -hex 32` |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_EXPIRE_MINUTES` | `720` |

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

# Databricks-X-Enums
# Contributor Note
