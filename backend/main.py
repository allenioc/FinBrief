"""FinBrief FastAPI backend."""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from news import get_brief_by_id, search_briefs
from sentiment import infer_market_impact, infer_sentiment

app = FastAPI(
    title="FinBrief API",
    description="Educational finance news briefing API (mock data)",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/brief")
def brief(q: str = Query(default="", description="Ticker or topic search query")) -> dict:
    """
    Return sample briefing data for a ticker or finance topic.
    Educational content only — not investment advice.
    """
    briefs = search_briefs(q)

    enriched = []
    for item in briefs:
        copy = dict(item)
        copy["sentiment"] = infer_sentiment(
            copy["title"], copy["summary"], copy["topic"]
        )
        copy["marketImpact"] = infer_market_impact(copy["topic"], copy["ticker"])
        enriched.append(copy)

    return {"query": q.strip(), "briefs": enriched}


@app.get("/brief/{brief_id}")
def brief_by_id(brief_id: str) -> dict:
    item = get_brief_by_id(brief_id)
    if item is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Briefing not found")

    copy = dict(item)
    copy["sentiment"] = infer_sentiment(copy["title"], copy["summary"], copy["topic"])
    copy["marketImpact"] = infer_market_impact(copy["topic"], copy["ticker"])
    return copy
