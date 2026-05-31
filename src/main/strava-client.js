// OLE OS — Strava API Client
// Auto-refresh: prüft vor jedem Call ob access_token <5 min Gültigkeit hat,
// holt sonst neuen via refresh_token. Rate-limit-aware (Throttle bei 429).

const auth = require('./strava-auth.js');
const store = require('./strava-store.js');

const API_BASE = 'https://www.strava.com/api/v3';
const REFRESH_BUFFER_SEC = 300; // 5 min vor Ablauf refreshen

function nowSec() { return Math.floor(Date.now() / 1000); }

async function ensureFreshToken(clientId, clientSecret) {
    const tokens = store.loadTokens();
    if (!tokens) throw new Error('not_connected');
    if (tokens.expires_at - nowSec() > REFRESH_BUFFER_SEC) return tokens;

    const refreshed = await auth.refreshAccessToken(clientId, clientSecret, tokens.refresh_token);
    const merged = { ...tokens, ...refreshed };
    store.saveTokens(merged);
    return merged;
}

async function apiGet(path, { clientId, clientSecret, query = {} } = {}) {
    const tokens = await ensureFreshToken(clientId, clientSecret);
    const url = new URL(`${API_BASE}${path}`);
    for (const [k, v] of Object.entries(query)) {
        if (v != null) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (res.status === 401) throw new Error('unauthorized');
    if (res.status === 429) throw new Error('rate_limited');
    if (!res.ok) throw new Error(`strava api ${res.status}: ${await res.text()}`);
    return await res.json();
}

async function getAthlete(creds) {
    return apiGet('/athlete', creds);
}

// per_page max 200, default 30
async function listActivities(creds, { perPage = 30, page = 1, before, after } = {}) {
    return apiGet('/athlete/activities', {
        ...creds,
        query: { per_page: perPage, page, before, after },
    });
}

async function getActivity(creds, id) {
    return apiGet(`/activities/${id}`, creds);
}

module.exports = { getAthlete, listActivities, getActivity, ensureFreshToken };
