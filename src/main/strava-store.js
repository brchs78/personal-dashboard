// OLE OS — Strava Token + Cache Storage
// Tokens werden via safeStorage (macOS Keychain) verschlüsselt persistiert.
// Activity-Cache liegt unverschlüsselt in userData/strava-cache.json.

const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

function tokenPath() {
    return path.join(app.getPath('userData'), 'strava-tokens.json');
}

function cachePath() {
    return path.join(app.getPath('userData'), 'strava-cache.json');
}

function loadTokens() {
    try {
        const p = tokenPath();
        if (!fs.existsSync(p)) return null;
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!raw.encrypted) return null;
        const decrypted = safeStorage.decryptString(Buffer.from(raw.encrypted, 'base64'));
        return JSON.parse(decrypted);
    } catch (e) {
        console.error('[strava-store] loadTokens failed:', e);
        return null;
    }
}

function saveTokens(tokens) {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage not available — cannot persist Strava tokens securely');
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(tokens)).toString('base64');
    fs.writeFileSync(tokenPath(), JSON.stringify({ encrypted }, null, 2), { mode: 0o600 });
}

function clearTokens() {
    try { fs.unlinkSync(tokenPath()); } catch {}
}

function loadCache() {
    try {
        const p = cachePath();
        if (!fs.existsSync(p)) return null;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        console.error('[strava-store] loadCache failed:', e);
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
    loadTokens, saveTokens, clearTokens,
    loadCache, saveCache, clearCache,
};
