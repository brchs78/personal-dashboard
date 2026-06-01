// OLE OS — iCloud CalDAV (Stufe 2)
// Two-Way-Sync via `tsdav`: liest echte iCloud-Kalender und schreibt Coach/
// User-Events zurück. Credentials kommen verschlüsselt aus calendar-store
// (safeStorage). Roh-ICS wird mit node-ical geparst und über die gemeinsame
// `expandVEvents`-Logik expandiert.

const ical = require('node-ical');
const crypto = require('crypto');
const { createDAVClient } = require('tsdav');
const store = require('./calendar-store.js');
const { expandVEvents } = require('./calendar-ical.js');

const ICLOUD_URL = 'https://caldav.icloud.com';

// ── Client ────────────────────────────────────────────────────────
async function getClient() {
    const account = store.loadCalDAVAccount();
    if (!account.connected) throw new Error('caldav_not_connected');
    const password = store.getCalDAVPassword();
    if (!password) throw new Error('caldav_password_unavailable');
    return createDAVClient({
        serverUrl: ICLOUD_URL,
        credentials: { username: account.appleId, password },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
    });
}

// Validiert Credentials + liefert die Kalenderliste. Nutzt frische Creds
// (für den initialen Connect-Flow, bevor etwas persistiert wurde).
async function probeAndListCalendars(appleId, password) {
    const client = await createDAVClient({
        serverUrl: ICLOUD_URL,
        credentials: { username: appleId, password },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
    });
    const calendars = await client.fetchCalendars();
    return calendars
        .filter((c) => !c.components || c.components.includes('VEVENT'))
        .map((c) => ({
            url: c.url,
            displayName: typeof c.displayName === 'string' ? c.displayName : 'Kalender',
            ctag: c.ctag || null,
            readOnly: Array.isArray(c.privileges)
                ? !c.privileges.includes('write')
                : false,
        }));
}

// ── Lesen ─────────────────────────────────────────────────────────
function caldavEventBuilder(calendar) {
    return (ev, start, end, override) => {
        const o = override || {};
        return {
            id: `caldav:${calendar.url}:${ev.uid || crypto.randomUUID()}:${start.toISOString()}`,
            uid: ev.uid || '',
            title: String(o.summary ?? ev.summary ?? ''),
            description: String(o.description ?? ev.description ?? ''),
            location: String(o.location ?? ev.location ?? ''),
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: ev.datetype === 'date',
            source: 'caldav',
            writable: !calendar.readOnly,
            sourceLabel: calendar.displayName,
            caldav: {
                calendarUrl: calendar.url,
                objectUrl: ev._objectUrl || null,
                etag: ev._etag || null,
            },
        };
    };
}

// Fetch + expand alle Objekte eines Kalenders im Fenster [from, to].
async function fetchCalendarEvents(client, calendar, from, to) {
    const objects = await client.fetchCalendarObjects({
        calendar: { url: calendar.url },
        timeRange: { start: from.toISOString(), end: to.toISOString() },
    });

    const out = [];
    for (const obj of objects) {
        if (!obj?.data) continue;
        let parsed;
        try {
            parsed = ical.parseICS(obj.data);
        } catch (e) {
            console.warn('[calendar-caldav] parse failed', e?.message);
            continue;
        }
        // objectUrl + etag an jedes VEVENT hängen, damit der Builder sie sieht.
        for (const v of Object.values(parsed)) {
            if (v && v.type === 'VEVENT') {
                v._objectUrl = obj.url;
                v._etag = obj.etag;
            }
        }
        out.push(...expandVEvents(parsed, from, to, caldavEventBuilder(calendar)));
    }
    return out;
}

// ── ICS-Generierung (handgeschrieben, ein VEVENT) ─────────────────
function escapeICS(str) {
    return String(str || '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

function toICSDateUTC(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function toICSDateOnly(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

function buildICS(ev, uid) {
    const now = toICSDateUTC(new Date().toISOString());
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//OLE OS//Calendar//DE',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
    ];
    if (ev.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${toICSDateOnly(ev.start)}`);
        lines.push(`DTEND;VALUE=DATE:${toICSDateOnly(ev.end)}`);
    } else {
        lines.push(`DTSTART:${toICSDateUTC(ev.start)}`);
        lines.push(`DTEND:${toICSDateUTC(ev.end)}`);
    }
    lines.push(`SUMMARY:${escapeICS(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
}

// ── Schreiben ─────────────────────────────────────────────────────
async function createEvent(partial) {
    const account = store.loadCalDAVAccount();
    const calendarUrl = account.targetCalendarUrl;
    if (!calendarUrl) throw new Error('caldav_no_target_calendar');

    const uid = `${crypto.randomUUID()}@ole-os`;
    const filename = `${uid}.ics`;
    const start = partial.start ? new Date(partial.start).toISOString() : new Date().toISOString();
    const end = partial.end
        ? new Date(partial.end).toISOString()
        : new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
    const ev = {
        title: partial.title || 'Neuer Termin',
        start, end,
        allDay: !!partial.allDay,
        location: partial.location || '',
        description: partial.description || '',
    };
    const iCalString = buildICS(ev, uid);

    const client = await getClient();
    const res = await client.createCalendarObject({
        calendar: { url: calendarUrl },
        filename,
        iCalString,
    });
    if (res && res.ok === false) {
        throw new Error(`caldav_create_failed: ${res.status}`);
    }
    return {
        id: `caldav:${calendarUrl}:${uid}:${start}`,
        uid,
        ...ev,
        source: 'caldav',
        writable: true,
        sourceLabel: (account.calendars.find((c) => c.url === calendarUrl) || {}).displayName || 'iCloud',
        caldav: { calendarUrl, objectUrl: `${calendarUrl}${filename}`, etag: res?.etag || null },
    };
}

async function updateEvent(event, patch) {
    if (!event?.caldav?.objectUrl) throw new Error('caldav_missing_object_url');
    const uid = event.uid || `${crypto.randomUUID()}@ole-os`;
    const merged = {
        title: patch.title ?? event.title,
        start: patch.start ?? event.start,
        end: patch.end ?? event.end,
        allDay: patch.allDay ?? event.allDay,
        location: patch.location ?? event.location,
        description: patch.description ?? event.description,
    };
    const iCalString = buildICS(merged, uid);

    const client = await getClient();
    const res = await client.updateCalendarObject({
        calendarObject: {
            url: event.caldav.objectUrl,
            etag: event.caldav.etag,
            data: iCalString,
        },
    });
    if (res && res.ok === false) {
        if (res.status === 412) throw new Error('caldav_conflict_etag');
        throw new Error(`caldav_update_failed: ${res.status}`);
    }
    return { ...event, ...merged, caldav: { ...event.caldav, etag: res?.etag || event.caldav.etag } };
}

async function deleteEvent(event) {
    if (!event?.caldav?.objectUrl) throw new Error('caldav_missing_object_url');
    const client = await getClient();
    const res = await client.deleteCalendarObject({
        calendarObject: { url: event.caldav.objectUrl, etag: event.caldav.etag },
    });
    if (res && res.ok === false) {
        if (res.status === 412) throw new Error('caldav_conflict_etag');
        throw new Error(`caldav_delete_failed: ${res.status}`);
    }
    return { ok: true };
}

module.exports = {
    getClient,
    probeAndListCalendars,
    fetchCalendarEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    buildICS,
};
