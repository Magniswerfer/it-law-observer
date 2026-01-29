# IT-Politics Bill Radar

An MVP for monitoring Danish parliamentary proposals (lovforslag and beslutningsforslag) with IT relevance analysis for Enhedslistens IT-Politiske Udvalg.

## Architecture

This is a monorepo containing:

- `apps/api` - FastAPI backend
- `apps/web` - Next.js frontend
- `packages/shared` - Shared types (optional)

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: Next.js (TypeScript)
- **Database**: Supabase Postgres
- **Data Source**: Folketingets ODA OData API

## Features

- Incremental ingestion of parliamentary proposals from ODA API
- IT relevance detection using keyword matching
- Optional LLM enrichment with Groq (Llama) or OpenAI
- RESTful API for proposal data
- Simple web interface for browsing proposals

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- Supabase account and project

### Database Setup

1. Create a new Supabase project
2. Run the migration:

```bash
# From apps/api directory
supabase db push
# or run the SQL directly in Supabase SQL editor
cat supabase/migrations/001_initial_schema.sql
```

### Backend Setup

1. Navigate to the API directory:
```bash
cd apps/api
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`): Used by the API to call Supabase PostgREST
- `SUPABASE_ANON_KEY`: Used by the API to validate Supabase user sessions for admin-only endpoints
- `INGEST_TOKEN`: Secure token for ingestion endpoint protection (used by `POST /ingest`)

Optional:
- `GROQ_API_KEY`: For LLM-powered enrichment (Llama via Groq)
- `OPENAI_API_KEY`: For LLM-powered enrichment (OpenAI)
- `ENRICH_POLICY_ANALYSIS=true`: Store an additional democracy/digital-rights JSON analysis per proposal (see `apps/api/supabase/migrations/002_add_policy_analyses.sql`)
- `PDF_UPLOAD_MAX_MB`: Max PDF upload size for `/proposals/{id}/pdf-text` (default 25)
- `ADMIN_EMAILS`: Comma-separated allowlist of admin user emails (if unset, any authenticated Supabase user is treated as admin)

5. Run the API:
```bash
python -m src.main
# or
uvicorn src.main:app --reload
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the web directory:
```bash
cd apps/web
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API + Supabase auth config
```

4. Run the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Usage

### Initial Data Ingestion

Trigger the initial ingestion:

```bash
curl -X POST "http://localhost:8000/ingest?ingest_token=YOUR_INGEST_TOKEN"
```

This will:
1. Fetch all proposals from the ODA API
2. Store them in the database
3. Perform IT relevance analysis
4. Optionally enrich with LLM analysis

### API Endpoints

- `GET /` - Health check
- `POST /ingest` - Trigger data ingestion (requires INGEST_TOKEN)
- `POST /admin/ingest` - Trigger ingestion (requires Supabase Auth as admin)
- `GET /proposals` - List proposals with filtering
  - Query params: `type=L|B`, `it_relevant=true|false`, `topic=...`, `limit=...`, `offset=...`
- `GET /proposals/{id}` - Get specific proposal details
- `POST /proposals/{id}/pdf-text` - Upload a PDF to extract/store text (requires Supabase Auth as admin)
- `POST /proposals/{id}/policy-analysis` - Re-run policy analysis (requires Supabase Auth as admin)

### Web Interface

- `/` - Browse proposals with filters
- `/proposal/[id]` - View proposal details
- `/admin` - Admin overview (requires login)

Note on PDFs:
- The app stores extracted PDF text in Postgres (`proposal_pdf_texts`). It does not store raw PDFs in the DB.
- If you want to retain PDFs, prefer Supabase Storage and store an object path/URL in a dedicated table.

## Development

### Running Tests

```bash
# API tests (when implemented)
cd apps/api
pytest

# Frontend tests (when implemented)
cd apps/web
npm test
```

### Code Quality

- Backend: Follow PEP 8, use type hints
- Frontend: Use TypeScript, follow Next.js best practices
- Database: Use migrations for schema changes

## Deployment

### Backend

The FastAPI app can be deployed to:
- Railway
- Render
- Heroku
- DigitalOcean App Platform

### Frontend

The Next.js app can be deployed to:
- Vercel
- Netlify
- Railway
- Render

### Database

Use Supabase for both development and production.

## License

This project is developed for Enhedslistens IT-Politiske Udvalg.
