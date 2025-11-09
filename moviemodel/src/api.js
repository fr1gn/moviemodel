const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export async function getMeta() {
    const res = await fetch(API_BASE.replace(/\/+$/,"") + "/meta");
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function predict(payload) {
    const url = API_BASE.replace(/\/+$/,"") + "/predict";
    const res = await fetch(url, {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
    });
    if(!res.ok){
        let msg = `API error ${res.status}`;
        try { const data = await res.json(); msg = data?.detail || msg; } catch {}
        throw new Error(msg);
    }
    return res.json();
}