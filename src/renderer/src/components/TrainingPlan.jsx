// OLE OS — KI-Trainingsplan (Wochenansicht Mo-So)
// Generiert via Anthropic API in main-process auf Basis von Health + Strava.

import { Sparkles, RefreshCw, CheckCircle2, Circle, Calendar, Flame, Moon } from 'lucide-react';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import tokens from '../styles/tokens';

const TYPE_COLOR = {
    Easy: tokens.colors.accent.secondary,
    Long: tokens.colors.accent.DEFAULT,
    Tempo: '#a855f7',
    Threshold: '#a855f7',
    Intervals: '#c026d3',
    Recovery: '#818cf8',
    Cross: '#6366f1',
    Rest: tokens.colors.text.tertiary,
    'Yoga+Easy': '#818cf8',
    'Gym+Easy': '#818cf8',
};

export default function TrainingPlan() {
    const { plan, done, busy, error, generate, toggleDone } = useTrainingPlan();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg, padding: tokens.spacing.lg }}>
            <Header plan={plan} busy={busy} onGenerate={() => generate()} />
            {error && <ErrorCard message={error} />}
            {!plan && !busy && <EmptyState onGenerate={() => generate()} />}
            {busy && <BusyCard />}
            {plan && (
                <>
                    <WeekSummary plan={plan} done={done} />
                    <DaysList plan={plan} done={done} onToggle={toggleDone} />
                    <PhaseExplainer phase={plan.phase} />
                </>
            )}
        </div>
    );
}

function Header({ plan, busy, onGenerate }) {
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
                    borderRadius: tokens.radius.md,
                    background: tokens.colors.accent.gradient,
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
                borderRadius: tokens.radius.md,
                background: tokens.colors.accent.gradient,
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
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, borderColor: tokens.colors.status.danger }}>
            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.status.danger }}>
                {message}
            </p>
        </div>
    );
}

function WeekSummary({ plan, done }) {
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

function DaysList({ plan, done, onToggle }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            {(plan.days || []).map((d) => (
                <DayCard key={d.date} day={d} isDone={!!done[d.date]} onToggle={() => onToggle(d.date)} />
            ))}
        </div>
    );
}

function DayCard({ day, isDone, onToggle }) {
    const accent = TYPE_COLOR[day.type] || tokens.colors.accent.DEFAULT;
    return (
        <div style={{
            ...tokens.glass.card,
            padding: tokens.spacing.md,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: tokens.spacing.md,
            alignItems: 'center',
            opacity: isDone ? 0.55 : 1,
            borderLeft: `3px solid ${accent}`,
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
        </div>
    );
}

function Metric({ value, unit }) {
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

function fmtDate(iso) {
    const d = new Date(iso);
    const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    return `${d.getDate()}. ${months[d.getMonth()]}`;
}
