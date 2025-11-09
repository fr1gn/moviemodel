import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ContentRatingSelect({
                                                value,
                                                onChange,
                                                options,
                                                placeholder = "Select...",
                                                disabled = false,
                                                maxHeight = 300,
                                                minHeightToOpen = 200,          // минимальное пространство для открытия вниз
                                                preferUp = false,               // если true, при равных условиях стараемся вверх
                                                forceDirection                 // "up" | "down" | undefined
                                            }) {
    const [open, setOpen] = useState(false);
    const [hoverIndex, setHoverIndex] = useState(-1);
    const [direction, setDirection] = useState("down"); // 'down' | 'up'
    const containerRef = useRef(null);
    const listRef = useRef(null);

    // Решаем направление при открытии
    function decideDirection() {
        if (forceDirection) {
            setDirection(forceDirection);
            return;
        }
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        // Выбор
        let chooseUp = false;
        if (spaceBelow < minHeightToOpen && spaceAbove > spaceBelow) chooseUp = true;
        if (preferUp && spaceAbove >= spaceBelow) chooseUp = true;
        setDirection(chooseUp ? "up" : "down");
    }

    // Клик по контейнеру
    function toggleOpen() {
        if (disabled) return;
        if (!open) {
            decideDirection();
            setOpen(true);
        } else {
            setOpen(false);
        }
    }

    // Close on outside click
    useEffect(() => {
        function onDocClick(e) {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    // Keyboard support
    useEffect(() => {
        if (!open) return;
        function onKey(e) {
            if (e.key === "Escape") { setOpen(false); return; }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setHoverIndex(i => {
                    const next = Math.min(options.length - 1, i + 1);
                    scrollIntoView(next);
                    return next;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHoverIndex(i => {
                    const next = Math.max(0, i - 1);
                    scrollIntoView(next);
                    return next;
                });
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (hoverIndex >= 0) selectOption(options[hoverIndex]);
            } else if (/^[A-Za-z]$/.test(e.key)) {
                const idx = options.findIndex(opt =>
                    opt.toLowerCase().startsWith(e.key.toLowerCase())
                );
                if (idx !== -1) {
                    setHoverIndex(idx);
                    scrollIntoView(idx);
                }
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, options, hoverIndex]);

    function selectOption(opt) {
        onChange && onChange(opt);
        setOpen(false);
    }

    function scrollIntoView(idx) {
        if (!listRef.current) return;
        const el = listRef.current.querySelector(`[data-idx='${idx}']`);
        if (el) {
            const parent = listRef.current;
            const top = el.offsetTop;
            const bottom = top + el.offsetHeight;
            if (top < parent.scrollTop) parent.scrollTop = top - 10;
            else if (bottom > parent.scrollTop + parent.clientHeight)
                parent.scrollTop = bottom - parent.clientHeight + 10;
        }
    }

    const label = value || placeholder;

    return (
        <div
            className={`cr-select ${open ? "open":""} ${disabled ? "disabled":""}`}
            ref={containerRef}
            tabIndex={disabled ? -1 : 0}
            onClick={toggleOpen}
            onKeyDown={e => {
                if (e.key === " " && !open) {
                    e.preventDefault();
                    decideDirection();
                    setOpen(true);
                } else if (e.key === "Escape") {
                    setOpen(false);
                }
            }}
            aria-haspopup="listbox"
            aria-expanded={open}
            data-direction={direction}
        >
            <div className="cr-selected">
                <span className={`cr-label ${!value ? "placeholder":""}`}>{label}</span>
                <span className="cr-arrow" />
            </div>

            <AnimatePresence>
                {open && (
                    <motion.ul
                        className={`cr-dropdown ${direction === "up" ? "drop-up" : "drop-down"}`}
                        ref={listRef}
                        role="listbox"
                        initial={direction === "up"
                            ? { opacity:0, y:8, scale:0.97 }
                            : { opacity:0, y:-8, scale:0.97 }}
                        animate={{ opacity:1, y:0, scale:1 }}
                        exit={direction === "up"
                            ? { opacity:0, y:8, scale:0.97 }
                            : { opacity:0, y:-4, scale:0.97 }}
                        transition={{ duration:0.18, ease:[0.16,0.72,0.35,1] }}
                        style={{ maxHeight }}
                    >
                        {options.map((opt,i) => {
                            const active = opt === value;
                            const hover = i === hoverIndex;
                            return (
                                <li
                                    key={opt}
                                    data-idx={i}
                                    role="option"
                                    aria-selected={active}
                                    className={`cr-item ${active ? "active":""} ${hover ? "hover":""}`}
                                    onMouseEnter={() => setHoverIndex(i)}
                                    onMouseLeave={() => setHoverIndex(-1)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectOption(opt);
                                    }}
                                >
                                    <span className="cr-text">{opt}</span>
                                    {active && <span className="cr-check">✓</span>}
                                </li>
                            );
                        })}
                        {options.length === 0 && (
                            <li className="cr-item empty">No options</li>
                        )}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}