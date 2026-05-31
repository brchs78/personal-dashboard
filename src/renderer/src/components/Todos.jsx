// OLE OS — ToDo Tab
// Vollständig interaktiv: Add/Edit/Delete inline, Check-off, P1-P3, Kategorien,
// optionales Due-Date, Filter-Chips, Drag-to-Reorder per framer-motion.

import { useMemo, useState } from 'react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import {
    Plus, CheckCircle2, Circle, Trash2, X, Inbox, AlertTriangle,
    CalendarRange, CalendarClock, ListTodo,
} from 'lucide-react';
import { useTodos } from '../hooks/useTodos';
import tokens from '../styles/tokens';

const CATEGORIES = [
    { id: 'uni',     label: 'Uni',     color: '#a855f7' },
    { id: 'sport',   label: 'Sport',   color: tokens.colors.accent.DEFAULT },
    { id: 'life',    label: 'Life',    color: '#34d399' },
    { id: 'errands', label: 'Errands', color: '#60a5fa' },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const PRIORITY_COLOR = {
    1: tokens.colors.status.danger,
    2: tokens.colors.status.warning,
    3: tokens.colors.text.tertiary,
};

const FILTERS = [
    { id: 'all',     label: 'Alle' },
    { id: 'today',   label: 'Heute' },
    { id: 'week',    label: 'Woche' },
    { id: 'inbox',   label: 'Inbox' },
    { id: 'done',    label: 'Erledigt' },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function todayISO() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

function addDaysISO(base, days) {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function bucketOf(item, today, weekEnd) {
    if (item.completedAt) return 'done';
    if (!item.dueDate) return 'inbox';
    if (item.dueDate < today) return 'overdue';
    if (item.dueDate === today) return 'today';
    if (item.dueDate <= weekEnd) return 'week';
    return 'later';
}

function fmtDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    const today = todayISO();
    if (iso === today) return 'heute';
    if (iso === addDaysISO(today, 1)) return 'morgen';
    if (iso === addDaysISO(today, -1)) return 'gestern';
    const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    return `${d.getDate()}. ${months[d.getMonth()]}`;
}

function sortItems(items) {
    return [...items].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export default function Todos() {
    const { items, ready, add, update, remove, toggleDone, reorder } = useTodos();
    const [filter, setFilter] = useState('all');
    const [adding, setAdding] = useState(false);

    const today = todayISO();
    const weekEnd = addDaysISO(today, 7);

    const buckets = useMemo(() => {
        const map = { overdue: [], today: [], week: [], later: [], inbox: [], done: [] };
        for (const it of items) map[bucketOf(it, today, weekEnd)].push(it);
        for (const k of Object.keys(map)) map[k] = sortItems(map[k]);
        return map;
    }, [items, today, weekEnd]);

    const openCount = items.length - buckets.done.length;
    const todayCount = buckets.today.length;
    const overdueCount = buckets.overdue.length;

    const visibleBuckets = useMemo(() => {
        const list = [];
        const push = (id, label, icon, color, arr) => {
            if (arr.length) list.push({ id, label, icon, color, items: arr });
        };
        if (filter === 'done') {
            push('done', 'Erledigt', CheckCircle2, tokens.colors.status.success, buckets.done);
            return list;
        }
        if (filter === 'inbox') {
            push('inbox', 'Inbox', Inbox, tokens.colors.text.secondary, buckets.inbox);
            return list;
        }
        if (filter === 'today') {
            push('overdue', 'Überfällig', AlertTriangle, tokens.colors.status.danger, buckets.overdue);
            push('today', 'Heute', CalendarClock, tokens.colors.accent.DEFAULT, buckets.today);
            return list;
        }
        if (filter === 'week') {
            push('overdue', 'Überfällig', AlertTriangle, tokens.colors.status.danger, buckets.overdue);
            push('today', 'Heute', CalendarClock, tokens.colors.accent.DEFAULT, buckets.today);
            push('week', 'Diese Woche', CalendarRange, tokens.colors.accent.secondary, buckets.week);
            return list;
        }
        // all
        push('overdue', 'Überfällig', AlertTriangle, tokens.colors.status.danger, buckets.overdue);
        push('today', 'Heute', CalendarClock, tokens.colors.accent.DEFAULT, buckets.today);
        push('week', 'Diese Woche', CalendarRange, tokens.colors.accent.secondary, buckets.week);
        push('later', 'Später', CalendarRange, tokens.colors.text.secondary, buckets.later);
        push('inbox', 'Inbox', Inbox, tokens.colors.text.secondary, buckets.inbox);
        return list;
    }, [filter, buckets]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing.lg,
            padding: tokens.spacing.lg,
        }}>
            <Header
                openCount={openCount}
                todayCount={todayCount}
                overdueCount={overdueCount}
                adding={adding}
                onToggleAdd={() => setAdding((v) => !v)}
            />

            <AnimatePresence initial={false}>
                {adding && (
                    <motion.div
                        key="addbar"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={tokens.motion.spring.snappy}
                        style={{ overflow: 'hidden' }}
                    >
                        <AddBar onSubmit={async (p) => { await add(p); }} />
                    </motion.div>
                )}
            </AnimatePresence>

            <FilterStrip filter={filter} onChange={setFilter} buckets={buckets} />

            {ready && items.length === 0 && <EmptyState onAdd={() => setAdding(true)} />}

            {visibleBuckets.length === 0 && items.length > 0 && (
                <SoftEmpty label="Hier ist nichts." />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
                {visibleBuckets.map((b) => (
                    <BucketSection
                        key={b.id}
                        bucket={b}
                        onToggle={toggleDone}
                        onRemove={remove}
                        onUpdate={update}
                        onReorder={reorder}
                    />
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

function Header({ openCount, todayCount, overdueCount, adding, onToggleAdd }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: tokens.spacing.lg,
            flexWrap: 'wrap',
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 style={{
                    margin: 0,
                    fontFamily: tokens.typography.fontFamily.display,
                    fontSize: tokens.typography.fontSize.xl,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.text.primary,
                    letterSpacing: tokens.typography.letterSpacing.tight,
                }}>ToDo</h2>
                <p style={{
                    margin: 0,
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.text.tertiary,
                    textTransform: 'uppercase',
                    letterSpacing: tokens.typography.letterSpacing.wide,
                }}>
                    {openCount} offen
                    {todayCount > 0 && <> · {todayCount} heute</>}
                    {overdueCount > 0 && <> · <span style={{ color: tokens.colors.status.danger }}>{overdueCount} überfällig</span></>}
                </p>
            </div>
            <button
                type="button"
                onClick={onToggleAdd}
                style={{
                    padding: '10px 18px',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    letterSpacing: tokens.typography.letterSpacing.wide,
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: tokens.radius.md,
                    background: adding ? tokens.colors.surface.glass : tokens.colors.accent.gradient,
                    color: '#fff',
                    boxShadow: adding ? 'none' : tokens.shadow.glow,
                }}
            >
                {adding ? <X size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
                {adding ? 'Schließen' : 'Neu'}
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// AddBar
// ─────────────────────────────────────────────────────────────

function AddBar({ onSubmit }) {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('life');
    const [priority, setPriority] = useState(2);
    const [dueDate, setDueDate] = useState('');

    function submit() {
        const t = title.trim();
        if (!t) return;
        onSubmit({ title: t, category, priority, dueDate: dueDate || null });
        setTitle('');
        setDueDate('');
    }

    function onKey(e) {
        if (e.key === 'Enter') submit();
    }

    return (
        <div style={{
            ...tokens.glass.card,
            padding: tokens.spacing.md,
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto auto',
            gap: tokens.spacing.sm,
            alignItems: 'center',
        }}>
            <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={onKey}
                placeholder="Was steht an?"
                style={{
                    ...tokens.glass.input,
                    padding: '8px 10px',
                    fontSize: tokens.typography.fontSize.sm,
                    outline: 'none',
                    minWidth: 0,
                }}
            />
            <CategorySelect value={category} onChange={setCategory} />
            <PrioritySelect value={priority} onChange={setPriority} />
            <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                    ...tokens.glass.input,
                    padding: '8px 10px',
                    fontSize: tokens.typography.fontSize.sm,
                    outline: 'none',
                    colorScheme: 'dark',
                }}
            />
            <button
                type="button"
                onClick={submit}
                disabled={!title.trim()}
                style={{
                    padding: '8px 14px',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    border: 'none',
                    borderRadius: tokens.radius.md,
                    background: title.trim() ? tokens.colors.accent.DEFAULT : tokens.colors.surface.glass,
                    color: '#fff',
                    cursor: title.trim() ? 'pointer' : 'not-allowed',
                    opacity: title.trim() ? 1 : 0.5,
                }}
            >
                <Plus size={14} strokeWidth={2.5} />
            </button>
        </div>
    );
}

function CategorySelect({ value, onChange }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                ...tokens.glass.input,
                padding: '8px 10px',
                fontSize: tokens.typography.fontSize.sm,
                outline: 'none',
                cursor: 'pointer',
            }}
        >
            {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id} style={{ background: tokens.colors.bg.elevated }}>{c.label}</option>
            ))}
        </select>
    );
}

function PrioritySelect({ value, onChange }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            style={{
                ...tokens.glass.input,
                padding: '8px 10px',
                fontSize: tokens.typography.fontSize.sm,
                outline: 'none',
                cursor: 'pointer',
                color: PRIORITY_COLOR[value],
                fontWeight: tokens.typography.fontWeight.semibold,
            }}
        >
            <option value={1} style={{ background: tokens.colors.bg.elevated, color: '#fff' }}>P1</option>
            <option value={2} style={{ background: tokens.colors.bg.elevated, color: '#fff' }}>P2</option>
            <option value={3} style={{ background: tokens.colors.bg.elevated, color: '#fff' }}>P3</option>
        </select>
    );
}

// ─────────────────────────────────────────────────────────────
// Filter
// ─────────────────────────────────────────────────────────────

function FilterStrip({ filter, onChange, buckets }) {
    const counts = {
        all:   buckets.overdue.length + buckets.today.length + buckets.week.length + buckets.later.length + buckets.inbox.length,
        today: buckets.overdue.length + buckets.today.length,
        week:  buckets.overdue.length + buckets.today.length + buckets.week.length,
        inbox: buckets.inbox.length,
        done:  buckets.done.length,
    };
    return (
        <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => onChange(f.id)}
                        style={{
                            padding: '6px 12px',
                            fontSize: tokens.typography.fontSize.xs,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            letterSpacing: tokens.typography.letterSpacing.wide,
                            textTransform: 'uppercase',
                            border: `1px solid ${active ? tokens.colors.accent.border : tokens.colors.border.glass}`,
                            borderRadius: tokens.radius.full,
                            background: active ? tokens.colors.accent.soft : 'transparent',
                            color: active ? tokens.colors.accent.DEFAULT : tokens.colors.text.secondary,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        {f.label}
                        <span style={{
                            fontSize: 10,
                            color: active ? tokens.colors.accent.DEFAULT : tokens.colors.text.tertiary,
                        }}>{counts[f.id]}</span>
                    </button>
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Bucket-Section with Drag-Reorder
// ─────────────────────────────────────────────────────────────

function BucketSection({ bucket, onToggle, onRemove, onUpdate, onReorder }) {
    const Icon = bucket.icon;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing.sm,
                padding: `0 ${tokens.spacing.xs}`,
            }}>
                <Icon size={14} color={bucket.color} strokeWidth={2.5} />
                <span style={{
                    fontSize: 11,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: bucket.color,
                    textTransform: 'uppercase',
                    letterSpacing: tokens.typography.letterSpacing.wide,
                }}>{bucket.label}</span>
                <span style={{ fontSize: 11, color: tokens.colors.text.tertiary }}>
                    {bucket.items.length}
                </span>
            </div>
            <Reorder.Group
                axis="y"
                values={bucket.items}
                onReorder={(next) => onReorder(next.map((i) => i.id))}
                style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: tokens.spacing.sm,
                }}
            >
                {bucket.items.map((item) => (
                    <TodoItem
                        key={item.id}
                        item={item}
                        onToggle={() => onToggle(item.id)}
                        onRemove={() => onRemove(item.id)}
                        onUpdate={(patch) => onUpdate(item.id, patch)}
                    />
                ))}
            </Reorder.Group>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// TodoItem
// ─────────────────────────────────────────────────────────────

function TodoItem({ item, onToggle, onRemove, onUpdate }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(item.title);
    const [hover, setHover] = useState(false);

    const isDone = !!item.completedAt;
    const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.life;
    const pColor = PRIORITY_COLOR[item.priority];
    const today = todayISO();
    const overdue = !isDone && item.dueDate && item.dueDate < today;

    function commitEdit() {
        const t = draft.trim();
        if (t && t !== item.title) onUpdate({ title: t });
        else setDraft(item.title);
        setEditing(false);
    }

    return (
        <Reorder.Item
            value={item}
            whileDrag={{ scale: 1.02, boxShadow: tokens.shadow.elevated }}
            transition={tokens.motion.spring.snappy}
            style={{
                ...tokens.glass.card,
                padding: tokens.spacing.md,
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: tokens.spacing.md,
                alignItems: 'center',
                opacity: isDone ? 0.5 : 1,
                borderLeft: `3px solid ${cat.color}`,
                listStyle: 'none',
                cursor: 'grab',
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            {/* Checkbox */}
            <button
                onClick={onToggle}
                type="button"
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                title={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
            >
                {isDone
                    ? <CheckCircle2 size={22} color={tokens.colors.accent.DEFAULT} strokeWidth={2.5} />
                    : <Circle size={22} color={tokens.colors.text.tertiary} strokeWidth={2} />}
            </button>

            {/* Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
                    <Pill color={pColor} label={`P${item.priority}`} />
                    <Pill color={cat.color} label={cat.label} soft />
                    {item.dueDate && (
                        <span style={{
                            fontSize: 11,
                            color: overdue ? tokens.colors.status.danger : tokens.colors.text.tertiary,
                            fontWeight: overdue ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.regular,
                        }}>
                            {fmtDate(item.dueDate)}
                        </span>
                    )}
                </div>
                {editing ? (
                    <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit();
                            else if (e.key === 'Escape') { setDraft(item.title); setEditing(false); }
                        }}
                        style={{
                            ...tokens.glass.input,
                            padding: '4px 8px',
                            fontSize: tokens.typography.fontSize.sm,
                            outline: 'none',
                            fontWeight: tokens.typography.fontWeight.semibold,
                        }}
                    />
                ) : (
                    <span
                        onDoubleClick={() => setEditing(true)}
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.text.primary,
                            textDecoration: isDone ? 'line-through' : 'none',
                            cursor: 'text',
                        }}
                        title="Doppelklick zum Bearbeiten"
                    >
                        {item.title}
                    </span>
                )}
            </div>

            {/* Right actions */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing.xs,
                opacity: hover ? 1 : 0.4,
                transition: `opacity ${tokens.motion.duration.fast}s ease`,
            }}>
                <input
                    type="date"
                    value={item.dueDate || ''}
                    onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
                    title="Fälligkeitsdatum"
                    style={{
                        background: 'transparent',
                        border: `1px solid ${tokens.colors.border.glass}`,
                        borderRadius: tokens.radius.sm,
                        color: tokens.colors.text.secondary,
                        padding: '4px 6px',
                        fontSize: 11,
                        outline: 'none',
                        colorScheme: 'dark',
                        cursor: 'pointer',
                    }}
                />
                <button
                    type="button"
                    onClick={onRemove}
                    title="Löschen"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        color: tokens.colors.text.tertiary,
                    }}
                >
                    <Trash2 size={14} strokeWidth={2} />
                </button>
            </div>
        </Reorder.Item>
    );
}

function Pill({ color, label, soft }) {
    return (
        <span style={{
            fontSize: 10,
            fontWeight: tokens.typography.fontWeight.bold,
            textTransform: 'uppercase',
            letterSpacing: tokens.typography.letterSpacing.wide,
            color,
            padding: '2px 8px',
            background: soft ? `${color}20` : 'transparent',
            border: soft ? 'none' : `1px solid ${color}`,
            borderRadius: tokens.radius.sm,
        }}>
            {label}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────
// Empty States
// ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
    return (
        <div style={{
            ...tokens.glass.card,
            padding: tokens.spacing.xl,
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing.md,
            alignItems: 'flex-start',
        }}>
            <ListTodo size={32} color={tokens.colors.accent.DEFAULT} strokeWidth={2} />
            <h3 style={{ margin: 0, fontSize: tokens.typography.fontSize.lg, color: tokens.colors.text.primary }}>
                Inbox leer
            </h3>
            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary, lineHeight: 1.6 }}>
                Capture, was du nicht im Kopf behalten willst. Prioritäten setzen, Datum optional —
                der Rest ergibt sich.
            </p>
            <button onClick={onAdd} style={{
                padding: '10px 18px',
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                textTransform: 'uppercase',
                letterSpacing: tokens.typography.letterSpacing.wide,
                border: 'none',
                borderRadius: tokens.radius.md,
                background: tokens.colors.accent.gradient,
                color: '#fff',
                cursor: 'pointer',
                boxShadow: tokens.shadow.glow,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
            }}>
                <Plus size={14} strokeWidth={2.5} />
                Erste Aufgabe
            </button>
        </div>
    );
}

function SoftEmpty({ label }) {
    return (
        <div style={{
            ...tokens.glass.card,
            padding: tokens.spacing.lg,
            textAlign: 'center',
            color: tokens.colors.text.tertiary,
            fontSize: tokens.typography.fontSize.sm,
        }}>
            {label}
        </div>
    );
}
