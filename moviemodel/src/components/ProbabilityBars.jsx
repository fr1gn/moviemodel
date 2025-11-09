import React from "react";

export default function ProbabilityBars({ labels = [], probs = [] }) {
    const items = labels.map((label, i) => ({
        label,
        p: typeof probs[i] === "number" ? probs[i] : 0
    }));

    const maxP = Math.max(...items.map(i => i.p), 0.0001);

    return (
        <div className="probs-container">
            {items.map(({ label, p }) => (
                <div key={label} className="prob-row">
                    <div className="prob-label">{label}</div>
                    <div className="prob-bar-outer" title={`${(p*100).toFixed(0)}%`}>
                        <div
                            className="prob-bar-inner"
                            style={{
                                width: `${(p * 100).toFixed(0)}%`,
                                background: `linear-gradient(90deg, #10b981, #7f5af0)`
                            }}
                        />
                    </div>
                    <div className="prob-val">{(p * 100).toFixed(0)}%</div>
                </div>
            ))}
        </div>
    );
}