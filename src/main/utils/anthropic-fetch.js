// OLE OS — fetch mit Retry/Backoff für Anthropic-Block-Calls
// Wiederholt nur bei transienten Fehlern (Netzwerk, 429, 5xx) — der
// Messages-POST ist bei einem Fehlschlag nebenwirkungsfrei, also sicher
// wiederholbar. Streaming-Chat nutzt das NICHT (eigene SSE-Logik).

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wiederholbare HTTP-Stati: Rate-Limit + Server-Fehler.
function isRetryableStatus(status) {
    return status === 429 || (status >= 500 && status < 600);
}

// fetch mit Retry. retries = zusätzliche Versuche nach dem ersten (default 2).
// Respektiert Retry-After (Sekunden) bei 429, sonst exponentielles Backoff.
async function fetchWithRetry(url, init, { retries = 2, baseDelay = 800 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const r = await fetch(url, init);
            if (r.ok || !isRetryableStatus(r.status) || attempt === retries) {
                return r;
            }
            const retryAfter = Number(r.headers.get('retry-after'));
            const delay = Number.isFinite(retryAfter) && retryAfter > 0
                ? retryAfter * 1000
                : baseDelay * 2 ** attempt;
            console.warn(`[anthropic] ${r.status}, retry ${attempt + 1}/${retries} in ${delay}ms`);
            await sleep(delay);
        } catch (e) {
            lastErr = e;
            if (attempt === retries) throw e;
            const delay = baseDelay * 2 ** attempt;
            console.warn(`[anthropic] network error, retry ${attempt + 1}/${retries} in ${delay}ms: ${e?.message}`);
            await sleep(delay);
        }
    }
    throw lastErr;
}

module.exports = { fetchWithRetry };
