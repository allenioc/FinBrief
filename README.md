# FinBrief

Responsive AI finance news briefing web app. Search stocks, ETFs, or macro topics and get educational quick briefs with sentiment and market impact context.

**Not investment advice** — FinBrief is for learning and market context only.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** Python FastAPI (`/backend`)

## Project structure

```
app/              # Next.js pages (dashboard, deep dive, watchlist)
components/       # Reusable UI
lib/              # Types, mock data, API helpers
backend/
  main.py         # FastAPI routes (/brief, /health)
  news.py         # Mock news data
  sentiment.py    # Mock sentiment & impact logic
```

## Getting started

### Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Connect frontend to API

With both servers running, Next.js rewrites `/api/*` to `http://127.0.0.1:8000/*`. The dashboard calls `/api/brief?q=AAPL` and falls back to local mock data if the API is unavailable.

Example:

```bash
curl "http://127.0.0.1:8000/brief?q=TSLA"
```

## MVP features

- Home dashboard with search
- Quick Brief cards (sentiment + market impact)
- Deep Dive pages (what happened, why it matters, bull/bear views, key terms)
- Explanation modes: Simple, Standard, Analyst
- Watchlist UI (mock data)

## Sample searches

`AAPL`, `TSLA`, `SPY`, `QQQ`, `inflation`, `interest rates`
