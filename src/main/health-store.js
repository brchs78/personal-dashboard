// OLE OS — Health Cache Store
// Persistiert die Parser-Aggregate in userData/health-cache.json.
// Reparse nur wenn Export.xml Mtime > Cache Mtime.

const fs = require('fs');
const os = require('os');
const path = require('path');

const SOURCE_PATH = path.join(os.homedir(), 'apple_health_export', 'Export.xml');

function cachePath(userDataDir) {
    return path.join(userDataDir, 'health-cache.json');
}

function sourceExists() {
    try { return fs.statSync(SOURCE_PATH).isFile(); } catch { return false; }
}

function sourceMtime() {
    try { return fs.statSync(SOURCE_PATH).mtimeMs; } catch { return 0; }
}

function load(userDataDir) {
    try {
        const raw = fs.readFileSync(cachePath(userDataDir), 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function save(userDataDir, aggregates) {
    fs.writeFileSync(cachePath(userDataDir), JSON.stringify(aggregates), 'utf8');
}

function clear(userDataDir) {
    try { fs.unlinkSync(cachePath(userDataDir)); } catch {}
}

// True wenn neu geparst werden muss (Source neuer als Cache oder Cache fehlt)
function needsReparse(userDataDir) {
    if (!sourceExists()) return false; // ohne Source kein Reparse möglich
    const cached = load(userDataDir);
    if (!cached || !cached.meta || !cached.meta.lastExportMtime) return true;
    return sourceMtime() > cached.meta.lastExportMtime;
}

module.exports = {
    SOURCE_PATH,
    sourceExists,
    sourceMtime,
    load,
    save,
    clear,
    needsReparse,
};
