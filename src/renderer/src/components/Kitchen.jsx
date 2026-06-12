// OLE OS — Küche & Ernährung
// 4 Bereiche: Inventar (inkl. Bon-Import), Kosten, Rezepte (KI + Meal-Prep),
// Makros (Training-Sync). Styling über useTheme()-Tokens, inline.

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, X, Check, Minus, Upload, ChefHat, Receipt,
    Utensils, Wallet, Target, Loader2, Sparkles, Save, AlertCircle,
    Sun, Coffee, Sandwich, UtensilsCrossed, Apple, Boxes, ShoppingCart, CalendarDays,
} from 'lucide-react';
import { useKitchen, categoryForType } from '../hooks/useKitchen';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { useTheme } from '../hooks/useTheme.jsx';
import { todayISO, addDays } from '../lib/date.js';

function eur(n) {
    if (n === null || n === undefined || n === '') return '—';
    return Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fmtWeek(iso) {
    const d = new Date(iso + 'T00:00:00');
    const end = new Date(d); end.setDate(d.getDate() + 6);
    const m = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${d.getDate()}. ${m[d.getMonth()]} – ${end.getDate()}. ${m[end.getMonth()]}`;
}

const SUBTABS = [
    { id: 'heute', label: 'Heute', icon: Sun },
    { id: 'inventar', label: 'Inventar', icon: Utensils },
    { id: 'kosten', label: 'Kosten', icon: Wallet },
    { id: 'rezepte', label: 'Rezepte', icon: ChefHat },
    { id: 'makros', label: 'Makros', icon: Target },
];

const MEAL_TYPES = ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack'];
const MEAL_ICONS = { 'Frühstück': Coffee, 'Mittagessen': Sandwich, 'Abendessen': UtensilsCrossed, 'Snack': Apple };
const UNITS = ['g', 'kg', 'ml', 'l', 'Stk', 'Pkg', 'Dose', 'Flasche'];

export default function Kitchen() {
    const { tokens } = useTheme();
    const k = useKitchen();
    const { plan } = useTrainingPlan();
    const [sub, setSub] = useState('inventar');
    const acc = tokens.colors.tab.kitchen;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg, padding: tokens.spacing.lg }}>
            <style>{`@keyframes kspin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 style={{
                    margin: 0, fontFamily: tokens.typography.fontFamily.display,
                    fontSize: tokens.typography.fontSize.xl, fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.text.primary, letterSpacing: tokens.typography.letterSpacing.tight,
                }}>Küche</h2>
                <p style={{
                    margin: 0, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary,
                    textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide,
                }}>{k.data.inventory.length} Items · {k.data.recipes.length} Rezepte</p>
            </div>

            {k.error && (
                <div style={{
                    ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', gap: tokens.spacing.sm,
                    alignItems: 'center', color: tokens.colors.status.danger, borderLeft: `3px solid ${tokens.colors.status.danger}`,
                }}>
                    <AlertCircle size={16} /> <span style={{ fontSize: tokens.typography.fontSize.sm }}>{k.error}</span>
                </div>
            )}

            {/* Sub-Tab-Strip */}
            <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
                {SUBTABS.map((t) => {
                    const active = sub === t.id;
                    const Icon = t.icon;
                    return (
                        <button key={t.id} type="button" onClick={() => setSub(t.id)} style={{
                            padding: '6px 12px', fontSize: tokens.typography.fontSize.xs,
                            fontWeight: tokens.typography.fontWeight.semibold, letterSpacing: tokens.typography.letterSpacing.wide,
                            textTransform: 'uppercase', border: `1px solid ${active ? acc : tokens.colors.border.glass}`,
                            borderRadius: tokens.radius.full, background: active ? `${acc}1a` : 'transparent',
                            color: active ? acc : tokens.colors.text.secondary, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}>
                            <Icon size={13} strokeWidth={2.5} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {sub === 'heute' && <Heute k={k} plan={plan} acc={acc} />}
            {sub === 'inventar' && <Inventar k={k} acc={acc} />}
            {sub === 'kosten' && <Kosten k={k} acc={acc} />}
            {sub === 'rezepte' && <Rezepte k={k} plan={plan} acc={acc} />}
            {sub === 'makros' && <Makros k={k} plan={plan} acc={acc} />}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// HEUTE — Tagesüberblick + Essensvorschläge
// ─────────────────────────────────────────────────────────────
function Heute({ k, plan, acc }) {
    const { tokens } = useTheme();
    const today = todayISO();
    const todayMeals = (k.data.externalMeals || []).filter((m) => m.date === today);
    const info = dayMacros(plan, k.data, today);

    // Summe heutiger Mahlzeiten
    const eaten = todayMeals.reduce(
        (s, m) => ({ kcal: s.kcal + (m.kcal||0), protein: s.protein + (m.protein||0), carbs: s.carbs + (m.carbs||0), fat: s.fat + (m.fat||0) }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const target = info.macros;

    const [showForm, setShowForm] = useState(false);
    const [dayPlan, setDayPlan] = useState(null);
    const [planBusy, setPlanBusy] = useState(false);

    async function handleGenPlan() {
        setPlanBusy(true); setDayPlan(null);
        const result = await k.generateDayPlan({
            macroTarget: target,
            trainingLabel: info.label,
            alreadyEaten: eaten.kcal > 0 ? eaten : null,
        });
        setDayPlan(result);
        setPlanBusy(false);
    }

    function addFromSuggestion(meal) {
        k.mealAdd({
            name: meal.title,
            kcal: meal.macros.kcal,
            protein: meal.macros.protein,
            carbs: meal.macros.carbs,
            fat: meal.macros.fat,
            cost: null,
            date: today,
            source: 'vorschlag',
            mealType: meal.type,
        });
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
            {/* Makro-Fortschritt */}
            <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg, display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <SectionLabel acc={acc}>Heute · {info.type}</SectionLabel>
                    <span style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary }}>
                        Ziel: {target.kcal} kcal
                    </span>
                </div>
                <MacroBar label="Kalorien" eaten={eaten.kcal} target={target.kcal} unit="kcal" color={acc} tokens={tokens} big />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: tokens.spacing.sm }}>
                    <MacroBar label="Protein" eaten={eaten.protein} target={target.protein} unit="g" color={tokens.colors.status.info} tokens={tokens} />
                    <MacroBar label="Kohlenhydrate" eaten={eaten.carbs} target={target.carbs} unit="g" color={tokens.colors.status.warning} tokens={tokens} />
                    <MacroBar label="Fett" eaten={eaten.fat} target={target.fat} unit="g" color={tokens.colors.status.success} tokens={tokens} />
                </div>
            </div>

            {/* Heutige Mahlzeiten */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <SectionLabel acc={acc}>Mahlzeiten heute</SectionLabel>
                    <ActionBtn acc={acc} ghost icon={Plus} onClick={() => setShowForm(true)}>Erfassen</ActionBtn>
                </div>
                {todayMeals.length === 0
                    ? <SoftEmpty label="Noch keine Mahlzeiten erfasst." />
                    : todayMeals.map((m) => <TodayMealRow key={m.id} meal={m} acc={acc} onRemove={() => k.mealRemove(m.id)} tokens={tokens} />)
                }
            </div>

            {showForm && (
                <MealLogForm
                    acc={acc}
                    onSave={(data) => { k.mealAdd({ ...data, date: today, source: 'manuell' }); setShowForm(false); }}
                    onCancel={() => setShowForm(false)}
                    onEstimate={(name, mealType) => k.estimateMeal(name, mealType)}
                />
            )}

            {/* Tagesvorschläge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <SectionLabel acc={acc}>Tagesplan vorschlagen</SectionLabel>
                    <ActionBtn acc={acc} icon={Sparkles} onClick={handleGenPlan} disabled={planBusy}
                        spin={planBusy}>{planBusy ? 'Generiere…' : 'KI-Vorschlag'}</ActionBtn>
                </div>
                {dayPlan && dayPlan.meals.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                        {dayPlan.meals.map((meal, i) => (
                            <DayPlanMealCard key={i} meal={meal} acc={acc} tokens={tokens}
                                onAdd={() => addFromSuggestion(meal)} />
                        ))}
                    </div>
                )}
                {dayPlan && dayPlan.meals.length === 0 && <SoftEmpty label="Keine Vorschläge erhalten." />}
            </div>
        </div>
    );
}

// Fortschrittsbalken für eine Makro-Kategorie
function MacroBar({ label, eaten, target, unit, color, tokens, big }) {
    const pct = target > 0 ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
    const over = target > 0 && eaten > target;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: big ? tokens.typography.fontSize.sm : 10, color: tokens.colors.text.secondary, fontWeight: tokens.typography.fontWeight.medium }}>{label}</span>
                <span style={{ fontSize: big ? tokens.typography.fontSize.sm : 10, color: over ? tokens.colors.status.danger : tokens.colors.text.secondary, fontVariantNumeric: 'tabular-nums' }}>
                    {eaten} / {target} {unit}
                </span>
            </div>
            <div style={{ height: big ? 8 : 5, background: tokens.colors.border.glass, borderRadius: tokens.radius.full, overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${pct}%`,
                    background: over ? tokens.colors.status.danger : color,
                    borderRadius: tokens.radius.full,
                    transition: 'width 0.4s ease',
                }} />
            </div>
        </div>
    );
}

// Eine Mahlzeit-Zeile im Tagesüberblick
function TodayMealRow({ meal, acc, onRemove, tokens }) {
    const MealIcon = MEAL_ICONS[meal.mealType] || Utensils;
    return (
        <div style={{ ...tokens.glass.card, padding: `${tokens.spacing.sm} ${tokens.spacing.md}`, display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
            <MealIcon size={16} color={acc} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.medium, color: tokens.colors.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {meal.name}
                </p>
                {meal.mealType && <p style={{ margin: 0, fontSize: 10, color: tokens.colors.text.tertiary }}>{meal.mealType}</p>}
            </div>
            <span style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.secondary, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {meal.kcal} kcal · P{meal.protein} K{meal.carbs} F{meal.fat}
            </span>
            {meal.cost != null && <span style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary, flexShrink: 0 }}>{eur(meal.cost)}</span>}
            <IconBtn onClick={onRemove} color={tokens.colors.text.tertiary} title="Entfernen"><X size={13} /></IconBtn>
        </div>
    );
}

// Formular zum schnellen Erfassen einer Mahlzeit
function MealLogForm({ acc, onSave, onCancel, onEstimate }) {
    const { tokens } = useTheme();
    const [form, setForm] = useState({ name: '', mealType: 'Frühstück', kcal: '', protein: '', carbs: '', fat: '', cost: '' });
    const [estimating, setEstimating] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const num = (v) => v === '' ? null : (Number(v) || 0);
    const valid = form.name.trim() && form.kcal !== '';

    async function estimate() {
        if (!form.name.trim() || !onEstimate) return;
        setEstimating(true);
        const r = await onEstimate(form.name.trim(), form.mealType);
        setEstimating(false);
        if (r) setForm((f) => ({ ...f, name: r.name || f.name, kcal: String(r.kcal), protein: String(r.protein), carbs: String(r.carbs), fat: String(r.fat) }));
    }

    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm, borderLeft: `3px solid ${acc}` }}>
            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.text.primary }}>Mahlzeit erfassen</p>
            <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
                <input autoFocus placeholder='Was hast du gegessen? z.B. "2 Brötchen mit Käse"' value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && estimate()}
                    style={{ ...tokens.glass.input, padding: '6px 10px', flex: 2, minWidth: 140, fontSize: tokens.typography.fontSize.sm, outline: 'none' }} />
                <select value={form.mealType} onChange={(e) => set('mealType', e.target.value)}
                    style={{ ...tokens.glass.input, padding: '6px 10px', flex: 1, minWidth: 120, fontSize: tokens.typography.fontSize.sm, outline: 'none', cursor: 'pointer' }}>
                    {MEAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            {onEstimate && (
                <ActionBtn acc={acc} icon={Sparkles} disabled={!form.name.trim() || estimating} spin={estimating}
                    onClick={estimate}>{estimating ? 'Schätze…' : 'Makros von KI schätzen'}</ActionBtn>
            )}
            <div style={{ display: 'flex', gap: tokens.spacing.xs, flexWrap: 'wrap' }}>
                {[['kcal','Kkal'],['protein','P (g)'],['carbs','K (g)'],['fat','F (g)'],['cost','Kosten €']].map(([key, ph]) => (
                    <input key={key} type="number" placeholder={ph} value={form[key]}
                        onChange={(e) => set(key, e.target.value)}
                        style={{ ...tokens.glass.input, padding: '6px 8px', width: 76, fontSize: tokens.typography.fontSize.xs, outline: 'none', textAlign: 'center' }} />
                ))}
            </div>
            <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
                <ActionBtn acc={acc} icon={Check} disabled={!valid}
                    onClick={() => onSave({ name: form.name.trim(), mealType: form.mealType, kcal: num(form.kcal), protein: num(form.protein)||0, carbs: num(form.carbs)||0, fat: num(form.fat)||0, cost: num(form.cost) })}>
                    Speichern
                </ActionBtn>
                <ActionBtn acc={acc} ghost icon={X} onClick={onCancel}>Abbrechen</ActionBtn>
            </div>
        </div>
    );
}

// KI-Mahlzeit-Vorschlag aus Tagesplan
function DayPlanMealCard({ meal, acc, tokens, onAdd }) {
    const [open, setOpen] = useState(false);
    const MealIcon = MEAL_ICONS[meal.type] || Utensils;
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
                <MealIcon size={16} color={acc} strokeWidth={2} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 10, color: tokens.colors.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meal.type}</span>
                    <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.text.primary }}>{meal.title}</p>
                </div>
                <span style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.secondary, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {meal.macros.kcal} kcal
                </span>
                <span style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary, flexShrink: 0 }}>
                    P{meal.macros.protein} K{meal.macros.carbs} F{meal.macros.fat}
                </span>
                <IconBtn onClick={() => setOpen((o) => !o)} color={tokens.colors.text.tertiary} title="Details">{open ? <Minus size={13}/> : <Plus size={13}/>}</IconBtn>
                <ActionBtn acc={acc} icon={Plus} onClick={onAdd}>Erfassen</ActionBtn>
            </div>
            {open && (
                <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {meal.prep && <p style={{ margin: 0, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.secondary }}>{meal.prep}</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {meal.ingredients.map((ing, i) => (
                            <span key={i} style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: tokens.radius.full,
                                background: ing.inInventory ? `${acc}20` : tokens.colors.border.glass,
                                color: ing.inInventory ? acc : tokens.colors.text.tertiary,
                                border: `1px solid ${ing.inInventory ? `${acc}40` : tokens.colors.border.glass}`,
                            }}>
                                {ing.qty} {ing.unit} {ing.name}
                            </span>
                        ))}
                    </div>
                    {meal.missing.length > 0 && (
                        <p style={{ margin: 0, fontSize: 10, color: tokens.colors.status.warning }}>
                            Fehlt: {meal.missing.join(', ')}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// INVENTAR
// ─────────────────────────────────────────────────────────────
function Inventar({ k, acc }) {
    const { tokens } = useTheme();
    const [preview, setPreview] = useState(null); // { fileName, items }
    const [adding, setAdding] = useState(false);

    async function onImport() {
        const res = await k.importReceipt();
        if (res && !res.canceled && res.items?.length) setPreview(res);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
                <ActionBtn acc={acc} onClick={onImport} disabled={k.busy} icon={k.busy ? Loader2 : Upload} spin={k.busy}>
                    {k.busy ? 'Lese Bon…' : 'Kassenbon (PDF)'}
                </ActionBtn>
                <ActionBtn acc={acc} ghost onClick={() => setAdding((v) => !v)} icon={adding ? X : Plus}>
                    {adding ? 'Schließen' : 'Item manuell'}
                </ActionBtn>
            </div>

            <AnimatePresence initial={false}>
                {adding && (
                    <motion.div key="add" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={tokens.motion.spring.snappy} style={{ overflow: 'hidden' }}>
                        <ItemForm acc={acc} onSubmit={async (p) => { await k.invAdd(p); setAdding(false); }} />
                    </motion.div>
                )}
            </AnimatePresence>

            {k.data.inventory.length === 0 ? (
                <SoftEmpty label="Inventar leer — Bon hochladen oder Item anlegen." />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                    {k.data.inventory.map((it) => (
                        <InventoryRow key={it.id} item={it} acc={acc}
                            onUpdate={(patch) => k.invUpdate(it.id, patch)}
                            onConsume={(amt) => k.invConsume(it.id, amt)}
                            onRemove={() => k.invRemove(it.id)} />
                    ))}
                </div>
            )}

            {preview && (
                <ReceiptPreview preview={preview} acc={acc}
                    onConfirm={async (items) => { await k.confirmImport(items); setPreview(null); }}
                    onCancel={() => setPreview(null)} />
            )}
        </div>
    );
}

function InventoryRow({ item, acc, onUpdate, onConsume, onRemove }) {
    const { tokens } = useTheme();
    const [hover, setHover] = useState(false);
    const expSoon = item.expiryDate && item.expiryDate <= addDays(todayISO(), 3);
    return (
        <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
            ...tokens.glass.card, padding: tokens.spacing.md, display: 'grid',
            gridTemplateColumns: '1fr auto auto auto', gap: tokens.spacing.sm, alignItems: 'center',
            borderLeft: `3px solid ${expSoon ? tokens.colors.status.warning : acc}`,
        }}>
            <input value={item.name} onChange={(e) => onUpdate({ name: e.target.value })} style={{
                ...tokens.glass.input, padding: '6px 8px', fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold, outline: 'none', minWidth: 0,
            }} />
            <NumField value={item.qty} onCommit={(v) => onUpdate({ qty: v })} width={56} />
            <UnitSelect value={item.unit} onChange={(v) => onUpdate({ unit: v })} style={{ width: 66 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: hover ? 1 : 0.5, transition: 'opacity .15s' }}>
                <span style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary, marginRight: 4 }}>
                    {item.price !== null ? eur(item.price) : ''}
                </span>
                <IconBtn title="Eine Einheit gegessen" onClick={() => onConsume(1)} color={acc}><Minus size={14} /></IconBtn>
                <IconBtn title="Löschen" onClick={onRemove} color={tokens.colors.text.tertiary}><Trash2 size={14} /></IconBtn>
            </div>
        </div>
    );
}

function ItemForm({ acc, onSubmit }) {
    const { tokens } = useTheme();
    const [f, setF] = useState({ name: '', qty: 1, unit: 'Stk', price: '', expiryDate: '' });
    function submit() {
        if (!f.name.trim()) return;
        onSubmit({ ...f, price: f.price === '' ? null : Number(f.price), expiryDate: f.expiryDate || null });
        setF({ name: '', qty: 1, unit: 'Stk', price: '', expiryDate: '' });
    }
    const inp = { ...tokens.glass.input, padding: '8px 10px', fontSize: tokens.typography.fontSize.sm, outline: 'none', minWidth: 0 };
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'grid',
            gridTemplateColumns: '1.6fr .6fr .6fr .8fr 1fr auto', gap: tokens.spacing.sm, alignItems: 'center' }}>
            <input autoFocus placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submit()} style={inp} />
            <input type="number" placeholder="Menge" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} style={inp} />
            <UnitSelect value={f.unit} onChange={(v) => setF({ ...f, unit: v })} />
            <input type="number" step="0.01" placeholder="€" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} style={inp} />
            <input type="date" title="MHD (optional)" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} style={{ ...inp, colorScheme: 'light' }} />
            <IconBtn title="Hinzufügen" onClick={submit} color={acc}><Plus size={16} strokeWidth={2.5} /></IconBtn>
        </div>
    );
}

function ReceiptPreview({ preview, acc, onConfirm, onCancel }) {
    const { tokens } = useTheme();
    const [items, setItems] = useState(preview.items);
    function upd(i, patch) { setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))); }
    function del(i) { setItems(items.filter((_, idx) => idx !== i)); }
    const total = items.reduce((s, it) => s + (Number(it.price) || 0), 0);
    return (
        <Modal onClose={onCancel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md }}>
                <Receipt size={18} color={acc} />
                <div>
                    <h3 style={{ margin: 0, fontSize: tokens.typography.fontSize.lg, color: tokens.colors.text.primary }}>Bon prüfen</h3>
                    <p style={{ margin: 0, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary }}>
                        {preview.fileName} · {items.length} Positionen · {eur(total)}
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.xs, maxHeight: 360, overflowY: 'auto', marginBottom: tokens.spacing.md }}>
                {items.map((it, i) => {
                    const inp = { ...tokens.glass.input, padding: '5px 8px', fontSize: tokens.typography.fontSize.sm, outline: 'none', minWidth: 0 };
                    return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr .6fr .6fr .8fr auto', gap: tokens.spacing.xs, alignItems: 'center' }}>
                            <input value={it.name} onChange={(e) => upd(i, { name: e.target.value })} style={inp} />
                            <input type="number" value={it.qty} onChange={(e) => upd(i, { qty: e.target.value })} style={inp} />
                            <UnitSelect value={it.unit} onChange={(v) => upd(i, { unit: v })} />
                            <input type="number" step="0.01" value={it.price ?? ''} onChange={(e) => upd(i, { price: e.target.value })} style={inp} />
                            <IconBtn title="Entfernen" onClick={() => del(i)} color={tokens.colors.text.tertiary}><X size={14} /></IconBtn>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'flex-end' }}>
                <ActionBtn ghost acc={acc} onClick={onCancel} icon={X}>Verwerfen</ActionBtn>
                <ActionBtn acc={acc} onClick={() => onConfirm(items)} icon={Check} disabled={!items.length}>
                    {items.length} übernehmen
                </ActionBtn>
            </div>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────
// KOSTEN
// ─────────────────────────────────────────────────────────────
function Kosten({ k, acc }) {
    const { tokens } = useTheme();
    const [adding, setAdding] = useState(false);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                <SectionLabel acc={acc}>Wöchentliche Ausgaben</SectionLabel>
                {k.costs.length === 0 ? <SoftEmpty label="Noch keine Ausgaben erfasst." /> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                        {k.costs.map((w) => (
                            <div key={w.weekStart} style={{ ...tokens.glass.card, padding: tokens.spacing.md,
                                display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: tokens.spacing.sm, alignItems: 'center' }}>
                                <span style={{ fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.text.primary }}>
                                    {fmtWeek(w.weekStart)}
                                </span>
                                <CostCell label="Lebensmittel" value={w.groceries} color={acc} />
                                <CostCell label="Auswärts" value={w.dining} color={tokens.colors.accent.DEFAULT} />
                                <CostCell label="Gesamt" value={w.total} color={tokens.colors.text.primary} bold />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionLabel acc={acc}>Auswärts gegessen</SectionLabel>
                    <ActionBtn ghost acc={acc} onClick={() => setAdding((v) => !v)} icon={adding ? X : Plus}>
                        {adding ? 'Schließen' : 'Mahlzeit'}
                    </ActionBtn>
                </div>
                <AnimatePresence initial={false}>
                    {adding && (
                        <motion.div key="m" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }} transition={tokens.motion.spring.snappy} style={{ overflow: 'hidden' }}>
                            <MealForm acc={acc} onSubmit={async (p) => { await k.mealAdd(p); setAdding(false); }} />
                        </motion.div>
                    )}
                </AnimatePresence>
                {k.data.externalMeals.map((m) => (
                    <div key={m.id} style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex',
                        alignItems: 'center', gap: tokens.spacing.sm }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.text.primary }}>{m.name}</p>
                            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary }}>
                                {m.date} · {m.calories} kcal · P{m.protein} K{m.carbs} F{m.fat}
                            </p>
                        </div>
                        <span style={{ fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: acc }}>{eur(m.cost)}</span>
                        <IconBtn title="Löschen" onClick={() => k.mealRemove(m.id)} color={tokens.colors.text.tertiary}><Trash2 size={14} /></IconBtn>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CostCell({ label, value, color, bold }) {
    const { tokens } = useTheme();
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, color: tokens.colors.text.tertiary, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>{label}</span>
            <span style={{ fontSize: tokens.typography.fontSize.sm, fontWeight: bold ? tokens.typography.fontWeight.bold : tokens.typography.fontWeight.semibold, color, fontVariantNumeric: 'tabular-nums' }}>{eur(value)}</span>
        </div>
    );
}

function MealForm({ acc, onSubmit }) {
    const { tokens } = useTheme();
    const [f, setF] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', cost: '', date: todayISO() });
    const inp = { ...tokens.glass.input, padding: '8px 10px', fontSize: tokens.typography.fontSize.sm, outline: 'none', minWidth: 0 };
    function submit() {
        if (!f.name.trim()) return;
        onSubmit({ ...f, calories: Number(f.calories) || 0, protein: Number(f.protein) || 0, carbs: Number(f.carbs) || 0, fat: Number(f.fat) || 0, cost: Number(f.cost) || 0 });
        setF({ name: '', calories: '', protein: '', carbs: '', fat: '', cost: '', date: todayISO() });
    }
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'grid',
            gridTemplateColumns: '1.4fr .7fr .6fr .6fr .6fr .7fr 1fr auto', gap: tokens.spacing.sm, alignItems: 'center' }}>
            <input autoFocus placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={inp} />
            <input type="number" placeholder="kcal" value={f.calories} onChange={(e) => setF({ ...f, calories: e.target.value })} style={inp} />
            <input type="number" placeholder="P" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value })} style={inp} />
            <input type="number" placeholder="K" value={f.carbs} onChange={(e) => setF({ ...f, carbs: e.target.value })} style={inp} />
            <input type="number" placeholder="F" value={f.fat} onChange={(e) => setF({ ...f, fat: e.target.value })} style={inp} />
            <input type="number" step="0.01" placeholder="€" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} style={inp} />
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={{ ...inp, colorScheme: 'light' }} />
            <IconBtn title="Hinzufügen" onClick={submit} color={acc}><Plus size={16} strokeWidth={2.5} /></IconBtn>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// REZEPTE
// ─────────────────────────────────────────────────────────────
function Rezepte({ k, plan, acc }) {
    const { tokens } = useTheme();
    const today = todayISO();
    const dayInfo = useMemo(() => dayMacros(plan, k.data, today), [plan, k.data, today]);
    const [servings, setServings] = useState(1);
    const [mealType, setMealType] = useState('');
    const [draft, setDraft] = useState(null);
    const [prepDays, setPrepDays] = useState(3);
    const [prepMeals, setPrepMeals] = useState(['Mittagessen', 'Abendessen']);
    const [prepPlan, setPrepPlan] = useState(null);

    async function onGenerate() {
        const r = await k.generateRecipe({
            macroTarget: scaleMacro(dayInfo.macros, servings),
            trainingLabel: dayInfo.label,
            servings,
            mealType,
        });
        if (r) setDraft(r);
    }

    function toggleMeal(m) {
        setPrepMeals((cur) => cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]);
    }

    async function onGenPrep() {
        const days = [];
        for (let i = 0; i < prepDays; i++) {
            const date = addDays(today, i);
            const info = dayMacros(plan, k.data, date);
            days.push({ date, label: info.label, macroTarget: info.macros });
        }
        const r = await k.generatePrepPlan({ days, mealTypes: prepMeals });
        if (r) setPrepPlan(r);
    }

    async function confirmPrep() {
        for (const s of prepPlan.schedule) {
            await k.mealAdd({ name: s.batch, mealType: s.mealType, kcal: s.macros.kcal,
                protein: s.macros.protein, carbs: s.macros.carbs, fat: s.macros.fat,
                cost: null, date: s.date, source: 'prep' });
        }
        // Inventar-Abzug: Batch-Zutaten auf Inventar matchen, Mengen je id summieren.
        const byId = {};
        for (const b of prepPlan.batches) {
            for (const ing of b.ingredients) {
                if (ing.inInventory === false) continue;
                const inv = k.data.inventory.find((i) =>
                    i.name.toLowerCase().includes(String(ing.name).toLowerCase()) ||
                    String(ing.name).toLowerCase().includes(i.name.toLowerCase()));
                if (inv) byId[inv.id] = (byId[inv.id] || 0) + (Number(ing.qty) || 0);
            }
        }
        const reductions = Object.entries(byId).map(([id, amount]) => ({ id, amount }));
        if (reductions.length) await k.applyConsumption(reductions);
        setPrepPlan(null);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                <SectionLabel acc={acc}>Vorschlag generieren</SectionLabel>
                <p style={{ margin: 0, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.secondary }}>
                    Heute: <b style={{ color: acc }}>{dayInfo.label}</b> · Ziel {scaleMacro(dayInfo.macros, servings).kcal} kcal /
                    P{scaleMacro(dayInfo.macros, servings).protein} K{scaleMacro(dayInfo.macros, servings).carbs} F{scaleMacro(dayInfo.macros, servings).fat}
                </p>
                <div style={{ display: 'flex', gap: tokens.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary }}>Portionen / Tage</label>
                    <input type="number" min={1} value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))}
                        style={{ ...tokens.glass.input, padding: '6px 10px', width: 64, fontSize: tokens.typography.fontSize.sm, outline: 'none' }} />
                    <input placeholder="Mahlzeit (z.B. Frühstück)" value={mealType} onChange={(e) => setMealType(e.target.value)}
                        style={{ ...tokens.glass.input, padding: '6px 10px', fontSize: tokens.typography.fontSize.sm, outline: 'none', flex: 1, minWidth: 140 }} />
                    <ActionBtn acc={acc} onClick={onGenerate} disabled={k.busy} icon={k.busy ? Loader2 : Sparkles} spin={k.busy}>
                        {k.busy ? 'Generiere…' : servings > 1 ? 'Meal-Prep' : 'Rezept'}
                    </ActionBtn>
                </div>
            </div>

            {draft && (
                <RecipeCard recipe={draft} acc={acc} draft
                    onSave={async () => { await k.saveRecipe(draft); setDraft(null); }}
                    onDiscard={() => setDraft(null)}
                    onChange={setDraft} />
            )}

            {/* Meal-Prep planen */}
            <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs }}>
                    <Boxes size={15} color={acc} />
                    <SectionLabel acc={acc}>Meal-Prep planen</SectionLabel>
                </div>
                <p style={{ margin: 0, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.secondary }}>
                    Batch-Kochen für mehrere Tage — Portionen pro Trainingstag, Einkaufsliste für Fehlendes.
                </p>
                <div style={{ display: 'flex', gap: tokens.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CalendarDays size={13} /> Tage ab heute
                    </label>
                    <input type="number" min={1} max={7} value={prepDays}
                        onChange={(e) => setPrepDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                        style={{ ...tokens.glass.input, padding: '6px 10px', width: 56, fontSize: tokens.typography.fontSize.sm, outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {MEAL_TYPES.map((m) => {
                            const on = prepMeals.includes(m);
                            return (
                                <button key={m} type="button" onClick={() => toggleMeal(m)} style={{
                                    padding: '5px 10px', fontSize: tokens.typography.fontSize.xs, cursor: 'pointer',
                                    borderRadius: tokens.radius.pill, border: `1px solid ${on ? acc : tokens.colors.border.glass}`,
                                    background: on ? `${acc}22` : 'transparent', color: on ? acc : tokens.colors.text.tertiary,
                                    fontWeight: on ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.normal,
                                }}>{m}</button>
                            );
                        })}
                    </div>
                    <div style={{ flex: 1 }} />
                    <ActionBtn acc={acc} onClick={onGenPrep} disabled={k.busy || !prepMeals.length}
                        icon={k.busy ? Loader2 : Sparkles} spin={k.busy}>
                        {k.busy ? 'Plane…' : 'Prep-Plan'}
                    </ActionBtn>
                </div>
            </div>

            {prepPlan && (
                <PrepPlanResult plan={prepPlan} acc={acc} tokens={tokens}
                    onConfirm={confirmPrep} onDiscard={() => setPrepPlan(null)} />
            )}

            {k.data.recipes.length > 0 && <SectionLabel acc={acc}>Gespeichert</SectionLabel>}
            {k.data.recipes.map((r) => (
                <RecipeCard key={r.id} recipe={r} acc={acc} inventory={k.data.inventory}
                    onRemove={() => k.removeRecipe(r.id)}
                    onApply={(reductions) => k.applyConsumption(reductions)} />
            ))}
        </div>
    );
}

function RecipeCard({ recipe, acc, draft, inventory = [], onSave, onDiscard, onChange, onRemove, onApply }) {
    const { tokens } = useTheme();
    const [prep, setPrep] = useState(false);
    const m = recipe.macros || {};

    // Meal-Prep: Zutaten mit Inventar matchen → vorgeschlagene Reduktionen.
    const matches = useMemo(() => {
        if (!inventory.length) return [];
        return (recipe.ingredients || []).map((ing) => {
            const inv = inventory.find((i) => i.name.toLowerCase().includes(String(ing.name).toLowerCase()) ||
                String(ing.name).toLowerCase().includes(i.name.toLowerCase()));
            return inv ? { id: inv.id, invName: inv.name, ingName: ing.name, amount: Number(ing.qty) || 0, unit: ing.unit || inv.unit } : null;
        }).filter(Boolean);
    }, [recipe.ingredients, inventory]);

    const [reductions, setReductions] = useState([]);
    function toggleRed(match, on) {
        setReductions((cur) => on ? [...cur, { id: match.id, amount: match.amount }] : cur.filter((r) => r.id !== match.id));
    }

    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm,
            borderLeft: `3px solid ${acc}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.spacing.sm }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: tokens.typography.fontSize.md, fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.text.primary }}>{recipe.title}</h3>
                    <p style={{ margin: 0, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary }}>
                        {recipe.servings} Portion(en) · {m.kcal} kcal · P{m.protein} K{m.carbs} F{m.fat}
                    </p>
                </div>
                {!draft && <IconBtn title="Löschen" onClick={onRemove} color={tokens.colors.text.tertiary}><Trash2 size={14} /></IconBtn>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(recipe.ingredients || []).map((ing, i) => (
                    <span key={i} style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary }}>
                        · {ing.qty} {ing.unit} {ing.name}
                        {ing.inInventory === false && <span style={{ color: tokens.colors.status.warning }}> (fehlt)</span>}
                    </span>
                ))}
            </div>

            {recipe.missing?.length > 0 && (
                <p style={{ margin: 0, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.status.warning }}>
                    Fehlt: {recipe.missing.join(', ')}
                </p>
            )}

            {recipe.steps?.length > 0 && (
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {recipe.steps.map((s, i) => (
                        <li key={i} style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary }}>{s}</li>
                    ))}
                </ol>
            )}

            {draft ? (
                <div style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'flex-end' }}>
                    <ActionBtn ghost acc={acc} onClick={onDiscard} icon={X}>Verwerfen</ActionBtn>
                    <ActionBtn acc={acc} onClick={onSave} icon={Save}>Speichern</ActionBtn>
                </div>
            ) : matches.length > 0 && (
                <div style={{ borderTop: `1px solid ${tokens.colors.border.glass}`, paddingTop: tokens.spacing.sm }}>
                    <button type="button" onClick={() => setPrep((v) => !v)} style={{
                        background: 'transparent', border: 'none', color: acc, cursor: 'pointer', padding: 0,
                        fontSize: tokens.typography.fontSize.xs, fontWeight: tokens.typography.fontWeight.semibold,
                        textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide,
                    }}>{prep ? 'Inventar-Abzug schließen' : 'Inventar reduzieren…'}</button>
                    {prep && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: tokens.spacing.sm }}>
                            {matches.map((mt) => {
                                const on = reductions.some((r) => r.id === mt.id);
                                return (
                                    <label key={mt.id} style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={on} onChange={(e) => toggleRed(mt, e.target.checked)} />
                                        {mt.invName}: −{mt.amount} {mt.unit}
                                    </label>
                                );
                            })}
                            <ActionBtn acc={acc} disabled={!reductions.length} onClick={async () => { await onApply(reductions); setReductions([]); setPrep(false); }} icon={Check}>
                                Abzug bestätigen
                            </ActionBtn>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function PrepPlanResult({ plan, acc, tokens, onConfirm, onDiscard }) {
    const [busy, setBusy] = useState(false);
    const fmtDay = (iso) => {
        const d = new Date(iso + 'T00:00:00');
        return `${DOW[d.getDay()]} ${d.getDate()}.`;
    };
    // Schedule nach Datum gruppieren.
    const byDate = useMemo(() => {
        const map = {};
        for (const s of plan.schedule) (map[s.date] = map[s.date] || []).push(s);
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    }, [plan.schedule]);
    const shopTotal = plan.shoppingList.reduce((s, i) => s + (Number(i.estPrice) || 0), 0);

    async function confirm() { setBusy(true); await onConfirm(); setBusy(false); }

    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', flexDirection: 'column', gap: tokens.spacing.md, borderLeft: `3px solid ${acc}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs }}>
                <Boxes size={16} color={acc} />
                <h3 style={{ margin: 0, fontSize: tokens.typography.fontSize.md, fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.text.primary }}>Prep-Plan</h3>
            </div>

            {/* Batch-Gerichte */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                {plan.batches.map((b, i) => (
                    <div key={i} style={{ ...tokens.glass.input, padding: tokens.spacing.sm, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: tokens.spacing.sm }}>
                            <span style={{ fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.text.primary }}>{b.title}</span>
                            <span style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary }}>
                                {b.portions} Portionen · {b.macrosPerPortion.kcal} kcal/P · P{b.macrosPerPortion.protein} K{b.macrosPerPortion.carbs} F{b.macrosPerPortion.fat}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                            {b.ingredients.map((ing, j) => (
                                <span key={j} style={{ fontSize: tokens.typography.fontSize.xs, color: ing.inInventory === false ? tokens.colors.status.warning : tokens.colors.text.secondary }}>
                                    {ing.qty} {ing.unit} {ing.name}{ing.inInventory === false ? ' (kaufen)' : ''}
                                </span>
                            ))}
                        </div>
                        {b.steps?.length > 0 && (
                            <ol style={{ margin: '2px 0 0', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {b.steps.map((s, j) => <li key={j} style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.secondary }}>{s}</li>)}
                            </ol>
                        )}
                    </div>
                ))}
            </div>

            {/* Tageszuordnung */}
            {byDate.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <SectionLabel acc={acc}>Verteilung</SectionLabel>
                    {byDate.map(([date, list]) => (
                        <div key={date} style={{ display: 'flex', gap: tokens.spacing.sm, alignItems: 'baseline', fontSize: tokens.typography.fontSize.sm }}>
                            <span style={{ width: 48, flexShrink: 0, fontWeight: tokens.typography.fontWeight.semibold, color: acc }}>{fmtDay(date)}</span>
                            <span style={{ color: tokens.colors.text.secondary }}>
                                {list.map((s) => `${s.mealType}: ${s.batch} (${s.portions}×, ${s.macros.kcal} kcal)`).join(' · ')}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Einkaufsliste */}
            {plan.shoppingList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs }}>
                        <ShoppingCart size={13} color={acc} />
                        <SectionLabel acc={acc}>Einkaufsliste{shopTotal > 0 ? ` · ~${shopTotal.toFixed(2)} €` : ''}</SectionLabel>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                        {plan.shoppingList.map((i, j) => (
                            <span key={j} style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary }}>
                                · {i.qty} {i.unit} {i.name}{i.estPrice ? ` (~${Number(i.estPrice).toFixed(2)} €)` : ''}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'flex-end' }}>
                <ActionBtn ghost acc={acc} onClick={onDiscard} icon={X} disabled={busy}>Verwerfen</ActionBtn>
                <ActionBtn acc={acc} onClick={confirm} icon={busy ? Loader2 : Check} spin={busy} disabled={busy}>
                    {busy ? 'Übernehme…' : 'Übernehmen (Mahlzeiten + Inventar-Abzug)'}
                </ActionBtn>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// MAKROS (Training-Sync)
// ─────────────────────────────────────────────────────────────
const PROFILE_ORDER = ['rest', 'easy', 'quality', 'long'];

function Makros({ k, plan, acc }) {
    const { tokens } = useTheme();
    const profiles = k.data.macroProfiles || {};
    const week = useMemo(() => weekDays(plan), [plan]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <SectionLabel acc={acc}>Diese Woche (aus Trainingsplan)</SectionLabel>
            {week.length === 0 ? <SoftEmpty label="Kein Trainingsplan geladen — im Training-Tab generieren." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.xs }}>
                    {week.map((d) => {
                        const info = dayMacros(plan, k.data, d.date);
                        const overridden = !!(k.data.macroOverrides || {})[d.date];
                        return (
                            <DayMacroRow key={d.date} day={d} info={info} overridden={overridden} acc={acc}
                                onOverride={(macros) => k.setMacroOverride(d.date, macros)}
                                onReset={() => k.setMacroOverride(d.date, null)} />
                        );
                    })}
                </div>
            )}

            <SectionLabel acc={acc}>Makro-Profile (Default pro Trainings-Last)</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                {PROFILE_ORDER.filter((c) => profiles[c]).map((cat) => (
                    <ProfileRow key={cat} cat={cat} profile={profiles[cat]} acc={acc}
                        onCommit={(patch) => k.updateMacroProfile(cat, patch)} />
                ))}
            </div>
        </div>
    );
}

function DayMacroRow({ day, info, overridden, acc, onOverride, onReset }) {
    const { tokens } = useTheme();
    const [edit, setEdit] = useState(false);
    const [m, setM] = useState(info.macros);
    const isToday = day.date === todayISO();
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.sm, display: 'flex', alignItems: 'center', gap: tokens.spacing.sm,
            borderLeft: `3px solid ${isToday ? acc : tokens.colors.border.glass}` }}>
            <div style={{ width: 84, flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.text.primary }}>{day.label}</p>
                <p style={{ margin: 0, fontSize: 10, color: tokens.colors.text.tertiary }}>{info.type}{overridden ? ' ·✎' : ''}</p>
            </div>
            {edit ? (
                <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    {['kcal', 'protein', 'carbs', 'fat'].map((key) => (
                        <input key={key} type="number" value={m[key]} onChange={(e) => setM({ ...m, [key]: Number(e.target.value) || 0 })}
                            title={key} style={{ ...tokens.glass.input, padding: '4px 6px', width: 62, fontSize: tokens.typography.fontSize.xs, outline: 'none' }} />
                    ))}
                    <IconBtn title="Speichern" onClick={() => { onOverride(m); setEdit(false); }} color={acc}><Check size={14} /></IconBtn>
                    <IconBtn title="Abbrechen" onClick={() => { setM(info.macros); setEdit(false); }} color={tokens.colors.text.tertiary}><X size={14} /></IconBtn>
                </div>
            ) : (
                <>
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.text.primary, fontVariantNumeric: 'tabular-nums' }}>
                            {info.macros.kcal} kcal
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: tokens.colors.text.tertiary, fontVariantNumeric: 'tabular-nums' }}>
                            P{info.macros.protein} · K{info.macros.carbs} · F{info.macros.fat}
                        </p>
                    </div>
                    {overridden && <IconBtn title="Auf Default zurücksetzen" onClick={onReset} color={tokens.colors.text.tertiary}><X size={13} /></IconBtn>}
                    <button type="button" onClick={() => { setM(info.macros); setEdit(true); }} style={{
                        background: 'transparent', border: `1px solid ${tokens.colors.border.glass}`, borderRadius: tokens.radius.sm,
                        color: acc, cursor: 'pointer', padding: '3px 8px', fontSize: tokens.typography.fontSize.xs, fontWeight: tokens.typography.fontWeight.semibold,
                    }}>Anpassen</button>
                </>
            )}
        </div>
    );
}

function ProfileRow({ cat, profile, acc, onCommit }) {
    const { tokens } = useTheme();
    const [m, setM] = useState(profile);
    const dirty = ['kcal', 'protein', 'carbs', 'fat'].some((key) => Number(m[key]) !== Number(profile[key]));
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.sm, display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
            <span style={{ width: 110, flexShrink: 0, fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.text.primary }}>{profile.label}</span>
            {['kcal', 'protein', 'carbs', 'fat'].map((key) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: tokens.colors.text.tertiary, textTransform: 'uppercase' }}>{key === 'kcal' ? 'kcal' : key === 'protein' ? 'P' : key === 'carbs' ? 'K' : 'F'}</span>
                    <input type="number" value={m[key]} onChange={(e) => setM({ ...m, [key]: Number(e.target.value) || 0 })}
                        style={{ ...tokens.glass.input, padding: '4px 6px', width: 64, fontSize: tokens.typography.fontSize.xs, outline: 'none', textAlign: 'center' }} />
                </div>
            ))}
            <div style={{ flex: 1 }} />
            {dirty && <IconBtn title="Speichern" onClick={() => onCommit(m)} color={acc}><Save size={14} /></IconBtn>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Shared helpers + small components
// ─────────────────────────────────────────────────────────────
function scaleMacro(m, s) {
    return { kcal: Math.round((m.kcal || 0) * s), protein: Math.round((m.protein || 0) * s), carbs: Math.round((m.carbs || 0) * s), fat: Math.round((m.fat || 0) * s) };
}

// Effektive Tagesmakros: Override hat Vorrang, sonst Profil nach Plan-Tagestyp.
function dayMacros(plan, data, date) {
    const override = (data.macroOverrides || {})[date];
    const day = (plan?.days || []).find((d) => d.date === date);
    const type = day?.type || 'Easy';
    const cat = categoryForType(type);
    const profile = (data.macroProfiles || {})[cat] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const label = day ? `${type}${day.title ? ` — ${day.title}` : ''}` : 'kein Trainingstag';
    return {
        type,
        label,
        macros: override ? override : { kcal: profile.kcal, protein: profile.protein, carbs: profile.carbs, fat: profile.fat },
    };
}

const DOW = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function weekDays(plan) {
    return (plan?.days || []).map((d) => {
        const dt = new Date(d.date + 'T00:00:00');
        return { date: d.date, label: `${DOW[dt.getDay()]} ${dt.getDate()}.` };
    });
}

function UnitSelect({ value, onChange, style }) {
    const { tokens } = useTheme();
    return (
        <select value={UNITS.includes(value) ? value : value} onChange={(e) => onChange(e.target.value)}
            style={{ ...tokens.glass.input, padding: '6px 4px', fontSize: tokens.typography.fontSize.sm, outline: 'none', cursor: 'pointer', ...style }}>
            {UNITS.includes(value) ? null : <option value={value}>{value}</option>}
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
    );
}

function ActionBtn({ children, acc, ghost, onClick, disabled, icon: Icon, spin }) {
    const { tokens } = useTheme();
    return (
        <button type="button" onClick={onClick} disabled={disabled} style={{
            padding: '8px 14px', fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold,
            display: 'inline-flex', alignItems: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer',
            border: ghost ? `1px solid ${tokens.colors.border.glass}` : 'none', borderRadius: tokens.radius.pill,
            background: ghost ? 'transparent' : acc, color: ghost ? tokens.colors.text.secondary : '#fff',
            opacity: disabled ? 0.5 : 1, boxShadow: ghost ? 'none' : tokens.shadow.glow,
        }}>
            {Icon && <Icon size={14} strokeWidth={2.5} style={spin ? { animation: 'kspin 1s linear infinite' } : undefined} />}
            {children}
        </button>
    );
}

function IconBtn({ children, onClick, color, title, disabled }) {
    return (
        <button type="button" onClick={onClick} title={title} disabled={disabled} style={{
            background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', padding: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color, opacity: disabled ? 0.4 : 1,
        }}>{children}</button>
    );
}

function NumField({ value, onCommit, width = 64 }) {
    const { tokens } = useTheme();
    const [v, setV] = useState(value);
    return (
        <input type="number" value={v} onChange={(e) => setV(e.target.value)}
            onBlur={() => onCommit(Number(v) || 0)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            style={{ ...tokens.glass.input, padding: '6px 8px', fontSize: tokens.typography.fontSize.sm, width, outline: 'none', textAlign: 'center' }} />
    );
}

function SectionLabel({ children, acc }) {
    const { tokens } = useTheme();
    return (
        <span style={{ fontSize: 11, fontWeight: tokens.typography.fontWeight.bold, color: acc,
            textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>{children}</span>
    );
}

function SoftEmpty({ label }) {
    const { tokens } = useTheme();
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg, textAlign: 'center',
            color: tokens.colors.text.tertiary, fontSize: tokens.typography.fontSize.sm }}>{label}</div>
    );
}

function Modal({ children, onClose }) {
    const { tokens } = useTheme();
    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: tokens.zIndex.modal,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.lg,
        }}>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={tokens.motion.spring.snappy}
                onClick={(e) => e.stopPropagation()} style={{
                    ...tokens.glass.modal, padding: tokens.spacing.lg, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
                }}>{children}</motion.div>
        </div>
    );
}
