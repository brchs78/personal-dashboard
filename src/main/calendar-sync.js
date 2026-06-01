// OLE OS — Calendar Sync Scheduler
// 15-min Polling aller eingetragenen Subscriptions. Promise.allSettled isoliert
// Fehler pro Quelle. In-flight Flag verhindert parallele Refreshes.

const store = require('./calendar-store.js');
const { fetchAndExpand } = require('./calendar-ical.js');
const caldav = require('./calendar-caldav.js');

const REFRESH_MS = 15 * 60 * 1000;
const HORIZON_DAYS_FORWARD = 30;
const HORIZON_DAYS_BACK = 7;

class CalendarSync {
    constructor({ onUpdated } = {}) {
        this.onUpdated = onUpdated || (() => {});
        this.timer = null;
        this.inFlight = false;
    }

    start() {
        this.refreshAll().catch((e) => console.warn('[calendar-sync] initial refresh failed', e?.message));
        this.timer = setInterval(() => {
            this.refreshAll().catch((e) => console.warn('[calendar-sync] interval refresh failed', e?.message));
        }, REFRESH_MS);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    async refreshOne(sub) {
        const now = new Date();
        const from = new Date(now.getTime() - HORIZON_DAYS_BACK * 86400_000);
        const to = new Date(now.getTime() + HORIZON_DAYS_FORWARD * 86400_000);
        const events = await fetchAndExpand(sub, from, to);
        store.setSubscriptionEvents(sub.id, events);
        store.updateSubscriptionMeta(sub.id, {
            lastFetchedAt: new Date().toISOString(),
            lastError: null,
        });
        return events.length;
    }

    // Synct die selektierten iCloud-CalDAV-Kalender. ctag-Short-Circuit:
    // unveränderter Kalender (gleicher ctag wie im Cache) wird übersprungen.
    async refreshCalDAV() {
        const account = store.loadCalDAVAccount();
        if (!account.connected) return;
        const selected = (account.calendars || []).filter((c) =>
            (account.selectedCalendars || []).includes(c.url)
        );
        if (!selected.length) return;

        const now = new Date();
        const from = new Date(now.getTime() - HORIZON_DAYS_BACK * 86400_000);
        const to = new Date(now.getTime() + HORIZON_DAYS_FORWARD * 86400_000);

        let client;
        try {
            client = await caldav.getClient();
        } catch (e) {
            const msg = String(e?.message || e);
            console.warn('[calendar-sync] caldav client failed', msg);
            store.updateCalDAVAccountMeta({ lastError: msg });
            return;
        }

        const results = await Promise.allSettled(
            selected.map(async (cal) => {
                const cachedCtag = store.getCalDAVCalendarCtag(cal.url);
                if (cal.ctag && cachedCtag && cal.ctag === cachedCtag) return;
                const events = await caldav.fetchCalendarEvents(client, cal, from, to);
                store.setCalDAVCalendarEvents(cal.url, events, cal.ctag);
            })
        );
        const firstError = results.find((r) => r.status === 'rejected');
        store.updateCalDAVAccountMeta({
            lastSync: new Date().toISOString(),
            lastError: firstError ? String(firstError.reason?.message || firstError.reason) : null,
        });
        if (firstError) {
            console.warn('[calendar-sync] caldav fetch failed', firstError.reason?.message || firstError.reason);
        }
    }

    async refreshAll() {
        if (this.inFlight) return;
        this.inFlight = true;
        try {
            const subs = store.loadSubscriptions();
            const tasks = [];
            if (subs.length) {
                tasks.push(
                    Promise.allSettled(subs.map((s) => this.refreshOne(s))).then((results) => {
                        results.forEach((r, i) => {
                            if (r.status === 'rejected') {
                                const msg = String(r.reason?.message || r.reason);
                                console.warn('[calendar-sync] fetch failed', subs[i].url, msg);
                                store.updateSubscriptionMeta(subs[i].id, {
                                    lastFetchedAt: new Date().toISOString(),
                                    lastError: msg,
                                });
                            }
                        });
                    })
                );
            }
            tasks.push(
                this.refreshCalDAV().catch((e) =>
                    console.warn('[calendar-sync] caldav refresh failed', e?.message)
                )
            );
            await Promise.all(tasks);
            this.onUpdated();
        } finally {
            this.inFlight = false;
        }
    }
}

module.exports = { CalendarSync };
