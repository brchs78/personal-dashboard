// OLE OS — Calendar Sync Scheduler
// 15-min Polling aller eingetragenen Subscriptions. Promise.allSettled isoliert
// Fehler pro Quelle. In-flight Flag verhindert parallele Refreshes.

const store = require('./calendar-store.js');
const { fetchAndExpand } = require('./calendar-ical.js');

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

    async refreshAll() {
        if (this.inFlight) return;
        this.inFlight = true;
        try {
            const subs = store.loadSubscriptions();
            if (!subs.length) {
                this.onUpdated();
                return;
            }
            const results = await Promise.allSettled(
                subs.map((s) => this.refreshOne(s))
            );
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
            this.onUpdated();
        } finally {
            this.inFlight = false;
        }
    }
}

module.exports = { CalendarSync };
