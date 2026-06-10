// OLE OS — COROS OAuth + Health-Cache Storage
// OAuth-State (Tokens, DCR-Client-Info, PKCE-Verifier) wird via safeStorage
// (macOS Keychain) verschlüsselt persistiert. Health-Snapshot/Trends liegen
// unverschlüsselt in userData/coros-cache.json.

const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

function oauthPath() {
    return path.join(app.getPath('userData'), 'coros-oauth.json');
}

function cachePath() {
    return path.join(app.getPath('userData'), 'coros-cache.json');
}

// ── OAuth-State (verschlüsselt) ───────────────────────────────────
// Blob-Form: { tokens, clientInformation, codeVerifier }
function loadOAuth() {
    try {
        const p = oauthPath();
        if (!fs.existsSync(p)) return {};
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!raw.encrypted) return {};
        const decrypted = safeStorage.decryptString(Buffer.from(raw.encrypted, 'base64'));
        return JSON.parse(decrypted) || {};
    } catch (e) {
        console.error('[coros-store] loadOAuth failed:', e?.message);
        return {};
    }
}

function saveOAuth(blob) {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage not available — cannot persist COROS tokens securely');
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(blob)).toString('base64');
    fs.writeFileSync(oauthPath(), JSON.stringify({ encrypted }, null, 2), { mode: 0o600 });
}

function saveOAuthField(key, value) {
    const blob = loadOAuth();
    blob[key] = value;
    saveOAuth(blob);
}

function clearOAuth() {
    try { fs.unlinkSync(oauthPath()); } catch {}
}

function isConnected() {
    const { tokens } = loadOAuth();
    return !!(tokens && (tokens.access_token || tokens.refresh_token));
}

// ── Health-Cache (unverschlüsselt) ────────────────────────────────
function loadCache() {
    try {
        const p = cachePath();
        if (!fs.existsSync(p)) return null;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        console.error('[coros-store] loadCache failed:', e?.message);
        return null;
    }
}

function saveCache(cache) {
    fs.writeFileSync(cachePath(), JSON.stringify(cache, null, 2));
}

function clearCache() {
    try { fs.unlinkSync(cachePath()); } catch {}
}

module.exports = {
    loadOAuth, saveOAuth, saveOAuthField, clearOAuth, isConnected,
    loadCache, saveCache, clearCache,
};
