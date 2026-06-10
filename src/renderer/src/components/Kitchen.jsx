// OLE OS — Küche & Ernährung
// 4 Bereiche: Inventar (inkl. Bon-Import), Kosten, Rezepte (KI + Meal-Prep),
// Makros (Training-Sync). Styling über useTheme()-Tokens, inline.

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, X, Check, Minus, Upload, ChefHat, Receipt,
    Utensils, Wallet, Target, Loader2, Sparkles, Save, AlertCircle,
} from 'lucide-react';
import { useKitchen, categoryForType } from '../hooks/useKitchen';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { useTheme } from '../hooks/useTheme.jsx';

function todayISO() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

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
    { id: 'inventar', label: 'Inventar', icon: Utensils },
    { id: 'kosten', label: 'Kosten', icon: Wallet },
    { id: 'rezepte', label: 'Rezepte', icon: ChefHat },
    { id: 'makros', label: 'Makros', icon: Target },
];

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

            {sub === 'inventar' && <Inventar k={k} acc={acc} />}
            {sub === 'kosten' && <Kosten k={k} acc={acc} />}
            {sub === 'rezepte' && <Rezepte k={k} plan={plan} acc={acc} />}
            {sub === 'makros' && <Makros k={k} plan={plan} acc={acc} />}
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
            <input value={item.unit} onChange={(e) => onUpdate({ unit: e.target.value })} style={{
                ...tokens.glass.input, padding: '6px 8px', fontSize: tokens.typography.fontSize.sm, width: 52, outline: 'none',
            }} />
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
            <input placeholder="Einheit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} style={inp} />
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
                            <input value={it.unit} onChange={(e) => upd(i, { unit: e.target.value })} style={inp} />
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

    async function onGenerate() {
        const r = await k.generateRecipe({
            macroTarget: scaleMacro(dayInfo.macros, servings),
            trainingLabel: dayInfo.label,
            servings,
            mealType,
        });
        if (r) setDraft(r);
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
                    <span style={{ flex: 1, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary, fontVariantNumeric: 'tabular-nums' }}>
                        {info.macros.kcal} kcal · P{info.macros.protein} K{info.macros.carbs} F{info.macros.fat}
                    </span>
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
function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

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
