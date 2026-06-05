// OLE OS — KI-Trainingsplan (Wochenansicht Mo-So)
// Generiert via Anthropic API in main-process auf Basis von Health + Strava.

import { useState } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, Circle, Calendar, Flame, Moon, Pencil, X, CalendarClock, ArrowRight, AlertTriangle, BatteryLow } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { useTheme } from "../hooks/useTheme.jsx";

function getTypeColor(tokens) {
    return {
        Easy: tokens.colors.accent.secondary,
        Long: tokens.colors.accent.DEFAULT,
        Tempo: tokens.colors.tab.body,
        Threshold: tokens.colors.tab.body,
        Intervals: tokens.colors.tab.workout,
        Recovery: tokens.colors.tab.calendar,
        Cross: tokens.colors.tab.uni,
        Rest: tokens.colors.text.tertiary,
        'Yoga+Easy': tokens.colors.tab.calendar,
        'Gym+Easy': tokens.colors.tab.calendar,
    };
}

export default function TrainingPlan() {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    const { plan, done, busy, error, generate, recommendFrequency, toggleDone, updateDay } = useTrainingPlan();
    const [editing, setEditing] = useState(null); // day object or null
    const [freqOpen, setFreqOpen] = useState(false);
    const [reco, setReco] = useState(null);

    async function openFrequency() {
        const r = await recommendFrequency();
        setReco(r);
        setFreqOpen(true);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg, padding: tokens.spacing.lg }}>
            <Header plan={plan} busy={busy} onGenerate={openFrequency} />
            {error && <ErrorCard message={error} />}
            {!plan && !busy && <EmptyState onGenerate={openFrequency} />}
            {busy && <BusyCard />}
            {plan && (
                <>
                    <WeekSummary plan={plan} done={done} />
                    {plan.deloadEnforced && <DeloadBadge />}
            {plan.phaseNote && <PhaseNoteBadge note={plan.phaseNote} />}
            {plan.coachNote && <CoachNote note={plan.coachNote} />}
                    <DaysList plan={plan} done={done} onToggle={toggleDone} onEdit={setEditing} />
                    {plan.nextWeekPreview && <NextWeekPreview preview={plan.nextWeekPreview} />}
                    <PhaseExplainer phase={plan.phase} />
                </>
            )}
            <AnimatePresence>
                {freqOpen && (
                    <FrequencyModal
                        reco={reco}
                        onClose={() => setFreqOpen(false)}
                        onConfirm={(runDays) => {
                            setFreqOpen(false);
                            generate(undefined, runDays);
                        }}
                    />
                )}
                {editing && (
                    <DayEditModal
                        day={editing}
                        onClose={() => setEditing(null)}
                        onSave={async (patch) => {
                            await updateDay(editing.date, patch);
                            setEditing(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function CoachNote({ note }) {
    const { tokens } = useTheme();
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', gap: tokens.spacing.sm, alignItems: 'flex-start', borderLeft: `3px solid ${tokens.colors.accent.secondary}` }}>
            <Sparkles size={16} color={tokens.colors.accent.secondary} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 13, color: tokens.colors.text.secondary, lineHeight: 1.55, fontStyle: 'italic' }}>
                {note}
            </p>
        </div>
    );
}

function DeloadBadge() {
    const { tokens } = useTheme();
    return (
        <div style={{
            ...tokens.glass.card,
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            display: 'flex', gap: tokens.spacing.sm, alignItems: 'center',
            borderLeft: `3px solid ${tokens.colors.tab.calendar}`,
            background: `${tokens.colors.tab.calendar}10`,
        }}>
            <BatteryLow size={15} color={tokens.colors.tab.calendar} strokeWidth={2.5} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.tab.calendar }}>
                Entlastungswoche erzwungen
            </span>
            <span style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                — 3 Steigerungswochen in Folge. Volumen −20% für Regeneration.
            </span>
        </div>
    );
}

function PhaseNoteBadge({ note }) {
    const { tokens } = useTheme();
    return (
        <div style={{
            ...tokens.glass.card,
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            display: 'flex', gap: tokens.spacing.sm, alignItems: 'flex-start',
            borderLeft: `3px solid ${tokens.colors.status.warning || tokens.colors.tab.body}`,
            background: `${tokens.colors.tab.body}10`,
        }}>
            <AlertTriangle size={15} color={tokens.colors.tab.body} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12, color: tokens.colors.text.secondary, lineHeight: 1.5 }}>
                {note}
            </p>
        </div>
    );
}

function NextWeekPreview({ preview }) {
    const { tokens } = useTheme();
    return (
        <div style={{
            ...tokens.glass.card,
            padding: tokens.spacing.md,
            display: 'flex',
            gap: tokens.spacing.md,
            alignItems: 'center',
            borderStyle: 'dashed',
            borderColor: tokens.colors.border.glass,
        }}>
            <CalendarClock size={20} color={tokens.colors.accent.DEFAULT} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: tokens.typography.letterSpacing.wide,
                    color: tokens.colors.text.tertiary,
                    marginBottom: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                }}>
                    Ausblick nächste Woche
                    {preview.phase && <span style={{ color: tokens.colors.accent.DEFAULT, fontWeight: 700 }}>· {preview.phase}</span>}
                    {preview.targetKm != null && <span style={{ color: tokens.colors.accent.DEFAULT, fontWeight: 700 }}>· ~{preview.targetKm} km</span>}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: tokens.colors.text.secondary, lineHeight: 1.5 }}>
                    {preview.focus}
                </p>
            </div>
        </div>
    );
}

const RUN_DAY_OPTIONS = [3, 4, 5];

function FrequencyModal({ reco, onClose, onConfirm }) {
    const { tokens } = useTheme();
    const recommended = reco?.recommendedRunDays || 3;
    const [runDays, setRunDays] = useState(recommended);

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', zIndex: 950 }}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    width: 420, maxWidth: '92vw',
                    ...tokens.glass.modal,
                    padding: 22, zIndex: 951,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: tokens.typography.fontSize.lg, fontWeight: 700, color: tokens.colors.text.primary }}>
                        Wie oft kannst du diese Woche laufen?
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.colors.text.secondary, padding: 4 }}>
                        <X size={18} />
                    </button>
                </div>

                {reco && (
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: tokens.colors.text.secondary, lineHeight: 1.55 }}>
                        Coach-Empfehlung: <strong style={{ color: tokens.colors.accent.DEFAULT }}>{recommended} Lauftage</strong>
                        {reco.lastWeeklyKm ? ` (Vorwoche ~${reco.lastWeeklyKm} km` : ' (noch kein Vorwert'}
                        {reco.phase ? ` · Phase ${reco.phase}` : ''}
                        {reco.weeksToMarathon != null ? ` · T-${reco.weeksToMarathon} Wo` : ''})
                        . Ab ~50 km/Woche lohnt sich ein 4. Lauf, um die Einzelläufe kurz zu halten.
                    </p>
                )}

                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    {RUN_DAY_OPTIONS.map((n) => {
                        const active = runDays === n;
                        const isReco = n === recommended;
                        return (
                            <button
                                key={n}
                                onClick={() => setRunDays(n)}
                                style={{
                                    flex: 1,
                                    padding: '14px 0',
                                    borderRadius: tokens.radius.md,
                                    border: `1.5px solid ${active ? tokens.colors.accent.DEFAULT : tokens.colors.border.glass}`,
                                    background: active ? `${tokens.colors.accent.DEFAULT}18` : tokens.colors.surface.glass,
                                    color: active ? tokens.colors.accent.DEFAULT : tokens.colors.text.secondary,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 3,
                                    position: 'relative',
                                }}
                            >
                                <span style={{ fontFamily: tokens.typography.fontFamily.display, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{n}</span>
                                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Läufe</span>
                                {isReco && (
                                    <span style={{
                                        position: 'absolute', top: -8, right: -6,
                                        fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                        background: tokens.colors.accent.DEFAULT, color: '#fff',
                                        padding: '2px 5px', borderRadius: tokens.radius.sm,
                                    }}>Tipp</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <button onClick={() => onConfirm(runDays)} style={{
                    ...tokens.glass.buttonAccent, width: '100%',
                    padding: '11px 14px', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                    <Sparkles size={14} strokeWidth={2.5} />
                    Plan mit {runDays} Lauftagen generieren
                    <ArrowRight size={14} strokeWidth={2.5} />
                </button>
            </motion.div>
        </>
    );
}

function Header({ plan, busy, onGenerate }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.spacing.lg, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 style={{
                    margin: 0,
                    fontFamily: tokens.typography.fontFamily.display,
                    fontSize: tokens.typography.fontSize.xl,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.text.primary,
                    letterSpacing: tokens.typography.letterSpacing.tight,
                }}>Trainingsplan</h2>
                <p style={{
                    margin: 0,
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.text.tertiary,
                    textTransform: 'uppercase',
                    letterSpacing: tokens.typography.letterSpacing.wide,
                }}>
                    KI-generiert · Marathon 11.10.2026 · Sub-3:10
                </p>
            </div>
            <button
                type="button"
                onClick={onGenerate}
                disabled={busy}
                style={{
                    padding: '10px 18px',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    letterSpacing: tokens.typography.letterSpacing.wide,
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.5 : 1,
                    border: 'none',
                    borderRadius: tokens.radius.pill,
                    background: tokens.colors.accent.DEFAULT,
                    color: '#ffffff',
                    boxShadow: tokens.shadow.glow,
                }}
            >
                {busy
                    ? <RefreshCw size={14} strokeWidth={2.5} className="spin" />
                    : <Sparkles size={14} strokeWidth={2.5} />}
                {busy ? 'Plane…' : plan ? 'Neu generieren' : 'Plan generieren'}
            </button>
        </div>
    );
}

function EmptyState({ onGenerate }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.xl, display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <Sparkles size={32} color={tokens.colors.accent.DEFAULT} strokeWidth={2} />
            <h3 style={{ margin: 0, fontSize: tokens.typography.fontSize.lg, color: tokens.colors.text.primary }}>
                Noch kein Plan
            </h3>
            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary, lineHeight: 1.6 }}>
                Die KI analysiert deine letzten Strava-Läufe + Apple-Health-Recovery (HRV, RHR, Schlaf)
                und baut eine Phase-1-Base-Building-Woche. Fokus: Volumen statt Speed.
            </p>
            <button onClick={onGenerate} style={{
                padding: '10px 18px',
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                textTransform: 'uppercase',
                letterSpacing: tokens.typography.letterSpacing.wide,
                border: 'none',
                borderRadius: tokens.radius.pill,
                background: tokens.colors.accent.DEFAULT,
                color: '#fff',
                cursor: 'pointer',
                boxShadow: tokens.shadow.glow,
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
            }}>
                <Sparkles size={14} strokeWidth={2.5} />
                Ersten Plan generieren
            </button>
        </div>
    );
}

function BusyCard() {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg, display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
            <RefreshCw size={20} color={tokens.colors.accent.DEFAULT} className="spin" />
            <span style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary }}>
                KI denkt nach… (analysiert Strava + Health, baut Wochenplan)
            </span>
        </div>
    );
}

function ErrorCard({ message }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, borderColor: tokens.colors.status.danger }}>
            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.status.danger }}>
                {message}
            </p>
        </div>
    );
}

function WeekSummary({ plan, done }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    const total = plan.days?.reduce((s, d) => s + (d.distanceKm || 0), 0) || plan.weeklyKm || 0;
    const completedCount = plan.days?.filter(d => done[d.date]).length || 0;
    const totalCount = plan.days?.length || 0;
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: tokens.spacing.md }}>
            <SummaryStat icon={Calendar} label="Phase" value={plan.phase || '–'} />
            <SummaryStat icon={Flame} label="km geplant" value={total.toFixed(0)} />
            <SummaryStat icon={CheckCircle2} label="Erledigt" value={`${completedCount}/${totalCount}`} />
            {plan.summary && (
                <p style={{
                    gridColumn: '1 / -1',
                    margin: 0,
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.text.secondary,
                    lineHeight: 1.5,
                    paddingTop: tokens.spacing.sm,
                    borderTop: `1px solid ${tokens.colors.border.glass}`,
                }}>
                    {plan.summary}
                </p>
            )}
        </div>
    );
}

function SummaryStat({ icon: Icon, label, value }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: tokens.colors.text.tertiary }}>
                <Icon size={12} strokeWidth={2.5} />
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
                    {label}
                </span>
            </div>
            <div style={{
                fontFamily: tokens.typography.fontFamily.display,
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.accent.DEFAULT,
                lineHeight: 1,
            }}>{value}</div>
        </div>
    );
}

function DaysList({ plan, done, onToggle, onEdit }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            {(plan.days || []).map((d) => (
                <DayCard key={d.date} day={d} isDone={!!done[d.date]} onToggle={() => onToggle(d.date)} onEdit={() => onEdit(d)} />
            ))}
        </div>
    );
}

function DayCard({ day, isDone, onToggle, onEdit }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    const [hovered, setHovered] = useState(false);
    const accent = TYPE_COLOR[day.type] || tokens.colors.accent.DEFAULT;
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
            ...tokens.glass.card,
            padding: tokens.spacing.md,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: tokens.spacing.md,
            alignItems: 'center',
            opacity: isDone ? 0.55 : 1,
            borderLeft: `3px solid ${accent}`,
            position: 'relative',
        }}>
            <button onClick={onToggle} type="button" style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} title={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}>
                {isDone
                    ? <CheckCircle2 size={22} color={tokens.colors.accent.DEFAULT} strokeWidth={2.5} />
                    : <Circle size={22} color={tokens.colors.text.tertiary} strokeWidth={2} />}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{
                        fontFamily: tokens.typography.fontFamily.display,
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.bold,
                        color: tokens.colors.text.primary,
                        textTransform: 'uppercase',
                        letterSpacing: tokens.typography.letterSpacing.wide,
                    }}>{day.dayLabel}</span>
                    <span style={{ fontSize: 11, color: tokens.colors.text.tertiary }}>
                        {fmtDate(day.date)}
                    </span>
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        textTransform: 'uppercase',
                        letterSpacing: tokens.typography.letterSpacing.wide,
                        color: accent,
                        padding: '2px 8px',
                        background: `${accent}20`,
                        borderRadius: tokens.radius.sm,
                    }}>{day.type}</span>
                </div>
                <div style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.text.primary,
                    textDecoration: isDone ? 'line-through' : 'none',
                }}>{day.title}</div>
                {day.notes && (
                    <p style={{
                        margin: 0,
                        fontSize: 12,
                        color: tokens.colors.text.secondary,
                        lineHeight: 1.5,
                    }}>{day.notes}</p>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, minWidth: 70 }}>
                {day.distanceKm != null && (
                    <Metric value={`${day.distanceKm}`} unit="km" />
                )}
                {day.paceTarget && (
                    <span style={{ fontSize: 10, color: tokens.colors.text.tertiary, letterSpacing: tokens.typography.letterSpacing.wide }}>
                        {day.paceTarget}
                    </span>
                )}
                {day.hrZone && (
                    <span style={{
                        fontSize: 9,
                        color: accent,
                        fontWeight: tokens.typography.fontWeight.bold,
                        letterSpacing: tokens.typography.letterSpacing.wide,
                    }}>{day.hrZone}</span>
                )}
            </div>
            {hovered && (
                <button
                    onClick={onEdit}
                    title="Tag bearbeiten"
                    style={{
                        position: 'absolute',
                        top: 8, right: 8,
                        width: 26, height: 26,
                        borderRadius: tokens.radius.sm,
                        border: `1px solid ${tokens.colors.border.glass}`,
                        background: tokens.colors.surface.glass,
                        color: tokens.colors.text.tertiary,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Pencil size={13} />
                </button>
            )}
        </div>
    );
}

function Metric({ value, unit }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{
                fontFamily: tokens.typography.fontFamily.display,
                fontSize: tokens.typography.fontSize.md,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.accent.DEFAULT,
                lineHeight: 1,
            }}>{value}</span>
            <span style={{ fontSize: 9, color: tokens.colors.text.tertiary, textTransform: 'uppercase' }}>
                {unit}
            </span>
        </div>
    );
}

function PhaseExplainer({ phase }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    const explainers = {
        Base: {
            title: 'Phase 1 · Base-Building',
            text: 'Aerobe Basis aufbauen. Nur Easy + Long Run. Keine Intervalle. Mitochondrien wachsen, Sehnen härten. Volumen progressiv +10%/Woche.',
            icon: Moon,
        },
        Build: {
            title: 'Phase 2 · Aerobic Build',
            text: 'Schwelle + Marathon-Pace-Blocks. 1-2 Quality-Einheiten pro Woche. Volumen 70-80 km.',
            icon: Flame,
        },
        Peak: {
            title: 'Phase 3 · Peak',
            text: 'Maximales Volumen + 2× Quality. Long Runs >32 km. Spezifität für Marathon.',
            icon: Flame,
        },
        Taper: {
            title: 'Phase 4 · Taper',
            text: 'Volumen -40%/Woche, Intensität halten. Frisch an die Startlinie.',
            icon: Sparkles,
        },
    };
    const info = explainers[phase];
    if (!info) return null;
    const Icon = info.icon;
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', gap: tokens.spacing.md, alignItems: 'flex-start' }}>
            <Icon size={20} color={tokens.colors.accent.DEFAULT} strokeWidth={2} />
            <div>
                <div style={{
                    fontSize: 11,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.accent.DEFAULT,
                    textTransform: 'uppercase',
                    letterSpacing: tokens.typography.letterSpacing.wide,
                    marginBottom: 4,
                }}>{info.title}</div>
                <p style={{ margin: 0, fontSize: 12, color: tokens.colors.text.secondary, lineHeight: 1.5 }}>
                    {info.text}
                </p>
            </div>
        </div>
    );
}

const ALL_TYPES = ['Easy','Long','Tempo','Threshold','Intervals','Recovery','Cross','Rest','Yoga+Easy','Gym+Easy'];

function DayEditModal({ day, onClose, onSave }) {
    const { tokens } = useTheme();
    const TYPE_COLOR = getTypeColor(tokens);
    const [type, setType] = useState(day.type || 'Easy');
    const [title, setTitle] = useState(day.title || '');
    const [distanceKm, setDistanceKm] = useState(day.distanceKm != null ? String(day.distanceKm) : '');
    const [paceTarget, setPaceTarget] = useState(day.paceTarget || '');
    const [hrZone, setHrZone] = useState(day.hrZone || '');
    const [notes, setNotes] = useState(day.notes || '');

    function save() {
        const patch = { type, title, paceTarget, hrZone: hrZone || null, notes };
        const km = parseFloat(distanceKm);
        patch.distanceKm = isNaN(km) ? null : km;
        onSave(patch);
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', zIndex: 950 }}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    width: 380, maxWidth: '92vw',
                    ...tokens.glass.modal,
                    padding: 20, zIndex: 951,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: tokens.typography.fontSize.lg, fontWeight: 700, color: tokens.colors.text.primary }}>
                        {day.dayLabel} · {fmtDate(day.date)}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.colors.text.secondary, padding: 4 }}>
                        <X size={18} />
                    </button>
                </div>

                <label style={labelStyle(tokens)}>Typ</label>
                <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle(tokens)}>
                    {ALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>

                <label style={{ ...labelStyle(tokens), marginTop: 10 }}>Titel</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle(tokens)} placeholder="z.B. Easy 10km Zone 2" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <div>
                        <label style={labelStyle(tokens)}>Distanz (km)</label>
                        <input type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)}
                            placeholder="optional" style={inputStyle(tokens)} />
                    </div>
                    <div>
                        <label style={labelStyle(tokens)}>HR-Zone</label>
                        <select value={hrZone} onChange={(e) => setHrZone(e.target.value)} style={inputStyle(tokens)}>
                            <option value="">–</option>
                            {['Z1','Z2','Z3','Z4','Z5'].map((z) => <option key={z} value={z}>{z}</option>)}
                        </select>
                    </div>
                </div>

                <label style={{ ...labelStyle(tokens), marginTop: 10 }}>Pace-Ziel</label>
                <input value={paceTarget} onChange={(e) => setPaceTarget(e.target.value)}
                    placeholder="5:20–5:40/km" style={inputStyle(tokens)} />

                <label style={{ ...labelStyle(tokens), marginTop: 10 }}>Notizen</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={2} style={{ ...inputStyle(tokens), resize: 'vertical' }} />

                <button onClick={save} style={{
                    ...tokens.glass.buttonAccent, marginTop: 16, width: '100%',
                    padding: '10px 14px', cursor: 'pointer',
                }}>
                    Speichern
                </button>
            </motion.div>
        </>
    );
}

function inputStyle(tokens) {
    return {
        ...tokens.glass.input,
        width: '100%', padding: '8px 10px', fontSize: 13,
        outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    };
}

function labelStyle(tokens) {
    return {
        display: 'block', fontSize: 10, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: tokens.colors.text.tertiary,
        marginBottom: 4, fontWeight: 600,
    };
}

function fmtDate(iso) {
    const d = new Date(iso);
    const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    return `${d.getDate()}. ${months[d.getMonth()]}`;
}
