// OLE OS — Geteilte Datums-Helfer (Main-Process)
// WICHTIG: IMMER lokale Kalenderdaten, NIE toISOString() — letzteres rechnet
// in UTC und kippt in DE-Zeitzone die lokale Mitternacht auf den Vortag.
// Renderer hat ein eigenes Spiegel-Modul (src/renderer/src/lib/date.js).

// Date-Objekt → 'YYYY-MM-DD' anhand der LOKALEN Kalenderfelder.
function toLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Heutiges lokales Datum als 'YYYY-MM-DD'.
function todayISO() {
    return toLocalISO(new Date());
}

// ISO-Datum + n Tage (lokal) → 'YYYY-MM-DD'.
function addDays(iso, n) {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return toLocalISO(d);
}

// Alter eines ISO-Datums in ganzen Tagen (lokal). null wenn kein Datum.
function daysAgo(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((t - d) / 86400000);
}

// Datum des kommenden Sonntags (lokal) als 'YYYY-MM-DD'. Heute, wenn Sonntag.
function endOfWeekISO() {
    const d = new Date();
    const day = d.getDay(); // 0=So .. 6=Sa
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    return toLocalISO(d);
}

module.exports = { toLocalISO, todayISO, addDays, daysAgo, endOfWeekISO };
