// OLE OS — Coach Tool Definitions + Dispatcher
// Schema-Definitionen für Anthropic Tool-Use + Mapping auf Stores.

const todoStore = require('./todo-store.js');
const coachPlanStore = require('./coach-plan-store.js');

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

async function dispatch(name, input, ctx = {}) {
    const { getHealthSummary, broadcastTodos } = ctx;
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
        default:
            throw new Error(`unknown_tool: ${name}`);
    }
}

module.exports = { TOOLS, dispatch };
