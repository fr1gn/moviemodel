from __future__ import annotations
import json
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
from joblib import dump
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from backend.transformers import GenresBinarizer

# ================== CONFIG ==================
ALGO = "xgb"
MODE = "MULTICLASS"
BIN_MODE = "quantile"          # "quantile" или "fixed"
N_CLASSES = 5
FIXED_EDGES: Optional[List[float]] = [0.0, 5.0, 6.5, 7.5, 8.5, 10.0]  # если BIN_MODE == "fixed"

RANDOM_STATE = 42
TEST_SIZE = 0.2
TOP_GENRES = 30

# XGBoost параметры (без early stopping для совместимости с 3.1.1)
XGB_PARAMS = {
    "objective": "multi:softprob",
    "eval_metric": "mlogloss",
    "learning_rate": 0.08,
    "max_depth": 6,
    "n_estimators": 600,         # умеренный потолок
    "min_child_weight": 2,
    "subsample": 0.85,
    "colsample_bytree": 0.85,
    "gamma": 0.0,
    "lambda": 1.2,
    "alpha": 0.0,
    "random_state": RANDOM_STATE,
    "tree_method": "hist",
    "verbosity": 1,
    "n_jobs": -1,
}

# Пути
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "movie_metadata.csv"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

TARGET = "imdb_score"
NUMERIC_COLS = ["duration", "budget", "title_year"]
CAT_COLS = ["content_rating"]
GENRES_COL = "genres"


def load_data(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df[pd.to_numeric(df[TARGET], errors="coerce").notna()].copy()
    df[TARGET] = df[TARGET].astype(float)

    df["content_rating"] = df["content_rating"].fillna("Unrated").astype(str).str.strip()
    replacements = {
        "TV MA": "TV-MA",
        "TV-14 ": "TV-14",
        "GP": "PG",
        "M": "PG",
    }
    df["content_rating"] = df["content_rating"].replace(replacements)
    for c in NUMERIC_COLS:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def make_bins(y: np.ndarray, mode="quantile", n_classes=5,
              fixed_edges: Optional[List[float]] = None) -> Tuple[np.ndarray, List[float], List[str]]:
    y = np.asarray(y, dtype=float)
    if mode == "fixed":
        assert fixed_edges and len(fixed_edges) == n_classes + 1
        edges = list(map(float, fixed_edges))
        cls = np.digitize(y, edges[1:-1], right=False)
        labels = []
        for i in range(n_classes):
            a, b = edges[i], edges[i + 1]
            right_br = ")" if i < n_classes - 1 else "]"
            labels.append(f"[{a:.1f}, {b:.1f}{right_br}")
        return cls.astype(int), edges, labels
    s = pd.Series(y)
    cat_series, edges = pd.qcut(s, q=n_classes, retbins=True, duplicates="drop")
    codes = cat_series.cat.codes.to_numpy()
    edges = list(map(float, edges))
    real_classes = len(edges) - 1
    labels = []
    for i in range(real_classes):
        a, b = edges[i], edges[i + 1]
        right_br = ")" if i < real_classes - 1 else "]"
        labels.append(f"[{a:.1f}, {b:.1f}{right_br}")
    return codes.astype(int), edges, labels


def make_one_hot_encoder():
    from sklearn.preprocessing import OneHotEncoder
    for spec in [
        {"handle_unknown": "ignore", "sparse_output": False},  # sklearn >=1.2
        {"handle_unknown": "ignore", "sparse": False},         # sklearn <=1.1
        {"sparse": False},
        {}
    ]:
        try:
            return OneHotEncoder(**spec)
        except TypeError:
            continue
    return OneHotEncoder()


def build_preprocessor(genres_vocab=None):
    # Деревьям скейлинг не нужен: только импьютер чисел, OHE для категорий, binarizer для жанров
    numeric = SimpleImputer(strategy="median")
    ohe = make_one_hot_encoder()
    categorical = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", ohe),
    ])
    genres = Pipeline([
        ("binarizer", GenresBinarizer(vocab=genres_vocab, top_k=TOP_GENRES)),
    ])
    return ColumnTransformer(
        [
            ("num", numeric, NUMERIC_COLS),
            ("cat", categorical, CAT_COLS),
            ("genres", genres, GENRES_COL),
        ],
        remainder="drop",
        verbose_feature_names_out=False
    )


def compute_meta(df: pd.DataFrame, genres_vocab: List[str],
                 class_edges: List[float], class_labels: List[str]) -> dict:
    rating_counts = df["content_rating"].value_counts()
    allowed_ratings = rating_counts.index.tolist()
    meta = {
        "allowed_content_ratings": allowed_ratings,
        "genres_vocab": genres_vocab,
        "numeric_ranges": {
            "duration": [int(df["duration"].min(skipna=True)), int(df["duration"].max(skipna=True))],
            "budget": [int((df["budget"].min(skipna=True) or 0)), int((df["budget"].max(skipna=True) or 0))],
            "title_year": [int(df["title_year"].min(skipna=True)), int(df["title_year"].max(skipna=True))],
        },
        "class_edges": class_edges,
        "class_labels": class_labels,
        "bin_mode": BIN_MODE,
        "mode": MODE,
        "algo": ALGO
    }
    return meta


def main():
    import sklearn, xgboost
    print(f"sklearn={sklearn.__version__} | xgboost={xgboost.__version__} | ALGO={ALGO} | BIN_MODE={BIN_MODE}")

    df = load_data(DATA_PATH)
    print("Rows:", len(df))

    tmp = GenresBinarizer(top_k=TOP_GENRES)
    tmp.fit(df[[GENRES_COL]])
    genres_vocab = tmp.classes_
    print("Genres vocab size:", len(genres_vocab))

    y_cont = df[TARGET].values
    y_cls, edges, class_labels = make_bins(
        y_cont, mode=BIN_MODE, n_classes=N_CLASSES, fixed_edges=FIXED_EDGES
    )
    print("Classes:", len(np.unique(y_cls)))
    print("Class labels:", class_labels)
    print("Edges:", edges)

    X = df[NUMERIC_COLS + CAT_COLS + [GENRES_COL]]
    X_train, X_valid, y_train, y_valid = train_test_split(
        X, y_cls, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y_cls
    )

    preprocessor = build_preprocessor(genres_vocab=genres_vocab)

    from xgboost import XGBClassifier
    clf = XGBClassifier(
        **XGB_PARAMS,
        num_class=len(np.unique(y_cls))
    )

    # Полноценный sklearn Pipeline: server_cls.py сможет вызвать pipe.predict_proba(X)
    pipe = Pipeline([
        ("prep", preprocessor),
        ("model", clf),
    ])

    pipe.fit(X_train, y_train)

    y_pred_tr = pipe.predict(X_train)
    y_pred_va = pipe.predict(X_valid)

    acc_tr = accuracy_score(y_train, y_pred_tr)
    acc_va = accuracy_score(y_valid, y_pred_va)
    f1_tr = f1_score(y_train, y_pred_tr, average="macro")
    f1_va = f1_score(y_valid, y_pred_va, average="macro")

    print(f"[XGB] Train Acc: {acc_tr:.3f} | Train Macro-F1: {f1_tr:.3f}")
    print(f"[XGB] Valid Acc: {acc_va:.3f} | Valid Macro-F1: {f1_va:.3f}")
    try:
        print("Validation classification report:")
        print(classification_report(y_valid, y_pred_va, digits=3))
    except Exception:
        pass

    # Сохранение артефактов (совместимо с server_cls.py)
    model_path = ARTIFACTS_DIR / "model_cls.joblib"
    meta_path = ARTIFACTS_DIR / "meta_cls.json"
    metrics_path = ARTIFACTS_DIR / "metrics_cls.json"

    dump(pipe, model_path)
    meta = compute_meta(df, genres_vocab, class_edges=edges, class_labels=class_labels)
    with meta_path.open("w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    metrics = {
        "algo": ALGO,
        "train_accuracy": float(acc_tr),
        "valid_accuracy": float(acc_va),
        "train_macro_f1": float(f1_tr),
        "valid_macro_f1": float(f1_va),
        "n_train": int(len(y_train)),
        "n_valid": int(len(y_valid)),
        "class_distribution_train": {
            class_labels[i]: int((y_train == i).sum()) for i in np.unique(y_train)
        },
        "class_distribution_valid": {
            class_labels[i]: int((y_valid == i).sum()) for i in np.unique(y_valid)
        },
        "sklearn_version": sklearn.__version__,
        "xgboost_version": xgboost.__version__
    }
    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    print("Saved:")
    print(" -", model_path)
    print(" -", meta_path)
    print(" -", metrics_path)


if __name__ == "__main__":
    main()