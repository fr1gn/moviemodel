from __future__ import annotations
import json
import os
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from joblib import load
from pydantic import BaseModel, conint, confloat

from backend.transformers import GenresBinarizer  # ensure class is importable for unpickle

BASE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = Path(os.getenv("MOVIEMODEL_ARTIFACTS") or (BASE_DIR / "artifacts"))

MODEL_PATH = ARTIFACTS_DIR / "model_reg.joblib"
META_PATH = ARTIFACTS_DIR / "meta_reg.json"
METRICS_PATH = ARTIFACTS_DIR / "metrics_reg.json"

if not MODEL_PATH.exists() or not META_PATH.exists():
    raise RuntimeError(
        f"Regression artifacts missing.\nExpected:\n  {MODEL_PATH}\n  {META_PATH}\n"
        f"Run: python -m backend.train_model_reg"
    )

pipe = load(MODEL_PATH)
with META_PATH.open("r", encoding="utf-8") as f:
    META = json.load(f)

metrics = {}
if METRICS_PATH.exists():
    with METRICS_PATH.open("r", encoding="utf-8") as f:
        metrics = json.load(f)

ALLOWED_CONTENT_RATINGS = set(META.get("allowed_content_ratings", []))
GENRES_VOCAB = META.get("genres_vocab", [])
OBSERVED_MIN, OBSERVED_MAX = META.get("target_range_observed", [0.0, 10.0])

app = FastAPI(title="IMDB Score Regression API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    duration: conint(ge=1, le=400)
    budget: conint(ge=0)
    title_year: conint(ge=1900, le=2030)
    genres: List[str]
    content_rating: str


class PredictResponse(BaseModel):
    predicted_score: confloat(ge=0.0, le=10.0)
    confidence: confloat(ge=0.0, le=1.0)
    explanation: str


@app.get("/meta")
def meta():
    return {
        "mode": "REGRESSION",
        "allowed_content_ratings": sorted(ALLOWED_CONTENT_RATINGS),
        "genres_vocab": GENRES_VOCAB,
        "numeric_ranges": META.get("numeric_ranges", {}),
        "observed_score_range": [OBSERVED_MIN, OBSERVED_MAX],
        "metrics": metrics
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if req.content_rating not in ALLOWED_CONTENT_RATINGS:
        raise HTTPException(400, f"content_rating '{req.content_rating}' not allowed")

    row = {
        "duration": int(req.duration),
        "budget": int(req.budget),
        "title_year": int(req.title_year),
        "content_rating": req.content_rating,
        "genres": "|".join([g.strip() for g in req.genres if g.strip()]),
    }

    X = pd.DataFrame([row])

    try:
        score = float(pipe.predict(X)[0])
    except Exception:
        # Fallback with named columns
        score = float(pipe.predict(pd.DataFrame([row]))[0])

    # Clamp to 0..10
    score_clamped = max(0.0, min(10.0, score))

    # Confidence heuristic: std of tree predictions (RandomForest)
    confidence = 0.5
    try:
        model = pipe.named_steps["model"]
        if hasattr(model, "estimators_"):
            indiv = np.array([est.predict(X)[0] for est in model.estimators_], dtype=float)
            std = float(np.std(indiv))
            # Map std → confidence (std near 0 => high confidence)
            confidence = max(0.0, min(1.0, 1.0 - std / 2.5))
    except Exception:
        pass

    explanation = "Features used: duration, budget, title_year, content_rating, genres (multi-hot)."

    return PredictResponse(
        predicted_score=round(score_clamped, 2),
        confidence=round(confidence, 2),
        explanation=explanation
    )


@app.get("/health")
def health():
    return {"status": "ok", "mode": "REGRESSION"}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload_flag = os.getenv("RELOAD", "0") in ("1", "true", "True", "yes", "on")
    target = "backend.server_reg:app" if reload_flag else app
    print(f"Starting regression API on http://{host}:{port} (reload={reload_flag})")
    uvicorn.run(target, host=host, port=port, reload=reload_flag)