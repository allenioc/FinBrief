"""Mock sentiment and market impact logic for FinBrief."""

from typing import Literal

Sentiment = Literal["positive", "neutral", "negative"]
MarketImpact = Literal["low", "medium", "high"]

TOPIC_SENTIMENT: dict[str, Sentiment] = {
    "earnings": "positive",
    "deliveries": "negative",
    "interest rates": "neutral",
    "ai spending": "positive",
    "inflation": "positive",
}

TOPIC_IMPACT: dict[str, MarketImpact] = {
    "earnings": "medium",
    "deliveries": "high",
    "interest rates": "high",
    "ai spending": "medium",
    "inflation": "high",
}

KEYWORD_SENTIMENT: dict[str, Sentiment] = {
    "beat": "positive",
    "stronger": "positive",
    "growth": "positive",
    "cooling": "positive",
    "below": "negative",
    "miss": "negative",
    "sticky": "neutral",
    "patience": "neutral",
}


def infer_sentiment(title: str, summary: str, topic: str) -> Sentiment:
    topic_key = topic.lower()
    if topic_key in TOPIC_SENTIMENT:
        base = TOPIC_SENTIMENT[topic_key]
    else:
        base = "neutral"

    text = f"{title} {summary}".lower()
    scores = {"positive": 0, "neutral": 0, "negative": 0}
    scores[base] += 1

    for keyword, label in KEYWORD_SENTIMENT.items():
        if keyword in text:
            scores[label] += 1

    return max(scores, key=scores.get)


def infer_market_impact(topic: str, ticker: str) -> MarketImpact:
    topic_key = topic.lower()
    if topic_key in TOPIC_IMPACT:
        return TOPIC_IMPACT[topic_key]
    if ticker in ("SPY", "QQQ", "—"):
        return "high"
    return "medium"
