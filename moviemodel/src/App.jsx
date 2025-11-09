import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import ParticlesBg from "./components/ParticlesBg.jsx";
import GenreSelect from "./components/GenreSelect.jsx";
import { predict } from "./api.js";

const CONTENT_RATINGS = [
    "G","PG","PG-13","R","NC-17","Not Rated","Unrated","TV-MA","TV-14","TV-PG","TV-G"
];

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export default function App() {
    const [duration, setDuration] = useState("");
    const [budget, setBudget] = useState("");
    const [titleYear, setTitleYear] = useState("");
    const [contentRating, setContentRating] = useState("");
    const [genres, setGenres] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [result, setResult] = useState(null);
    const [animRating, setAnimRating] = useState(0);

    const isValid = useMemo(() => {
        const d = Number(duration);
        const b = Number(budget);
        const y = Number(titleYear);
        return (
            Number.isFinite(d) && d >= 1 && d <= 400 &&
            Number.isFinite(b) && b >= 0 &&
            Number.isFinite(y) && y >= 1900 && y <= 2030 &&
            contentRating &&
            genres.length > 0
        );
    }, [duration, budget, titleYear, contentRating, genres]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!isValid) {
            setError("Please check the form fields.");
            return;
        }
        setLoading(true);
        try {
            const payload = {
                duration: Number(duration),
                budget: Number(budget),
                title_year: Number(titleYear),
                genres,
                content_rating: contentRating
            };
            const data = await predict(payload);
            setResult(data);
            animateRatingTo(data.predicted_rating);
            if (data.predicted_rating >= 7.5) burstConfetti();
        } catch (err) {
            setError(err?.message || "API request error");
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const animateRatingTo = (target) => {
        const steps = 40;
        let tick = 0;
        const interval = setInterval(() => {
            tick++;
            const progress = tick / steps;
            const eased = easeOutCubic(progress);
            const value = +(target * eased).toFixed(2);
            setAnimRating(value);
            if (tick >= steps) {
                setAnimRating(+target.toFixed(2));
                clearInterval(interval);
            }
        }, 25);
    };

    const burstConfetti = () => {
        const count = 120;
        const defaults = { origin: { y: 0.3 } };
        function fire(particleRatio, opts) {
            confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
        }
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    };

    const resetAll = () => {
        setDuration("");
        setBudget("");
        setTitleYear("");
        setContentRating("");
        setGenres([]);
        setResult(null);
        setError(null);
        setAnimRating(0);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <>
            <ParticlesBg />
            <main className="container">
                <header>
                    <h1>Movie Rating Prediction</h1>
                    <p className="subtitle">Enter the movie features to get a rating prediction</p>
                </header>

                <motion.section
                    className="card"
                    initial={{ opacity: 0, y: -16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6 }}
                >
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="field-group">
                            <label>Duration (min)</label>
                            <input
                                type="number"
                                min={1}
                                max={400}
                                placeholder="e.g., 120"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : "")}
                            />
                            <small className="hint">Range: 1–400</small>
                        </div>

                        <div className="field-group">
                            <label>Budget (USD)</label>
                            <input
                                type="number"
                                min={0}
                                step={1000}
                                placeholder="e.g., 150000000"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : "")}
                            />
                            <small className="hint">Integers only</small>
                        </div>

                        <div className="field-group">
                            <label>Release year</label>
                            <input
                                type="number"
                                min={1900}
                                max={2030}
                                placeholder="e.g., 2014"
                                value={titleYear}
                                onChange={(e) => setTitleYear(e.target.value ? Number(e.target.value) : "")}
                            />
                            <small className="hint">Range: 1900–2030</small>
                        </div>

                        <div className="field-group">
                            <label>Genres</label>
                            <GenreSelect selected={genres} onChange={setGenres} />
                            <small className="hint">Up to 6 genres</small>
                        </div>

                        <div className="field-group">
                            <label>Content rating</label>
                            <select value={contentRating} onChange={(e) => setContentRating(e.target.value)}>
                                <option value="" disabled>Select...</option>
                                {CONTENT_RATINGS.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                style={{
                                    color: "var(--danger)",
                                    fontSize: 14,
                                    marginTop: -6
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <div className="actions">
                            <button
                                type="submit"
                                className={`primary-btn ${loading ? "loading" : ""}`}
                                disabled={loading || !isValid}
                            >
                                <span className="btn-label">{loading ? "Submitting..." : "Predict"}</span>
                                <span className="loader" />
                            </button>
                            <button type="button" className="secondary-btn" onClick={resetAll}>
                                Reset
                            </button>
                        </div>
                    </form>
                </motion.section>

                <AnimatePresence>
                    {result && (
                        <motion.section
                            key="result"
                            className="result-section"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 16 }}
                            transition={{ duration: 0.6 }}
                        >
                            <motion.div
                                className="result-card"
                                initial={{ scale: 0.98, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5 }}
                            >
                                <h2>Result:</h2>
                                <div className="rating-display">
                                    <span>{animRating.toFixed(2)}</span>
                                    <span className="scale">/10</span>
                                </div>
                                <div className="confidence-bar">
                                    <div
                                        className="confidence-fill"
                                        style={{ width: `${(result.confidence || 0) * 100}%` }}
                                    />
                                </div>
                                <p className="confidence-text">
                                    Confidence: <span>{Math.round(result.confidence * 100)}%</span>
                                </p>
                                <details className="explanation" open>
                                    <summary>Model explanation</summary>
                                    <p>{result.explanation || "No explanation"}</p>
                                </details>
                                <button className="outline-btn" onClick={() => setResult(null)}>
                                    New input
                                </button>
                            </motion.div>
                        </motion.section>
                    )}
                </AnimatePresence>

                <footer>
                    <p>Demo • Movie Rating Predictor • v1.0</p>
                </footer>
            </main>
        </>
    );
}