// OLE OS — COROS MCP-Client (Streamable HTTP + OAuth)
// Verbindet den Main-Prozess als MCP-Client mit dem offiziellen COROS-MCP-Server,
// ruft dessen read-only Tools auf und normalisiert sie auf eine Health-Summary,
// die a) das Renderer-Tab und b) die Coach-Tools konsumieren.
//
// WICHTIG: Die exakten COROS-Toolnamen/Schemas stehen erst zur Laufzeit fest.
// getHealthSnapshot() entdeckt sie via listTools() und matcht per Keyword.
// listToolsRaw() loggt die echten Namen — danach kann das CATEGORY-Mapping
// bei Bedarf präzisiert werden.

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { UnauthorizedError } = require('@modelcontextprotocol/sdk/client/auth.js');
const auth = require('./coros-auth.js');
const store = require('./coros-store.js');

// Regionaler Endpoint (EU). Bei Bedarf konfigurierbar machen.
const COROS_MCP_URL = process.env.COROS_MCP_URL || 'https://mcpeu.coros.com/mcp';

let _client = null;

function newClientPair() {
    const provider = auth.createAuthProvider();
    const transport = new StreamableHTTPClientTransport(new URL(COROS_MCP_URL), { authProvider: provider });
    const client = new Client({ name: 'ole-os', version: '1.0.0' }, { capabilities: {} });
    return { client, transport };
}

// Verbindet. Bei interactive=true wird im Unauthorized-Fall der Browser-OAuth-Flow
// gestartet; sonst nur mit vorhandenem (auto-refreshtem) Token verbunden.
async function ensureClient({ interactive = false } = {}) {
    if (_client) return _client;
    if (!interactive && !store.isConnected()) {
        throw new Error('coros_not_connected');
    }

    const { client, transport } = newClientPair();

    if (!interactive) {
        await client.connect(transport);
        _client = client;
        return client;
    }

    // Interaktiv: Callback-Server VOR connect starten (redirectToAuthorization
    // öffnet den Browser synchron während connect()).
    const cb = auth.startCallbackServer();
    try {
        try {
            await client.connect(transport);
        } catch (e) {
            if (e instanceof UnauthorizedError) {
                const code = await cb.codePromise;
                await transport.finishAuth(code);
                await client.connect(transport);
            } else {
                throw e;
            }
        }
    } finally {
        cb.close();
    }
    _client = client;
    return client;
}

async function connect() {
    await ensureClient({ interactive: true });
    return { connected: true };
}

async function disconnect() {
    try { await _client?.close(); } catch {}
    _client = null;
    store.clearOAuth();
    store.clearCache();
    return { connected: false };
}

function parseToolResult(res) {
    const parts = (res?.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text);
    const text = parts.join('\n');
    try { return JSON.parse(text); } catch { return text; }
}

async function callTool(name, args = {}) {
    const client = await ensureClient();
    const res = await client.callTool({ name, arguments: args });
    return parseToolResult(res);
}

async function listToolsRaw() {
    const client = await ensureClient();
    const { tools } = await client.listTools();
    return tools || [];
}

// ── Health-Snapshot ───────────────────────────────────────────────
// Keyword-Mapping auf COROS-Tool-Kategorien. Mehrere Keywords je Kategorie,
// damit es gegen unterschiedliche Benennungen robust ist.
const CATEGORY_KEYWORDS = {
    daily:    ['daily', 'metric', 'overview', 'summary'],
    sleep:    ['sleep', 'schlaf'],
    hrv:      ['hrv', 'variability'],
    recovery: ['recovery', 'readiness'],
    vo2max:   ['vo2', 'vo2max'],
    load:     ['load', 'training-load', 'trainingload'],
    profile:  ['profile', 'user'],
};

function findTool(tools, keywords) {
    return tools.find((t) => {
        const n = (t.name || '').toLowerCase();
        return keywords.some((k) => n.includes(k));
    });
}

// Sucht in einem (verschachtelten) Objekt nach dem ersten numerischen Wert
// unter einem der angegebenen Key-Namen (case-insensitive, shallow+1).
function pickNum(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    const lowerKeys = keys.map((k) => k.toLowerCase());
    for (const [k, v] of Object.entries(obj)) {
        if (lowerKeys.includes(k.toLowerCase()) && typeof v === 'number') return v;
    }
    for (const v of Object.values(obj)) {
        if (v && typeof v === 'object') {
            const found = pickNum(v, keys);
            if (found != null) return found;
        }
    }
    return null;
}

// Best-effort-Normalisierung der rohen Tool-Outputs auf die UI-Form.
// raw bleibt im Snapshot erhalten, falls Felder nicht getroffen werden.
function normalize(raw) {
    const today = new Date().toISOString().slice(0, 10);
    const sleepRaw = raw.sleep || raw.daily;
    const totalMin = pickNum(sleepRaw, ['totalMin', 'totalMinutes', 'sleepMinutes', 'durationMin', 'totalSleep']);
    const sleep = totalMin != null ? {
        totalMin,
        date: today,
        stages: {
            deep:  pickNum(sleepRaw, ['deep', 'deepMin', 'deepSleep']) || 0,
            core:  pickNum(sleepRaw, ['core', 'light', 'lightMin', 'coreSleep']) || 0,
            rem:   pickNum(sleepRaw, ['rem', 'remMin', 'remSleep']) || 0,
            awake: pickNum(sleepRaw, ['awake', 'awakeMin', 'wake']) || 0,
        },
    } : null;

    const mk = (v) => (v != null ? { value: v, date: today } : null);

    return {
        latest: {
            sleep,
            rhr:          mk(pickNum(raw.daily || raw, ['restingHr', 'rhr', 'restingHeartRate'])),
            hrv:          mk(pickNum(raw.hrv || raw.daily || raw, ['hrv', 'rmssd', 'sdnn'])),
            recovery:     mk(pickNum(raw.recovery || raw, ['recovery', 'recoveryScore', 'readiness'])),
            vo2max:       mk(pickNum(raw.vo2max || raw, ['vo2max', 'vo2Max', 'vo2'])),
            trainingLoad: mk(pickNum(raw.load || raw, ['trainingLoad', 'load', 'sevenDayLoad'])),
        },
        meta: { source: 'coros-mcp', syncedAt: new Date().toISOString() },
        raw,
    };
}

// Ruft die relevanten COROS-Tools und baut einen normalisierten Snapshot.
async function getHealthSnapshot() {
    const tools = await listToolsRaw();
    try { console.log('[coros] tools:', tools.map((t) => t.name).join(', ')); } catch {}

    const raw = {};
    for (const [cat, kw] of Object.entries(CATEGORY_KEYWORDS)) {
        const tool = findTool(tools, kw);
        if (!tool) continue;
        try {
            raw[cat] = await callTool(tool.name, {});
        } catch (e) {
            raw[cat] = { error: String(e?.message || e) };
        }
    }

    const snapshot = normalize(raw);
    store.saveCache(snapshot);
    return snapshot;
}

module.exports = {
    COROS_MCP_URL,
    connect, disconnect, ensureClient,
    callTool, listToolsRaw, getHealthSnapshot,
};
