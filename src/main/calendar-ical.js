// OLE OS — iCal Fetch & Expansion
// Verwendet `node-ical` für HTTP-Fetch, RFC 5545 Parser, RRULE-Expansion,
// EXDATE und RECURRENCE-ID Overrides. Schreibt `webcal://` zu `https://` um.
// Liefert normalisierte Event-Objekte im OLE OS Format.

const ical = require('node-ical');
const crypto = require('crypto');

function rewriteWebcal(url) {
    return String(url || '').replace(/^webcal:\/\//i, 'https://');
}

function safeDate(d) {
    try {
        const dt = d instanceof Date ? d : new Date(d);
        return Number.isNaN(dt.getTime()) ? null : dt;
    } catch {
        return null;
    }
}

function normalize(ev, { start, end, source, sub, override }) {
    const o = override || {};
    return {
        id: `${sub.id}:${ev.uid || crypto.randomUUID()}:${start.toISOString()}`,
        uid: ev.uid || '',
        title: String(o.summary ?? ev.summary ?? ''),
        description: String(o.description ?? ev.description ?? ''),
        location: String(o.location ?? ev.location ?? ''),
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: ev.datetype === 'date',
        source: source || 'subscription',
        sourceUrl: sub.url,
        sourceLabel: sub.label,
        sourceId: sub.id,
    };
}

/**
 * Fetch eine .ics-URL und liefert alle expandierten Events im Fenster [from, to].
 * Berücksichtigt RRULE, EXDATE, RECURRENCE-ID Overrides.
 */
async function fetchAndExpand(sub, from, to) {
    const httpsUrl = rewriteWebcal(sub.url);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);

    let data;
    try {
        data = await ical.async.fromURL(httpsUrl, {
            headers: { 'User-Agent': 'OLE-OS/1.0' },
            signal: ac.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    const out = [];
    for (const ev of Object.values(data)) {
        if (!ev || ev.type !== 'VEVENT') continue;

        const evStart = safeDate(ev.start);
        const evEnd = safeDate(ev.end) || evStart;
        if (!evStart || !evEnd) continue;

        // Single-Instance
        if (!ev.rrule) {
            if (evEnd >= from && evStart <= to) {
                out.push(normalize(ev, { start: evStart, end: evEnd, sub }));
            }
            continue;
        }

        // Recurring
        const duration = evEnd.getTime() - evStart.getTime();
        let occurrences = [];
        try {
            occurrences = ev.rrule.between(from, to, true) || [];
        } catch (e) {
            console.warn('[calendar-ical] rrule.between failed', sub.url, e?.message);
            continue;
        }

        for (const d of occurrences) {
            const occ = safeDate(d);
            if (!occ) continue;

            const dayKey = occ.toISOString().substring(0, 10);
            const fullKey = occ.toISOString();

            // EXDATE — kann date-only oder full-ISO key sein
            if (ev.exdate && (ev.exdate[dayKey] || ev.exdate[fullKey])) continue;

            // RECURRENCE-ID Overrides
            const override = ev.recurrences?.[dayKey] || ev.recurrences?.[fullKey];
            if (override) {
                const ovStart = safeDate(override.start) || occ;
                const ovEnd = safeDate(override.end) || new Date(ovStart.getTime() + duration);
                if (ovEnd >= from && ovStart <= to) {
                    out.push(normalize(ev, { start: ovStart, end: ovEnd, sub, override }));
                }
            } else {
                const occEnd = new Date(occ.getTime() + duration);
                out.push(normalize(ev, { start: occ, end: occEnd, sub }));
            }
        }
    }
    return out;
}

module.exports = { fetchAndExpand };
