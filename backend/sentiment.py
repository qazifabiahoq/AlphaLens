"""
AlphaLens - sentiment.py
LLM Brain: FinBERT-based sentiment analysis + conviction scoring

Uses ProsusAI/finbert from HuggingFace — no API key required.
Falls back to keyword scoring if model can't load (no internet / low RAM).
"""

import logging
import re
from typing import Optional

log = logging.getLogger("AlphaLens.Sentiment")

# ── FinBERT loader ────────────────────────────────────────────────────────────
_pipeline = None

def _load_model():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    try:
        from transformers import pipeline
        log.info("Loading FinBERT (ProsusAI/finbert) — first run may download ~500MB...")
        _pipeline = pipeline(
            "text-classification",
            model="ProsusAI/finbert",
            tokenizer="ProsusAI/finbert",
            top_k=None,          # return all 3 label scores
        )
        log.info("✓ FinBERT loaded")
        return _pipeline
    except Exception as e:
        log.warning(f"FinBERT unavailable ({e}). Using keyword fallback.")
        return None


# ── Keyword fallback (no model needed) ───────────────────────────────────────
_POSITIVE_WORDS = [
    "beat", "beats", "surge", "record", "growth", "profit", "bullish",
    "upgrade", "buy", "strong", "rally", "gain", "exceed", "outperform",
    "revenue", "positive", "up", "rise", "high", "launch", "partnership",
]
_NEGATIVE_WORDS = [
    "miss", "misses", "fall", "drop", "loss", "bearish", "downgrade",
    "sell", "weak", "decline", "recall", "lawsuit", "fine", "cut",
    "warning", "risk", "fraud", "layoff", "crash", "concern", "debt",
]

def _keyword_score(text: str) -> dict:
    text_lower = text.lower()
    pos = sum(1 for w in _POSITIVE_WORDS if w in text_lower)
    neg = sum(1 for w in _NEGATIVE_WORDS if w in text_lower)
    total = pos + neg or 1

    if pos > neg:
        label = "positive"
        raw   = pos / total
    elif neg > pos:
        label = "negative"
        raw   = neg / total
    else:
        label = "neutral"
        raw   = 0.5

    return {"label": label, "score": raw}


# ── Main agent ────────────────────────────────────────────────────────────────
class SentimentAgent:
    """
    Analyzes a list of news headlines for a given ticker.

    Returns:
        {
            "label":     "positive" | "neutral" | "negative",
            "score":     float  (0.0 – 10.0 conviction scale),
            "raw_probs": {"positive": float, "neutral": float, "negative": float},
            "headlines_analyzed": int,
            "prompt_used": str,   # for README / explainability
        }
    """

    PROMPT_TEMPLATE = (
        "You are a financial analyst. "
        "Classify the following news about {ticker} as POSITIVE, NEUTRAL, or NEGATIVE "
        "and rate your conviction from 0 (no signal) to 10 (extremely strong signal). "
        "Headlines:\n{headlines}"
    )

    def __init__(self):
        self.model = _load_model()

    def _finbert_score(self, texts: list[str]) -> dict:
        """Run FinBERT on a batch of headlines and average the probabilities."""
        # Truncate each headline to 512 tokens (FinBERT limit)
        truncated = [t[:512] for t in texts]

        all_pos, all_neg, all_neu = [], [], []

        for text in truncated:
            try:
                result = self.model(text)[0]   # list of {label, score} dicts
                probs  = {r["label"].lower(): r["score"] for r in result}
                all_pos.append(probs.get("positive", 0))
                all_neg.append(probs.get("negative", 0))
                all_neu.append(probs.get("neutral",  0))
            except Exception as e:
                log.debug(f"FinBERT inference error on headline: {e}")

        if not all_pos:
            return None

        avg_pos = sum(all_pos) / len(all_pos)
        avg_neg = sum(all_neg) / len(all_neg)
        avg_neu = sum(all_neu) / len(all_neu)

        dominant = max(
            [("positive", avg_pos), ("negative", avg_neg), ("neutral", avg_neu)],
            key=lambda x: x[1],
        )

        return {
            "label":     dominant[0],
            "raw_probs": {"positive": avg_pos, "negative": avg_neg, "neutral": avg_neu},
            "dominant_prob": dominant[1],
        }

    def _to_conviction(self, finbert_result: dict) -> float:
        """
        Convert FinBERT probability → 0–10 conviction score.

        Logic:
            - Base score = dominant probability * 10
            - Penalize if neutral is close to dominant (ambiguous signal)
            - Cap at 10
        """
        prob    = finbert_result["dominant_prob"]
        neu     = finbert_result["raw_probs"]["neutral"]
        penalty = neu * 2   # high neutral dilutes conviction

        score = max(0.0, min(10.0, prob * 10 - penalty))
        return round(score, 2)

    def analyze(self, ticker: str, headlines: list[str]) -> dict:
        if not headlines:
            log.warning(f"No headlines for {ticker}, returning neutral.")
            return {
                "label":              "neutral",
                "score":              5.0,
                "raw_probs":          {"positive": 0.33, "negative": 0.33, "neutral": 0.34},
                "headlines_analyzed": 0,
                "prompt_used":        "N/A — no headlines",
            }

        # Build prompt string (for explainability / README)
        headlines_text = "\n".join(f"- {h}" for h in headlines[:10])
        prompt = self.PROMPT_TEMPLATE.format(
            ticker=ticker, headlines=headlines_text
        )

        # FinBERT inference
        if self.model:
            fb = self._finbert_score(headlines[:10])
        else:
            fb = None

        if fb:
            score = self._to_conviction(fb)
            label = fb["label"]
            probs = fb["raw_probs"]
        else:
            # Keyword fallback
            combined = " ".join(headlines)
            kw       = _keyword_score(combined)
            label    = kw["label"]
            score    = round(kw["score"] * 10, 2)
            probs    = {"positive": 0, "neutral": 0, "negative": 0, label: kw["score"]}

        log.info(
            f"  Sentiment [{ticker}]: {label.upper()} | "
            f"conviction={score}/10 | "
            f"headlines={len(headlines)}"
        )

        return {
            "label":              label,
            "score":              score,
            "raw_probs":          probs,
            "headlines_analyzed": len(headlines),
            "prompt_used":        prompt,
        }


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    agent = SentimentAgent()

    test_headlines = [
        "Apple beats Q4 earnings expectations, revenue surges 12%",
        "Apple launches new MacBook Pro with record-breaking performance",
        "Analyst upgrades AAPL to strong buy after strong iPhone demand",
        "Supply chain concerns may pressure Apple margins next quarter",
    ]

    result = agent.analyze("AAPL", test_headlines)
    print("\n── AlphaLens Sentiment Result ──")
    print(f"  Label     : {result['label'].upper()}")
    print(f"  Conviction: {result['score']}/10")
    print(f"  Probs     : {result['raw_probs']}")
    print(f"\nPrompt used:\n{result['prompt_used']}")
