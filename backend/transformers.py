from __future__ import annotations
from sklearn.base import BaseEstimator, TransformerMixin
import numpy as np
import pandas as pd


class GenresBinarizer(BaseEstimator, TransformerMixin):
    """
    Multi-hot encode a 'genres' column with pipe-separated values.
    Accepts X as:
      - pandas Series
      - single-column DataFrame
      - 1D ndarray / list
    Parameters
    ----------
    vocab : list[str] | None
        Fixed vocabulary of genres. If None, top_k most frequent genres from fit data are used.
    top_k : int
        Max number of genres to keep if vocab is None.
    """
    def __init__(self, vocab=None, top_k=30):
        self.vocab = vocab
        self.top_k = top_k
        self.classes_ = None

    def _to_1d(self, X):
        if isinstance(X, pd.DataFrame):
            if X.shape[1] != 1:
                raise ValueError(f"Expected single-column DataFrame, got shape {X.shape}")
            return X.iloc[:, 0].to_numpy()
        if isinstance(X, pd.Series):
            return X.to_numpy()
        arr = np.asarray(X)
        return arr.ravel()

    def fit(self, X, y=None):
        vals = self._to_1d(X)
        s = pd.Series(vals, dtype="object").fillna("")
        exploded = s.str.split("|").explode().str.strip()
        exploded = exploded[exploded != ""]
        counts = exploded.value_counts()
        if self.vocab is None:
            self.classes_ = counts.head(self.top_k).index.tolist()
        else:
            self.classes_ = list(self.vocab)
        return self

    def transform(self, X):
        if self.classes_ is None:
            raise RuntimeError("GenresBinarizer is not fitted.")
        vals = self._to_1d(X)
        s = pd.Series(vals, dtype="object").fillna("")
        lists = s.str.split("|").apply(lambda xs: [x.strip() for x in xs if x and x.strip()])
        import numpy as np
        out = np.zeros((len(lists), len(self.classes_)), dtype=np.float32)
        idx_map = {g: i for i, g in enumerate(self.classes_)}
        for row, glist in enumerate(lists):
            for g in glist:
                i = idx_map.get(g)
                if i is not None:
                    out[row, i] = 1.0
        return out

    def get_feature_names_out(self, input_features=None):
        return [f"genre__{g}" for g in self.classes_]