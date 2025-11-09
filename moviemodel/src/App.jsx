import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ParticlesBg from "./components/ParticlesBg.jsx";
import GenreSelect from "./components/GenreSelect.jsx";
import ContentRatingSelect from "./components/ContentRatingSelect.jsx";
import { predict, getMeta } from "./api.js";

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

export default function App() {
    const [duration, setDuration] = useState("");
    const [budget, setBudget] = useState("");
    const [titleYear, setTitleYear] = useState("");
    const [contentRating, setContentRating] = useState("");
    const [genres, setGenres] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [animScore, setAnimScore] = useState(0);

    const [ratingsOptions, setRatingsOptions] = useState([]);
    const [genresOptions, setGenresOptions] = useState([]);

    useEffect(() => {
        getMeta()
            .then(m => {
                setRatingsOptions(m.allowed_content_ratings || []);
                setGenresOptions(m.genres_vocab || []);

            })
            .catch(e => {
                console.warn("Meta fetch failed:", e);
                setRatingsOptions(["G","PG","PG-13","R","NC-17","Unrated"]);
            });
    }, []);

    const isValid = useMemo(() => {
        const d = Number(duration);
        const b = Number(budget);
        const y = Number(titleYear);
        return Number.isFinite(d) && d >= 1 && d <= 400 &&
            Number.isFinite(b) && b >= 0 &&
            Number.isFinite(y) && y >= 1900 && y <= 2030 &&
            contentRating && genres.length > 0;
    }, [duration, budget, titleYear, contentRating, genres]);

    const animateScoreTo = (target) => {
        const steps = 40;
        let tick = 0;
        const interval = setInterval(() => {
            tick++;
            const progress = tick / steps;
            const eased = easeOutCubic(progress);
            const value = +(target * eased).toFixed(2);
            setAnimScore(value);
            if (tick >= steps) {
                setAnimScore(+target.toFixed(2));
                clearInterval(interval);
            }
        }, 25);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!isValid) {
            setError("Please check input fields.");
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
            animateScoreTo(data.predicted_score);
        } catch (err) {
            setError(err?.message || "API error");
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const resetAll = () => {
        setDuration("");
        setBudget("");
        setTitleYear("");
        setContentRating("");
        setGenres([]);
        setResult(null);
        setError(null);
        setAnimScore(0);
    };

    return (
        <>
            <ParticlesBg />
            <main className="container">
                <header>
                    <h1>IMDb Score Prediction</h1>
                    <p className="subtitle">Enter movie features to get predicted score (0–10)</p>
                </header>

                <motion.section
                    className="card"
                    initial={{ opacity:0, y:-16 }}
                    animate={{ opacity:1, y:0 }}
                >
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="field-group">
                            <label>Duration (min)</label>
                            <input type="number" min={1} max={400} value={duration}
                                   placeholder="e.g., 120"
                                   onChange={e => setDuration(e.target.value ? Number(e.target.value) : "")}/>
                            <small className="hint">1–400</small>
                        </div>

                        <div className="field-group">
                            <label>Budget (USD)</label>
                            <input type="number" min={0} step={1000} value={budget}
                                   placeholder="e.g., 150000000"
                                   onChange={e => setBudget(e.target.value ? Number(e.target.value) : "")}/>
                            <small className="hint">Integer</small>
                        </div>

                        <div className="field-group">
                            <label>Release year</label>
                            <input type="number" min={1900} max={2030} value={titleYear}
                                   placeholder="e.g., 2014"
                                   onChange={e => setTitleYear(e.target.value ? Number(e.target.value) : "")}/>
                        </div>

                        <div className="field-group">
                            <label>Genres</label>
                            <GenreSelect selected={genres} onChange={setGenres} options={genresOptions}/>
                            <small className="hint">Up to 6 genres</small>
                        </div>

                        <div className="field-group">
                            <label>Content rating</label>
                            <ContentRatingSelect
                                value={contentRating}
                                onChange={setContentRating}
                                options={ratingsOptions}
                                placeholder="Select..."
                                preferUp={true}          // необязательно, усилит выбор вверх при равных условиях
                                minHeightToOpen={180}    // настроить порог при котором переключается вверх
                            />
                        </div>





                        {error && <div role="alert" style={{color:"var(--danger)", fontSize:14}}>{error}</div>}

                        <div className="actions">
                            <button type="submit"
                                    className={`primary-btn ${loading ? "loading": ""}`}
                                    disabled={loading || !isValid}>
                                <span className="btn-label">{loading ? "Predicting..." : "Predict"}</span>
                                <span className="loader"/>
                            </button>
                            <button type="button" className="secondary-btn" onClick={resetAll}>Reset</button>
                        </div>
                    </form>
                </motion.section>

                <AnimatePresence>
                    {result && (
                        <motion.section
                            className="result-section"
                            initial={{opacity:0,y:16}}
                            animate={{opacity:1,y:0}}
                            exit={{opacity:0,y:16}}
                        >
                            <motion.div className="result-card" initial={{scale:.98,opacity:0}} animate={{scale:1,opacity:1}}>
                                <h2>Result</h2>
                                <div className="rating-display">
                                    <span>{animScore.toFixed(2)}</span>
                                    <span className="scale">/10</span>
                                </div>
                                <div className="confidence-bar">
                                    <div className="confidence-fill"
                                         style={{width: `${(result.confidence||0)*100}%`}}/>
                                </div>
                                <p className="confidence-text">
                                    Confidence (heuristic): {Math.round(result.confidence*100)}%
                                </p>
                                <details className="explanation" open>
                                    <summary>Model explanation</summary>
                                    <p>{result.explanation}</p>
                                </details>
                                <button className="outline-btn" onClick={()=>setResult(null)}>New input</button>
                            </motion.div>
                        </motion.section>
                    )}
                </AnimatePresence>

                <footer>
                    <p>Demo • IMDb Score Regression • v1.0</p>
                </footer>
            </main>
        </>
    );
}