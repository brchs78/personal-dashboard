// OLE OS — Geteilte Datums-Helfer (Renderer)
// WICHTIG: IMMER lokale Kalenderdaten, NIE toISOString() — letzteres rechnet
// in UTC und kippt in DE-Zeitzone die lokale Mitternacht auf den Vortag.
// Spiegel von src/main/utils/date.js (getrennte Bundles Main/Renderer).

// Date-Objekt → 'YYYY-MM-DD' anhand der LOKALEN Kalenderfelder.
export function toLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// Heutiges lokales Datum als 'YYYY-MM-DD'.
export function todayISO() {
    return toLocalISO(new Date());
}

// ISO-Datum + n Tage (lokal) → 'YYYY-MM-DD'.
export function addDays(iso, n) {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return toLocalISO(d);
}

// Alter eines ISO-Datums in ganzen Tagen (lokal). null wenn kein Datum.
export function daysAgo(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((t - d) / 86400000);
}
