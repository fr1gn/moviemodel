import React, { useEffect, useMemo, useRef, useState } from "react";

const GENRE_LIST = [
    "Action","Adventure","Sci-Fi","Drama","Comedy","Thriller","Animation","Fantasy",
    "Crime","Biography","Romance","Horror","Documentary","Mystery","Family","Music"
];

export default function GenreSelect({ selected, onChange, max = 6 }) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const items = useMemo(() => {
        const q = query.trim().toLowerCase();
        return GENRE_LIST.filter(
            (g) => g.toLowerCase().includes(q) && !selected.includes(g)
        );
    }, [query, selected]);

    useEffect(() => {
        const handler = (e) => {
            if (!ref.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, []);

    const add = (g) => {
        if (selected.length >= max) return;
        onChange([...selected, g]);
        setQuery("");
        setOpen(false);
    };

    const remove = (g) => {
        onChange(selected.filter((x) => x !== g));
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const val = query.trim();
            if (!val) return;
            const match = GENRE_LIST.find((g) => g.toLowerCase() === val.toLowerCase());
            const addValue = match || val[0].toUpperCase() + val.slice(1);
            if (!selected.includes(addValue) && selected.length < max) {
                onChange([...selected, addValue]);
            }
            setQuery("");
            setOpen(false);
        } else if (e.key === "Backspace" && !query && selected.length) {
            onChange(selected.slice(0, -1));
        }
    };

    return (
        <div className="multi-select" id="genresSelect" ref={ref}>
            <div className="tags">
                {selected.map((g) => (
                    <div className="tag" key={g}>
                        <span>{g}</span>
                        <button title="Remove" onClick={() => remove(g)}>✕</button>
                    </div>
                ))}
            </div>
            <input
                id="genreInput"
                placeholder="Type to search: Drama, Action..."
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(!!e.target.value);
                }}
                onFocus={() => setOpen(!!query)}
                onKeyDown={onKeyDown}
                autoComplete="off"
            />
            <div
                className="dropdown"
                style={{ display: open && items.length ? "block" : "none" }}
            >
                {items.map((item) => (
                    <div className="dropdown-item" key={item} onClick={() => add(item)}>
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
}