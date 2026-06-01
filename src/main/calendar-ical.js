// OLE OS — iCal Fetch & Expansion
// Verwendet `node-ical` für HTTP-Fetch, RFC 5545 Parser, RRULE-Expansion,
// EXDATE und RECURRENCE-ID Overrides. Schreibt `webcal://` zu `https://` um.
// Die Expansion (`expandVEvents`) wird sowohl vom HTTP-Abo-Pfad als auch vom
// CalDAV-Pfad (Roh-ICS-Strings) genutzt.

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

/**
 * Expandiert geparste node-ical-Daten zu normalisierten Events im Fenster [from, to].
 * Berücksichtigt RRULE, EXDATE, RECURRENCE-ID Overrides.
 *
 * @param {object} parsed     Ergebnis von ical.parseICS / ical.async.fromURL
 * @param {Date}   from
 * @param {Date}   to
 * @param {(ev, start, end, override) => object} buildEvent
 *        Callback, der pro Instanz das fertige Event-Objekt liefert (quellen-spezifisch).
 */
function expandVEvents(parsed, from, to, buildEvent) {
    const out = [];
    for (const ev of Object.values(parsed)) {
        if (!ev || ev.type !== 'VEVENT') continue;

        const evStart = safeDate(ev.start);
        const evEnd = safeDate(ev.end) || evStart;
        if (!evStart || !evEnd) continue;

        // Single-Instance
        if (!ev.rrule) {
            if (evEnd >= from && evStart <= to) {
                out.push(buildEvent(ev, evStart, evEnd, null));
            }
            continue;
        }

        // Recurring
        const duration = evEnd.getTime() - evStart.getTime();
        let occurrences = [];
        try {
            occurrences = ev.rrule.between(from, to, true) || [];
        } catch (e) {
            console.warn('[calendar-ical] rrule.between failed', e?.message);
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
                    out.push(buildEvent(ev, ovStart, ovEnd, override));
                }
            } else {
                const occEnd = new Date(occ.getTime() + duration);
                out.push(buildEvent(ev, occ, occEnd, null));
            }
        }
    }
    return out;
}

// Event-Builder für read-only iCal-Subscriptions (Stufe 1)
function subscriptionEventBuilder(sub) {
    return (ev, start, end, override) => {
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
            source: 'subscription',
            writable: false,
            sourceUrl: sub.url,
            sourceLabel: sub.label,
            sourceId: sub.id,
        };
    };
}

/**
 * Fetch eine .ics-URL und liefert alle expandierten Events im Fenster [from, to].
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

    return expandVEvents(data, from, to, subscriptionEventBuilder(sub));
}

module.exports = { fetchAndExpand, expandVEvents, safeDate };
