// OLE OS — Coach Tool Definitions + Dispatcher
// Schema-Definitionen für Anthropic Tool-Use + Mapping auf Stores.

const todoStore = require('./todo-store.js');
const coachPlanStore = require('./coach-plan-store.js');
const calendarStore = require('./calendar-store.js');
const calendarCaldav = require('./calendar-caldav.js');
const habitStore = require('./habit-store.js');
const stravaClient = require('./strava-client.js');
const stravaStore = require('./strava-store.js');

const TOOLS = [
    {
        name: 'list_todos',
        description: 'Liste Oles ToDos. Filter optional nach Bucket (today/week/overdue/inbox/all).',
        input_schema: {
            type: 'object',
            properties: {
                include_done: { type: 'boolean', description: 'Auch erledigte ToDos einschließen.' },
                filter: {
                    type: 'string',
                    enum: ['today', 'week', 'overdue', 'inbox', 'all'],
                    description: 'today = fällig heute; week = bis Sonntag; overdue = überfällig; inbox = ohne Datum; all = alle.',
                },
            },
        },
    },
    {
        name: 'add_todo',
        description: 'Lege ein neues ToDo an. dueDate als ISO YYYY-MM-DD.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Kurzer Titel der Aufgabe.' },
                priority: { type: 'integer', enum: [1, 2, 3], description: '1=hoch, 2=mittel, 3=niedrig.' },
                category: { type: 'string', enum: ['uni', 'sport', 'life', 'errands'] },
                dueDate: { type: 'string', description: 'YYYY-MM-DD oder weglassen für Inbox.' },
            },
            required: ['title'],
        },
    },
    {
        name: 'update_todo',
        description: 'Aktualisiere ein bestehendes ToDo. Nur die zu ändernden Felder im patch angeben.',
        input_schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                patch: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        priority: { type: 'integer', enum: [1, 2, 3] },
                        category: { type: 'string', enum: ['uni', 'sport', 'life', 'errands'] },
                        dueDate: { type: 'string', description: 'YYYY-MM-DD oder leerer String für Inbox.' },
                    },
                },
            },
            required: ['id', 'patch'],
        },
    },
    {
        name: 'complete_todo',
        description: 'Markiere ein ToDo als erledigt (idempotent).',
        input_schema: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
        },
    },
    {
        name: 'remove_todo',
        description: 'Lösche ein ToDo dauerhaft.',
        input_schema: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
        },
    },
    {
        name: 'get_training_today',
        description: 'Hole die heutige geplante Trainings-Session aus dem aktuellen Wochenplan. Liefert null wenn kein Plan vorhanden oder heute kein Eintrag.',
        input_schema: { type: 'object', properties: {} },
    },
    {
        name: 'get_recovery_status',
        description: 'Hole den aktuellen Recovery-Snapshot (RHR, HRV, Schlaf, HR-Recovery 1min). Liefert null wenn keine Health-Daten verfügbar.',
        input_schema: { type: 'object', properties: {} },
    },
    {
        name: 'list_calendar_events',
        description: 'Liste Kalendertermine im Zeitraum. Liefert externe (read-only) UND interne (Coach-erstellte) Events. Default = aktuelle Woche.',
        input_schema: {
            type: 'object',
            properties: {
                from: { type: 'string', description: 'ISO 8601 Start (default: heute 00:00).' },
                to: { type: 'string', description: 'ISO 8601 Ende (default: in 7 Tagen).' },
            },
        },
    },
    {
        name: 'create_calendar_event',
        description: 'Lege einen internen Kalendertermin an. Default-Dauer 60 Minuten falls end fehlt.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                start: { type: 'string', description: 'ISO 8601 Startzeitpunkt.' },
                end: { type: 'string', description: 'ISO 8601 Endzeitpunkt (optional, default +60min).' },
                allDay: { type: 'boolean' },
                location: { type: 'string' },
                description: { type: 'string' },
            },
            required: ['title', 'start'],
        },
    },
    {
        name: 'update_calendar_event',
        description: 'Aktualisiere einen internen Kalendertermin. Externe Subscription-Events sind read-only.',
        input_schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                patch: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        start: { type: 'string' },
                        end: { type: 'string' },
                        allDay: { type: 'boolean' },
                        location: { type: 'string' },
                        description: { type: 'string' },
                    },
                },
            },
            required: ['id', 'patch'],
        },
    },
    {
        name: 'delete_calendar_event',
        description: 'Lösche einen internen Kalendertermin. Externe Subscription-Events können nicht gelöscht werden.',
        input_schema: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
        },
    },
    {
        name: 'list_habits',
        description: 'Gibt alle aktiven Gewohnheiten (Habits) zurück inkl. heutigem Completion-Status, aktuellem Streak und Checkin-History der letzten 14 Tage.',
        input_schema: { type: 'object', properties: {} },
    },
    {
        name: 'log_habit',
        description: 'Markiert eine Gewohnheit für ein bestimmtes Datum als erledigt oder nicht erledigt.',
        input_schema: {
            type: 'object',
            properties: {
                id:   { type: 'string', description: 'Habit-ID aus list_habits.' },
                date: { type: 'string', description: 'YYYY-MM-DD — wenn weggelassen wird heute verwendet.' },
                done: { type: 'boolean', description: 'true = erledigt, false = rückgängig machen.' },
            },
            required: ['id', 'done'],
        },
    },
    {
        name: 'get_habit_summary',
        description: 'Gibt eine Zusammenfassung aller aktiven Gewohnheiten: aktueller Streak, beste Streak, Completion-Rate letzte 7 und 30 Tage.',
        input_schema: { type: 'object', properties: {} },
    },
    {
        name: 'get_recent_activities',
        description: 'Hole Oles letzte Strava-Aktivitäten. Default: letzte 7 Tage. Liefert Typ, Distanz, Pace, Herzfrequenz, Datum etc.',
        input_schema: {
            type: 'object',
            properties: {
                days: { type: 'integer', description: 'Zeitraum in Tagen rückwärts (default 7, max 90).' },
                type: { type: 'string', description: 'Aktivitätstyp filtern, z.B. "Run", "Ride", "IceHockey". Leer = alle.' },
            },
        },
    },
    {
        name: 'get_activity_detail',
        description: 'Hole Detail-Daten einer einzelnen Strava-Aktivität (Splits, HR-Zonen, Pace, Elevation, Laps). Braucht die Activity-ID aus get_recent_activities.',
        input_schema: {
            type: 'object',
            properties: {
                id: { type: 'number', description: 'Strava Activity ID.' },
            },
            required: ['id'],
        },
    },
];

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function endOfWeekISO() {
    const d = new Date();
    const day = d.getDay(); // 0=So .. 6=Sa
    const diff = day === 0 ? 0 : 7 - day; // bis nächsten Sonntag
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

function filterTodos(items, { include_done = false, filter = 'all' } = {}) {
    const today = todayISO();
    const weekEnd = endOfWeekISO();
    let out = items;
    if (!include_done) out = out.filter((i) => !i.completedAt);
    if (filter === 'today') {
        out = out.filter((i) => i.dueDate === today);
    } else if (filter === 'overdue') {
        out = out.filter((i) => i.dueDate && i.dueDate < today && !i.completedAt);
    } else if (filter === 'week') {
        out = out.filter((i) => i.dueDate && i.dueDate >= today && i.dueDate <= weekEnd);
    } else if (filter === 'inbox') {
        out = out.filter((i) => !i.dueDate);
    }
    return out;
}

function caldavWriteEnabled() {
    const a = calendarStore.loadCalDAVAccount();
    return a.connected && !!a.targetCalendarUrl;
}

function getStravaCreds() {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
}

async function dispatch(name, input, ctx = {}) {
    const { getHealthSummary, broadcastTodos, broadcastCalendar, refreshCalendar } = ctx;
    const args = input || {};
    switch (name) {
        case 'list_todos': {
            const all = todoStore.loadAll();
            const items = filterTodos(all.items, args).map((i) => ({
                id: i.id,
                title: i.title,
                category: i.category,
                priority: i.priority,
                dueDate: i.dueDate,
                completedAt: i.completedAt,
            }));
            return { items, total: items.length };
        }
        case 'add_todo': {
            const item = todoStore.add(args);
            broadcastTodos?.();
            return item;
        }
        case 'update_todo': {
            const { id, patch } = args;
            if (!id) throw new Error('missing_id');
            const item = todoStore.update(id, patch || {});
            if (!item) throw new Error(`todo_not_found: ${id}`);
            broadcastTodos?.();
            return item;
        }
        case 'complete_todo': {
            const { id } = args;
            if (!id) throw new Error('missing_id');
            const cur = todoStore.loadAll().items.find((i) => i.id === id);
            if (!cur) throw new Error(`todo_not_found: ${id}`);
            if (cur.completedAt) {
                return { ok: true, completedAt: cur.completedAt, already_completed: true };
            }
            const item = todoStore.toggleDone(id);
            broadcastTodos?.();
            return { ok: true, completedAt: item.completedAt };
        }
        case 'remove_todo': {
            const { id } = args;
            if (!id) throw new Error('missing_id');
            const cur = todoStore.loadAll().items.find((i) => i.id === id);
            if (!cur) throw new Error(`todo_not_found: ${id}`);
            todoStore.remove(id);
            broadcastTodos?.();
            return { ok: true };
        }
        case 'get_training_today': {
            const plan = coachPlanStore.loadCurrent();
            if (!plan?.days) return null;
            const today = todayISO();
            const day = plan.days.find((d) => d.date === today);
            return day || null;
        }
        case 'get_recovery_status': {
            const summary = getHealthSummary?.();
            if (!summary?.latest) return null;
            const l = summary.latest;
            return {
                rhr: l.rhr ? { value: l.rhr.value, date: l.rhr.date } : null,
                hrv: l.hrv ? { value: l.hrv.value, date: l.hrv.date } : null,
                hrRecovery: l.hrRecovery ? { value: l.hrRecovery.value, date: l.hrRecovery.date } : null,
                sleep: l.sleep ? {
                    totalMin: l.sleep.totalMin,
                    date: l.sleep.date,
                    stages: l.sleep.stages || null,
                } : null,
            };
        }
        case 'list_calendar_events': {
            const now = new Date();
            const from = args.from ? new Date(args.from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const to = args.to ? new Date(args.to) : new Date(from.getTime() + 7 * 86400_000);
            const events = calendarStore.loadAllForRange(from.toISOString(), to.toISOString())
                .map((e) => ({
                    id: e.id,
                    title: e.title,
                    start: e.start,
                    end: e.end,
                    allDay: !!e.allDay,
                    location: e.location || '',
                    source: e.source,
                    sourceLabel: e.sourceLabel || null,
                }));
            return { events, total: events.length };
        }
        case 'create_calendar_event': {
            if (!args.title || !args.start) throw new Error('missing_title_or_start');
            let ev;
            if (caldavWriteEnabled()) {
                ev = await calendarCaldav.createEvent(args);
                await refreshCalendar?.();
            } else {
                ev = calendarStore.addInternalEvent(args);
            }
            broadcastCalendar?.();
            return ev;
        }
        case 'update_calendar_event': {
            const { id, patch } = args;
            if (!id) throw new Error('missing_id');
            // Erst CalDAV, dann internal, dann subscription (read-only).
            const cdav = calendarStore.findCalDAVEvent(id);
            if (cdav) {
                const ev = await calendarCaldav.updateEvent(cdav, patch || {});
                await refreshCalendar?.();
                broadcastCalendar?.();
                return ev;
            }
            const cur = calendarStore.findInternalEvent(id);
            if (!cur) {
                const ext = calendarStore.getAllSubscriptionEvents().find((e) => e.id === id);
                if (ext) throw new Error('event_is_read_only_subscription');
                throw new Error(`event_not_found: ${id}`);
            }
            const ev = calendarStore.updateInternalEvent(id, patch || {});
            broadcastCalendar?.();
            return ev;
        }
        case 'delete_calendar_event': {
            const { id } = args;
            if (!id) throw new Error('missing_id');
            const cdav = calendarStore.findCalDAVEvent(id);
            if (cdav) {
                const r = await calendarCaldav.deleteEvent(cdav);
                await refreshCalendar?.();
                broadcastCalendar?.();
                return r;
            }
            const cur = calendarStore.findInternalEvent(id);
            if (!cur) {
                const ext = calendarStore.getAllSubscriptionEvents().find((e) => e.id === id);
                if (ext) throw new Error('event_is_read_only_subscription');
                throw new Error(`event_not_found: ${id}`);
            }
            const r = calendarStore.deleteInternalEvent(id);
            broadcastCalendar?.();
            return r;
        }
        case 'list_habits': {
            const { habits, checkins } = habitStore.getAll();
            const streaks = habitStore.getStreaks();
            const today = todayISO();
            const active = habits.filter((h) => !h.archived);
            // Build 14-day history per habit
            const history14 = [];
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                history14.push(d.toISOString().slice(0, 10));
            }
            return {
                habits: active.map((h) => ({
                    id: h.id,
                    name: h.name,
                    emoji: h.emoji,
                    identity: h.identity,
                    category: h.category,
                    streak: streaks[h.id] || 0,
                    doneToday: Array.isArray(checkins[today]) && checkins[today].includes(h.id),
                    last14days: history14.map((d) => ({
                        date: d,
                        done: Array.isArray(checkins[d]) && checkins[d].includes(h.id),
                    })),
                })),
                todayScore: {
                    done: (checkins[today] || []).filter((id) => active.some((h) => h.id === id)).length,
                    total: active.length,
                },
            };
        }
        case 'log_habit': {
            const { id, date, done } = args;
            if (!id) throw new Error('missing_id');
            const d = date || todayISO();
            habitStore.checkin(id, d, done);
            return { ok: true, id, date: d, done };
        }
        case 'get_habit_summary': {
            return habitStore.getStats(30);
        }
        case 'get_recent_activities': {
            const creds = getStravaCreds();
            if (!creds) return { error: 'strava_not_configured', activities: [] };
            const tokens = stravaStore.loadTokens();
            if (!tokens) return { error: 'strava_not_connected', activities: [] };
            const days = Math.min(args.days || 7, 90);
            const after = Math.floor(Date.now() / 1000) - days * 86400;
            try {
                const raw = await stravaClient.listActivities(creds, { perPage: 50, after });
                let activities = raw.map((a) => ({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    sport_type: a.sport_type,
                    date: a.start_date_local,
                    distance_km: +(a.distance / 1000).toFixed(2),
                    moving_time_min: +(a.moving_time / 60).toFixed(1),
                    elapsed_time_min: +(a.elapsed_time / 60).toFixed(1),
                    pace_min_km: a.distance > 0 ? +((a.moving_time / 60) / (a.distance / 1000)).toFixed(2) : null,
                    avg_heartrate: a.average_heartrate || null,
                    max_heartrate: a.max_heartrate || null,
                    total_elevation_m: a.total_elevation_gain || 0,
                    avg_speed_kmh: a.average_speed ? +(a.average_speed * 3.6).toFixed(1) : null,
                    suffer_score: a.suffer_score || null,
                    calories: a.calories || null,
                }));
                if (args.type) {
                    const t = args.type.toLowerCase();
                    activities = activities.filter((a) =>
                        a.type?.toLowerCase() === t || a.sport_type?.toLowerCase() === t
                    );
                }
                return { activities, count: activities.length };
            } catch (e) {
                return { error: String(e?.message || e), activities: [] };
            }
        }
        case 'get_activity_detail': {
            const creds = getStravaCreds();
            if (!creds) return { error: 'strava_not_configured' };
            const tokens = stravaStore.loadTokens();
            if (!tokens) return { error: 'strava_not_connected' };
            if (!args.id) throw new Error('missing_activity_id');
            try {
                const a = await stravaClient.getActivity(creds, args.id);
                return {
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    sport_type: a.sport_type,
                    date: a.start_date_local,
                    distance_km: +(a.distance / 1000).toFixed(2),
                    moving_time_min: +(a.moving_time / 60).toFixed(1),
                    pace_min_km: a.distance > 0 ? +((a.moving_time / 60) / (a.distance / 1000)).toFixed(2) : null,
                    avg_heartrate: a.average_heartrate || null,
                    max_heartrate: a.max_heartrate || null,
                    total_elevation_m: a.total_elevation_gain || 0,
                    calories: a.calories || null,
                    suffer_score: a.suffer_score || null,
                    description: a.description || null,
                    splits_metric: (a.splits_metric || []).map((s) => ({
                        km: s.split,
                        time_sec: s.moving_time,
                        pace_min_km: s.moving_time ? +(s.moving_time / 60).toFixed(2) : null,
                        avg_heartrate: s.average_heartrate || null,
                        elevation_diff: s.elevation_difference || 0,
                    })),
                    laps: (a.laps || []).map((l) => ({
                        name: l.name,
                        distance_km: +(l.distance / 1000).toFixed(2),
                        time_min: +(l.moving_time / 60).toFixed(1),
                        avg_heartrate: l.average_heartrate || null,
                        max_heartrate: l.max_heartrate || null,
                        pace_min_km: l.distance > 0 ? +((l.moving_time / 60) / (l.distance / 1000)).toFixed(2) : null,
                    })),
                    has_heartrate: a.has_heartrate || false,
                    device_name: a.device_name || null,
                };
            } catch (e) {
                return { error: String(e?.message || e) };
            }
        }
        default:
            throw new Error(`unknown_tool: ${name}`);
    }
}

module.exports = { TOOLS, dispatch };
