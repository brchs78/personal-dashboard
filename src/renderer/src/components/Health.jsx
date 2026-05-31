// OLE OS — Health Tab (Phase 1: Schlaf + Herz)
// Hero-Kacheln + Schlaf-Detail + Herz-Trends.
// Daten kommen aus useHealthSummary / useHealthTrend (IPC → Main → Cache).

import { Moon, Heart, Activity, Zap, RefreshCw } from 'lucide-react';
import { useHealthSummary, useHealthTrend } from '../hooks/useHealth';
import tokens from '../styles/tokens';

export default function Health() {
    const { summary, status, progress, refresh } = useHealthSummary();

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing.xl,
                padding: tokens.spacing.lg,
                maxWidth: 720,
                margin: '0 auto',
            }}
        >
            <Header status={status} progress={progress} meta={summary?.meta} onRefresh={refresh} />

            {status === 'no-source' && <NoSourceCard />}
            {status === 'error' && <ErrorCard />}

            {summary?.latest && (
                <>
                    <HeroGrid latest={summary.latest} />
                    <SleepSection latest={summary.latest.sleep} />
                    <HeartSection />
                </>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Header — H2 + Status + Refresh-Button
// ──────────────────────────────────────────────────────────────────
function Header({ status, progress, meta, onRefresh }) {
    const subline = (() => {
        if (status === 'parsing') return `Apple Health wird importiert… ${progress}%`;
        if (status === 'loading') return 'Lade…';
        if (status === 'no-source') return 'Keine Export.xml gefunden';
        if (status === 'error') return 'Fehler beim Import';
        if (meta?.exportDate) {
            const d = String(meta.exportDate).slice(0, 10);
            return `Export vom ${d} · ${formatNumber(meta.recordsKept)} relevante Datensätze`;
        }
        return '';
    })();

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: tokens.spacing.lg,
                flexWrap: 'wrap',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2
                    style={{
                        margin: 0,
                        fontFamily: tokens.typography.fontFamily.display,
                        fontSize: tokens.typography.fontSize.xl,
                        fontWeight: tokens.typography.fontWeight.bold,
                        color: tokens.colors.text.primary,
                        letterSpacing: tokens.typography.letterSpacing.tight,
                    }}
                >
                    Health
                </h2>
                {subline && (
                    <p
                        style={{
                            margin: 0,
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.text.tertiary,
                            letterSpacing: tokens.typography.letterSpacing.wide,
                            textTransform: 'uppercase',
                        }}
                    >
                        {subline}
                    </p>
                )}
            </div>
            <button
                type="button"
                onClick={onRefresh}
                disabled={status === 'parsing'}
                title="Apple Health neu importieren"
                style={{
                    ...tokens.glass.button,
                    padding: '8px 14px',
                    fontSize: tokens.typography.fontSize.xs,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    letterSpacing: tokens.typography.letterSpacing.wide,
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: status === 'parsing' ? 'not-allowed' : 'pointer',
                    opacity: status === 'parsing' ? 0.5 : 1,
                }}
            >
                <RefreshCw size={12} strokeWidth={2.5} />
                Reimport
            </button>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// HeroGrid — 4 Kacheln (Sleep / RHR / HRV / Recovery)
// ──────────────────────────────────────────────────────────────────
function HeroGrid({ latest }) {
    const tiles = [
        {
            icon: Moon,
            label: 'Schlaf',
            value: latest.sleep ? formatHours(latest.sleep.totalMin) : '—',
            sub: latest.sleep?.date || '',
        },
        {
            icon: Heart,
            label: 'Resting HR',
            value: latest.rhr ? Math.round(latest.rhr.value) : '—',
            unit: latest.rhr ? 'bpm' : '',
            sub: latest.rhr?.date || '',
        },
        {
            icon: Activity,
            label: 'HRV',
            value: latest.hrv ? Math.round(latest.hrv.value) : '—',
            unit: latest.hrv ? 'ms' : '',
            sub: latest.hrv?.date || '',
        },
        {
            icon: Zap,
            label: 'HR Recovery',
            value: latest.hrRecovery ? Math.round(latest.hrRecovery.value) : '—',
            unit: latest.hrRecovery ? 'bpm/min' : '',
            sub: latest.hrRecovery?.date || '',
        },
    ];

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: tokens.spacing.md,
            }}
        >
            {tiles.map((t) => (
                <HeroTile key={t.label} {...t} />
            ))}
        </div>
    );
}

function HeroTile({ icon: Icon, label, value, unit, sub }) {
    return (
        <div
            style={{
                ...tokens.glass.card,
                padding: tokens.spacing.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing.sm,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing.sm,
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: tokens.radius.sm,
                        background: tokens.colors.accent.soft,
                        border: `1px solid ${tokens.colors.accent.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Icon size={14} strokeWidth={2} color={tokens.colors.accent.DEFAULT} />
                </div>
                <span
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.text.tertiary,
                        textTransform: 'uppercase',
                        letterSpacing: tokens.typography.letterSpacing.wide,
                    }}
                >
                    {label}
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: tokens.spacing.xs }}>
                <span
                    style={{
                        fontFamily: tokens.typography.fontFamily.display,
                        fontSize: tokens.typography.fontSize['2xl'],
                        fontWeight: tokens.typography.fontWeight.bold,
                        color: tokens.colors.accent.DEFAULT,
                        letterSpacing: tokens.typography.letterSpacing.tight,
                        lineHeight: 1,
                    }}
                >
                    {value}
                </span>
                {unit && (
                    <span
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.text.tertiary,
                            letterSpacing: tokens.typography.letterSpacing.wide,
                            textTransform: 'uppercase',
                        }}
                    >
                        {unit}
                    </span>
                )}
            </div>
            {sub && (
                <div
                    style={{
                        fontSize: 10,
                        color: tokens.colors.text.tertiary,
                        letterSpacing: tokens.typography.letterSpacing.wide,
                        textTransform: 'uppercase',
                    }}
                >
                    {sub}
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// SleepSection — Stage-Bar + 7-Tage Trend
// ──────────────────────────────────────────────────────────────────
function SleepSection({ latest }) {
    const { points: trend7 } = useHealthTrend('sleepTotal', 7);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <SectionHeader>Schlaf</SectionHeader>
            <div
                style={{
                    ...tokens.glass.card,
                    padding: tokens.spacing.lg,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: tokens.spacing.md,
                }}
            >
                {latest ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                            <span
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: tokens.colors.text.tertiary,
                                    textTransform: 'uppercase',
                                    letterSpacing: tokens.typography.letterSpacing.wide,
                                }}
                            >
                                Letzte Nacht
                            </span>
                            <span
                                style={{
                                    fontFamily: tokens.typography.fontFamily.display,
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.bold,
                                    color: tokens.colors.text.primary,
                                }}
                            >
                                {formatHours(latest.totalMin)}
                            </span>
                        </div>
                        <StageBar stages={latest.stages} />
                        <StageLegend stages={latest.stages} />
                    </>
                ) : (
                    <span style={{ color: tokens.colors.text.tertiary, fontSize: tokens.typography.fontSize.sm }}>
                        Keine Schlafdaten verfügbar.
                    </span>
                )}
            </div>
            {trend7.length > 0 && (
                <div
                    style={{
                        ...tokens.glass.card,
                        padding: tokens.spacing.lg,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: tokens.spacing.sm,
                    }}
                >
                    <span
                        style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.text.tertiary,
                            textTransform: 'uppercase',
                            letterSpacing: tokens.typography.letterSpacing.wide,
                        }}
                    >
                        Letzte 7 Tage
                    </span>
                    <SleepBars points={trend7} />
                </div>
            )}
        </div>
    );
}

function StageBar({ stages }) {
    const total = (stages.awake || 0) + (stages.rem || 0) + (stages.core || 0) + (stages.deep || 0);
    if (total === 0) return null;
    const segs = [
        { key: 'deep',  v: stages.deep || 0,  color: '#6366f1' }, // deep purple
        { key: 'core',  v: stages.core || 0,  color: tokens.colors.accent.DEFAULT },
        { key: 'rem',   v: stages.rem || 0,   color: '#c026d3' }, // sky
        { key: 'awake', v: stages.awake || 0, color: tokens.colors.text.tertiary },
    ];
    return (
        <div
            style={{
                display: 'flex',
                width: '100%',
                height: 14,
                borderRadius: tokens.radius.full,
                overflow: 'hidden',
                background: tokens.colors.surface.glass,
            }}
        >
            {segs.map((s) => (
                <div
                    key={s.key}
                    style={{
                        width: `${(s.v / total) * 100}%`,
                        background: s.color,
                    }}
                />
            ))}
        </div>
    );
}

function StageLegend({ stages }) {
    const items = [
        { key: 'Deep',  v: stages.deep,  color: '#6366f1' },
        { key: 'Core',  v: stages.core,  color: tokens.colors.accent.DEFAULT },
        { key: 'REM',   v: stages.rem,   color: '#c026d3' },
        { key: 'Awake', v: stages.awake, color: tokens.colors.text.tertiary },
    ];
    return (
        <div
            style={{
                display: 'flex',
                gap: tokens.spacing.md,
                flexWrap: 'wrap',
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.text.secondary,
            }}
        >
            {items.map((it) => (
                <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: it.color }} />
                    <span style={{ letterSpacing: tokens.typography.letterSpacing.wide, textTransform: 'uppercase' }}>
                        {it.key}
                    </span>
                    <span style={{ color: tokens.colors.text.tertiary }}>{formatHours(it.v || 0)}</span>
                </div>
            ))}
        </div>
    );
}

function SleepBars({ points }) {
    if (!points.length) return null;
    const max = Math.max(...points.map((p) => p.value));
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: tokens.spacing.sm, height: 60 }}>
            {points.map((p) => {
                const h = max ? (p.value / max) * 100 : 0;
                return (
                    <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div
                            style={{
                                width: '100%',
                                height: `${h}%`,
                                background: tokens.colors.accent.DEFAULT,
                                opacity: 0.85,
                                borderRadius: '4px 4px 0 0',
                                minHeight: 2,
                            }}
                            title={`${p.date}: ${formatHours(p.value)}`}
                        />
                        <span style={{ fontSize: 10, color: tokens.colors.text.tertiary }}>
                            {p.date.slice(8)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// HeartSection — RHR + HRV Sparklines (30 Tage)
// ──────────────────────────────────────────────────────────────────
function HeartSection() {
    const { points: rhr } = useHealthTrend('rhr', 30);
    const { points: hrv } = useHealthTrend('hrv', 30);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <SectionHeader>Herz · 30 Tage</SectionHeader>
            <SparkCard
                title="Resting HR"
                unit="bpm"
                points={rhr}
                color={tokens.colors.accent.DEFAULT}
                decimals={0}
            />
            <SparkCard
                title="HRV (SDNN)"
                unit="ms"
                points={hrv}
                color="#6366f1"
                decimals={0}
            />
        </div>
    );
}

function SparkCard({ title, unit, points, color, decimals = 0 }) {
    if (!points || !points.length) {
        return (
            <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg }}>
                <span style={{ color: tokens.colors.text.tertiary, fontSize: tokens.typography.fontSize.sm }}>
                    {title}: keine Daten
                </span>
            </div>
        );
    }
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const last = values[values.length - 1];
    const avg = values.reduce((s, v) => s + v, 0) / values.length;

    const w = 320;
    const h = 60;
    const stepX = points.length > 1 ? w / (points.length - 1) : 0;
    const pts = points
        .map((p, i) => {
            const x = i * stepX;
            const y = h - ((p.value - min) / range) * h;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return (
        <div
            style={{
                ...tokens.glass.card,
                padding: tokens.spacing.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing.sm,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.text.tertiary,
                        textTransform: 'uppercase',
                        letterSpacing: tokens.typography.letterSpacing.wide,
                    }}
                >
                    {title}
                </span>
                <div style={{ display: 'flex', gap: tokens.spacing.md, alignItems: 'baseline' }}>
                    <span style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary }}>
                        Ø {avg.toFixed(decimals)} {unit}
                    </span>
                    <span
                        style={{
                            fontFamily: tokens.typography.fontFamily.display,
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.bold,
                            color: tokens.colors.text.primary,
                        }}
                    >
                        {last.toFixed(decimals)}{' '}
                        <span style={{ fontSize: tokens.typography.fontSize.xs, fontWeight: 500, color: tokens.colors.text.tertiary }}>
                            {unit}
                        </span>
                    </span>
                </div>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 60, display: 'block' }}>
                <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Status-Cards (no-source / error)
// ──────────────────────────────────────────────────────────────────
function NoSourceCard() {
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg }}>
            <p
                style={{
                    margin: 0,
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.text.secondary,
                    lineHeight: 1.5,
                }}
            >
                Keine Apple-Health-Daten gefunden. Exportiere aus der iOS-Health-App
                (Profil → Daten exportieren) und entpacke das ZIP nach
                <code
                    style={{
                        marginLeft: 6,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: tokens.colors.surface.glass,
                        fontFamily: tokens.typography.fontFamily.mono,
                        fontSize: tokens.typography.fontSize.xs,
                    }}
                >
                    ~/apple_health_export/Export.xml
                </code>
                .
            </p>
        </div>
    );
}

function ErrorCard() {
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg }}>
            <p
                style={{
                    margin: 0,
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.status.danger,
                }}
            >
                Beim Import gab es einen Fehler. Versuche „Reimport".
            </p>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Shared
// ──────────────────────────────────────────────────────────────────
function SectionHeader({ children }) {
    return (
        <h3
            style={{
                margin: 0,
                fontFamily: tokens.typography.fontFamily.display,
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.primary,
                letterSpacing: tokens.typography.letterSpacing.tight,
            }}
        >
            {children}
        </h3>
    );
}

function formatHours(min) {
    if (!min || !Number.isFinite(min)) return '—';
    const h = Math.floor(min / 60);
    const m = Math.round(min - h * 60);
    return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatNumber(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('de-DE').format(n);
}
