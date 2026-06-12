// OLE OS — Health Tab (COROS)
// Readiness-Gauges + Schlaf-Donut + Herz-/Belastungs-/Fitness-/Aktivitäts-Charts.
// Daten aus useCorosSummary / useCorosTrend (IPC → Main → MCP-Client → Cache).

import { Moon, Heart, Activity, Flame, Gauge, RefreshCw, Link2, Unlink, Target } from 'lucide-react';
import { useCorosSummary, useCorosTrend } from '../hooks/useCoros';
import { GaugeRing, StagesDonut, LineChart, MultiLine } from './charts.jsx';
import StravaSection from './StravaSection';
import { useTheme } from '../hooks/useTheme.jsx';

// Marathon-Ziel-Pace (Sub 3:10 → 4:30/km).
const GOAL_PACE_SEC = 4 * 60 + 30;

export default function Health() {
    const { tokens } = useTheme();
    const { summary, snapshot, status, syncedAt, connect, disconnect, refresh } = useCorosSummary();

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: tokens.spacing.xl,
            padding: tokens.spacing.lg, maxWidth: 760, margin: '0 auto',
        }}>
            <Header
                status={status}
                syncedAt={syncedAt}
                connected={status === 'ready' || status === 'syncing'}
                onRefresh={refresh}
                onDisconnect={disconnect}
            />

            {status === 'disconnected' && <ConnectCard onConnect={connect} busy={false} />}
            {status === 'syncing' && !summary && <ConnectCard onConnect={connect} busy={true} />}
            {status === 'error' && <ErrorCard />}

            {summary && (
                <>
                    <ReadinessRow latest={summary} />
                    <QuickStats latest={summary} />
                    <SleepSection latest={summary.sleep} />
                    <HeartSection latest={summary} />
                    <LoadSection latest={summary} />
                    <FitnessSection latest={summary} history={snapshot?.fitnessHistory} />
                    <ActivitySection />
                </>
            )}
            <StravaSection />
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Header
// ──────────────────────────────────────────────────────────────────
function Header({ status, syncedAt, connected, onRefresh, onDisconnect }) {
    const { tokens } = useTheme();
    const subline = (() => {
        if (status === 'syncing') return 'COROS wird synchronisiert…';
        if (status === 'loading') return 'Lade…';
        if (status === 'disconnected') return 'Nicht verbunden';
        if (status === 'error') return 'Fehler beim Abruf';
        if (syncedAt) return `Sync ${fmtSync(syncedAt)}`;
        return '';
    })();

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.lg, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 style={{
                    margin: 0, fontFamily: tokens.typography.fontFamily.display,
                    fontSize: tokens.typography.fontSize.xl, fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.text.primary, letterSpacing: tokens.typography.letterSpacing.tight,
                }}>Gesundheit</h2>
                {subline && (
                    <p style={{
                        margin: 0, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary,
                        letterSpacing: tokens.typography.letterSpacing.wide, textTransform: 'uppercase',
                    }}>{subline}</p>
                )}
            </div>
            {connected && (
                <div style={{ display: 'flex', gap: 8 }}>
                    <IconButton onClick={onRefresh} disabled={status === 'syncing'} title="COROS synchronisieren">
                        <RefreshCw size={12} strokeWidth={2.5} />Sync
                    </IconButton>
                    <IconButton onClick={onDisconnect} disabled={status === 'syncing'} title="Trennen">
                        <Unlink size={12} strokeWidth={2.5} />Trennen
                    </IconButton>
                </div>
            )}
        </div>
    );
}

function IconButton({ children, onClick, disabled, title }) {
    const { tokens } = useTheme();
    return (
        <button type="button" onClick={onClick} disabled={disabled} title={title}
            style={{
                ...tokens.glass.button, padding: '8px 12px', fontSize: tokens.typography.fontSize.xs,
                fontWeight: tokens.typography.fontWeight.semibold, letterSpacing: tokens.typography.letterSpacing.wide,
                textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
            }}>
            {children}
        </button>
    );
}

// ──────────────────────────────────────────────────────────────────
// ReadinessRow — 3 Ring-Gauges: Recovery / Schlaf-Score / ACWR
// ──────────────────────────────────────────────────────────────────
function ReadinessRow({ latest }) {
    const { tokens } = useTheme();
    const acwr = latest.acwr?.value ?? null;
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: tokens.spacing.md }}>
                <GaugeRing
                    value={latest.recovery?.value}
                    color={scoreColor(latest.recovery?.value, tokens)}
                    label="Recovery" unit="%"
                />
                <GaugeRing
                    value={latest.sleep?.score}
                    color={scoreColor(latest.sleep?.score, tokens)}
                    label="Schlaf-Score"
                />
                <GaugeRing
                    value={acwr} max={2}
                    color={acwrColor(acwr, tokens)}
                    label="ACWR" sublabel={acwrZone(acwr)}
                    format={(v) => (v != null ? v.toFixed(2) : '—')}
                />
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// QuickStats — kompakte Werte-Strip: RHR / HRV / VO2max·Pace / Load
// ──────────────────────────────────────────────────────────────────
function QuickStats({ latest }) {
    const { tokens } = useTheme();
    const tiles = [
        { icon: Heart, label: 'Resting HR', value: latest.rhr ? Math.round(latest.rhr.value) : '—', unit: 'bpm' },
        { icon: Activity, label: 'HRV', value: latest.hrv ? Math.round(latest.hrv.value) : '—', unit: 'ms' },
        latest.vo2max
            ? { icon: Gauge, label: 'VO2max', value: Math.round(latest.vo2max.value), unit: 'ml/kg' }
            : { icon: Gauge, label: 'Threshold', value: latest.thresholdPace || '—', unit: '/km' },
        { icon: Flame, label: 'Load (akut)', value: latest.trainingLoad ? Math.round(latest.trainingLoad.value) : '—', unit: '' },
    ];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: tokens.spacing.md }}>
            {tiles.map((t) => <StatTile key={t.label} {...t} />)}
        </div>
    );
}

function StatTile({ icon: Icon, label, value, unit }) {
    const { tokens } = useTheme();
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.md, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon size={13} strokeWidth={2} color={tokens.colors.accent.DEFAULT} />
                <span style={{
                    fontSize: 10, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.text.tertiary,
                    textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide,
                }}>{label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{
                    fontFamily: tokens.typography.fontFamily.display, fontSize: tokens.typography.fontSize.xl,
                    fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.accent.DEFAULT, lineHeight: 1,
                }}>{value}</span>
                {unit && <span style={{ fontSize: 10, color: tokens.colors.text.tertiary }}>{unit}</span>}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// SleepSection — Stage-Donut + Legende + 7-Tage-Score-Linie
// ──────────────────────────────────────────────────────────────────
function SleepSection({ latest }) {
    const { tokens } = useTheme();
    const { points: score30 } = useCorosTrend('sleepScore', 30);
    const { points: total7 } = useCorosTrend('sleepTotal', 14);

    const stageColors = {
        deep: '#6366f1', core: tokens.colors.accent.DEFAULT, rem: '#c026d3', awake: tokens.colors.text.tertiary,
    };
    const segs = latest ? [
        { label: 'Deep', value: latest.stages.deep, color: stageColors.deep },
        { label: 'Core', value: latest.stages.core, color: stageColors.core },
        { label: 'REM', value: latest.stages.rem, color: stageColors.rem },
        { label: 'Awake', value: latest.stages.awake, color: stageColors.awake },
    ] : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <SectionHeader>Schlaf</SectionHeader>
            <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg, display: 'grid', gridTemplateColumns: '160px 1fr', gap: tokens.spacing.lg, alignItems: 'center' }}>
                {latest ? (
                    <>
                        <StagesDonut segments={segs} centerValue={formatHours(latest.totalMin)} centerLabel="gesamt" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                            {segs.map((s) => (
                                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                                    <span style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary, flex: 1 }}>{s.label}</span>
                                    <span style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.primary, fontWeight: 600 }}>{formatHours(s.value)}</span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <span style={{ color: tokens.colors.text.tertiary, fontSize: tokens.typography.fontSize.sm, gridColumn: '1 / -1' }}>
                        Keine Schlafdaten verfügbar.
                    </span>
                )}
            </div>
            {score30.length > 0 && (
                <ChartCard title="Schlaf-Score · 30 Tage" lastVal={total7.length ? formatHours(total7[total7.length - 1].value) : null}>
                    <LineChart points={score30} color={tokens.colors.accent.DEFAULT} min={0} max={100} />
                </ChartCard>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// HeartSection — RHR (Baseline) + HRV (Baseline-Band)
// ──────────────────────────────────────────────────────────────────
function HeartSection({ latest }) {
    const { tokens } = useTheme();
    const { points: rhr } = useCorosTrend('rhr', 30);
    const { points: hrv } = useCorosTrend('hrv', 30);
    const hrvBase = latest.hrvBaseline;
    const band = hrvBase ? [hrvBase * 0.92, hrvBase * 1.08] : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <SectionHeader>Herz · 30 Tage</SectionHeader>
            <ChartCard
                title="Resting HR" unit="bpm"
                lastVal={rhr.length ? `${rhr[rhr.length - 1].value}` : null}
                hint={latest.rhrBaseline ? `Baseline ${latest.rhrBaseline}` : null}
            >
                <LineChart points={rhr} color={tokens.colors.accent.DEFAULT} baseline={latest.rhrBaseline} />
            </ChartCard>
            <ChartCard
                title="HRV" unit="ms"
                lastVal={hrv.length ? `${hrv[hrv.length - 1].value}` : null}
                hint={hrvBase ? `Baseline ${hrvBase} · Band ±8%` : null}
            >
                <LineChart points={hrv} color={tokens.colors.accent.secondary} baseline={hrvBase} band={band} />
            </ChartCard>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// LoadSection — ST/LT-Load Overlay + ACWR mit Safe-Zone-Band
// ──────────────────────────────────────────────────────────────────
function LoadSection({ latest }) {
    const { tokens } = useTheme();
    const { points: st } = useCorosTrend('stLoad', 30);
    const { points: lt } = useCorosTrend('ltLoad', 30);
    const { points: acwr } = useCorosTrend('acwr', 30);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <SectionHeader>Belastung</SectionHeader>
            <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                <CardLabel>Training-Load · akut vs. chronisch</CardLabel>
                <MultiLine series={[
                    { points: st, color: tokens.colors.accent.DEFAULT, label: 'Akut (7d)' },
                    { points: lt, color: tokens.colors.accent.secondary, label: 'Chronisch (28d)' },
                ]} />
            </div>
            <ChartCard
                title="ACWR · Verletzungsrisiko"
                lastVal={latest.acwr ? latest.acwr.value.toFixed(2) : null}
                hint="Safe-Zone 0.8–1.3"
            >
                <LineChart points={acwr} color={acwrColor(latest.acwr?.value, tokens)} band={[0.8, 1.3]} min={0} max={2} />
            </ChartCard>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// FitnessSection — Threshold-Pace vs. Ziel + Verlauf + Race-Predictions
// ──────────────────────────────────────────────────────────────────
function FitnessSection({ latest, history }) {
    const { tokens } = useTheme();
    const paceSec = paceToSec(latest.thresholdPace);
    const paceHist = (history || [])
        .filter((e) => e.thresholdPace)
        .map((e) => ({ date: e.date, value: paceToSec(e.thresholdPace) }))
        .filter((p) => p.value != null);
    const preds = latest.racePredictions || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <SectionHeader>Fitness & Ziel</SectionHeader>
            <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg, display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.lg, flexWrap: 'wrap' }}>
                    <PaceStat label="Threshold-Pace" value={latest.thresholdPace || '—'} color={tokens.colors.text.primary} />
                    <Target size={16} color={tokens.colors.text.tertiary} />
                    <PaceStat label="Marathon-Ziel" value={secToPace(GOAL_PACE_SEC)} color={tokens.colors.accent.DEFAULT} />
                    {paceSec != null && (
                        <span style={{
                            marginLeft: 'auto', fontSize: tokens.typography.fontSize.xs,
                            color: paceSec <= GOAL_PACE_SEC ? tokens.colors.status.success : tokens.colors.status.warning,
                            fontWeight: 600,
                        }}>
                            {paceSec <= GOAL_PACE_SEC ? 'auf Zielkurs' : `${secToPace(paceSec - GOAL_PACE_SEC)}/km über Ziel`}
                        </span>
                    )}
                </div>
                {paceHist.length > 1 && (
                    <div>
                        <CardLabel>Threshold-Pace-Verlauf (Sekunden/km, niedriger = schneller)</CardLabel>
                        <LineChart points={paceHist} color={tokens.colors.accent.DEFAULT} baseline={GOAL_PACE_SEC} />
                    </div>
                )}
                {preds.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <CardLabel>Race-Predictions</CardLabel>
                        {preds.map((p, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: tokens.typography.fontSize.sm }}>
                                <span style={{ color: tokens.colors.text.secondary, textTransform: 'capitalize' }}>{p.race}</span>
                                <span style={{ color: tokens.colors.text.primary, fontWeight: 600, fontFamily: tokens.typography.fontFamily.mono }}>{p.time}</span>
                            </div>
                        ))}
                    </div>
                )}
                {paceHist.length <= 1 && preds.length === 0 && (
                    <span style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary }}>
                        Verlauf baut sich mit jedem Sync auf.
                    </span>
                )}
            </div>
        </div>
    );
}

function PaceStat({ label, value, color }) {
    const { tokens } = useTheme();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: tokens.colors.text.tertiary, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>{label}</span>
            <span style={{ fontFamily: tokens.typography.fontFamily.display, fontSize: tokens.typography.fontSize.xl, fontWeight: 700, color }}>
                {value}<span style={{ fontSize: 11, color: tokens.colors.text.tertiary }}> /km</span>
            </span>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// ActivitySection — Steps + Stress (Daily Metrics)
// ──────────────────────────────────────────────────────────────────
function ActivitySection() {
    const { tokens } = useTheme();
    const { points: steps } = useCorosTrend('steps', 14);
    const { points: stress } = useCorosTrend('stress', 14);
    if (!steps.length && !stress.length) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <SectionHeader>Aktivität · 14 Tage</SectionHeader>
            {steps.length > 0 && (
                <ChartCard title="Schritte" lastVal={steps.length ? steps[steps.length - 1].value.toLocaleString('de-DE') : null}>
                    <LineChart points={steps} color={tokens.colors.accent.DEFAULT} min={0} />
                </ChartCard>
            )}
            {stress.length > 0 && (
                <ChartCard title="Stress (Ø)" lastVal={stress.length ? `${stress[stress.length - 1].value}` : null}>
                    <LineChart points={stress} color={tokens.colors.status.warning} min={0} max={100} />
                </ChartCard>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// ChartCard — Karten-Wrapper für ein Chart mit Titel + letztem Wert
// ──────────────────────────────────────────────────────────────────
function ChartCard({ title, unit, lastVal, hint, children }) {
    const { tokens } = useTheme();
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <CardLabel>{title}</CardLabel>
                {lastVal != null && (
                    <span style={{ fontFamily: tokens.typography.fontFamily.display, fontSize: tokens.typography.fontSize.lg, fontWeight: 700, color: tokens.colors.text.primary }}>
                        {lastVal}{unit && <span style={{ fontSize: 11, fontWeight: 500, color: tokens.colors.text.tertiary }}> {unit}</span>}
                    </span>
                )}
            </div>
            {children}
            {hint && <span style={{ fontSize: 10, color: tokens.colors.text.tertiary, letterSpacing: tokens.typography.letterSpacing.wide }}>{hint}</span>}
        </div>
    );
}

function CardLabel({ children }) {
    const { tokens } = useTheme();
    return (
        <span style={{
            fontSize: tokens.typography.fontSize.xs, color: tokens.colors.text.tertiary,
            textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide,
        }}>{children}</span>
    );
}

// ──────────────────────────────────────────────────────────────────
// Status-Cards
// ──────────────────────────────────────────────────────────────────
function ConnectCard({ onConnect, busy }) {
    const { tokens } = useTheme();
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg, display: 'flex', flexDirection: 'column', gap: tokens.spacing.md, alignItems: 'flex-start' }}>
            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary, lineHeight: 1.5 }}>
                Verbinde deine COROS-Uhr, um Schlaf, HRV, Recovery, Resting HR, Training-Load
                und ACWR direkt in OLE OS zu sehen.
            </p>
            <button type="button" onClick={onConnect} disabled={busy}
                style={{
                    padding: '10px 18px', fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold,
                    letterSpacing: tokens.typography.letterSpacing.wide, textTransform: 'uppercase', display: 'inline-flex',
                    alignItems: 'center', gap: 8, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
                    border: 'none', borderRadius: tokens.radius.md, background: tokens.colors.accent.gradient,
                    color: '#ffffff', boxShadow: tokens.shadow.glow,
                }}>
                <Link2 size={14} strokeWidth={2.5} />
                {busy ? 'Öffne Browser…' : 'COROS verbinden'}
            </button>
        </div>
    );
}

function ErrorCard() {
    const { tokens } = useTheme();
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg }}>
            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.status.danger }}>
                Beim Abruf der COROS-Daten gab es einen Fehler. Versuche „Sync".
            </p>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Shared
// ──────────────────────────────────────────────────────────────────
function SectionHeader({ children }) {
    const { tokens } = useTheme();
    return (
        <h3 style={{
            margin: 0, fontFamily: tokens.typography.fontFamily.display, fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.text.primary,
            letterSpacing: tokens.typography.letterSpacing.tight,
        }}>{children}</h3>
    );
}

function formatHours(min) {
    if (!min || !Number.isFinite(min)) return '—';
    const h = Math.floor(min / 60);
    const m = Math.round(min - h * 60);
    return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}

function fmtSync(iso) {
    const d = new Date(iso);
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'gerade eben';
    if (diffMin < 60) return `vor ${diffMin}m`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `vor ${diffH}h`;
    return d.toLocaleDateString('de-DE');
}

function paceToSec(str) {
    if (typeof str !== 'string') return null;
    const m = str.match(/(\d+):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function secToPace(sec) {
    if (sec == null || !Number.isFinite(sec)) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec - m * 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

// Zonen-Farben für Recovery/Schlaf-Score (0–100).
function scoreColor(v, tokens) {
    if (v == null) return tokens.colors.text.tertiary;
    if (v >= 70) return tokens.colors.status.success;
    if (v >= 40) return tokens.colors.status.warning;
    return tokens.colors.status.danger;
}

// ACWR-Zonen: <0.8 detrained, 0.8–1.3 optimal, 1.3–1.5 erhöht, >1.5 Risiko.
function acwrColor(v, tokens) {
    if (v == null) return tokens.colors.text.tertiary;
    if (v < 0.8) return tokens.colors.status.info;
    if (v <= 1.3) return tokens.colors.status.success;
    if (v <= 1.5) return tokens.colors.status.warning;
    return tokens.colors.status.danger;
}

function acwrZone(v) {
    if (v == null) return '';
    if (v < 0.8) return 'detrained';
    if (v <= 1.3) return 'optimal';
    if (v <= 1.5) return 'erhöht';
    return 'Risiko';
}
