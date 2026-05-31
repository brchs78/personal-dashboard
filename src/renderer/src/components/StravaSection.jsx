// OLE OS — Strava-Sektion (im Health-Tab eingebettet)
// Connect-Button + Activity-Liste der letzten 20 Runs.

import { Link2, RefreshCw, Unlink, ExternalLink } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import tokens from '../styles/tokens';

export default function StravaSection() {
    const { status, activities, lastSync, busy, error, connect, disconnect, sync } = useStrava();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
            <Header
                connected={status.connected}
                athlete={status.athlete}
                lastSync={lastSync}
                busy={busy}
                onConnect={connect}
                onDisconnect={disconnect}
                onSync={sync}
            />
            {error && <ErrorCard message={error} />}
            {status.connected && activities.length > 0 && <ActivityList items={activities} />}
            {status.connected && activities.length === 0 && !busy && <EmptyCard onSync={sync} />}
            {!status.connected && <NotConnectedCard onConnect={connect} busy={busy} />}
        </div>
    );
}

function Header({ connected, athlete, lastSync, busy, onConnect, onDisconnect, onSync }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.lg, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h3 style={{
                    margin: 0,
                    fontFamily: tokens.typography.fontFamily.display,
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.text.primary,
                    letterSpacing: tokens.typography.letterSpacing.tight,
                }}>Strava</h3>
                <p style={{
                    margin: 0,
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.text.tertiary,
                    textTransform: 'uppercase',
                    letterSpacing: tokens.typography.letterSpacing.wide,
                }}>
                    {connected
                        ? (athlete ? `Verbunden als ${athlete.firstname}` : 'Verbunden')
                        : 'Nicht verbunden'}
                    {connected && lastSync && ` · Sync ${fmtSync(lastSync)}`}
                </p>
            </div>
            {connected && (
                <div style={{ display: 'flex', gap: 8 }}>
                    <IconButton onClick={onSync} disabled={busy} title="Sync">
                        <RefreshCw size={12} strokeWidth={2.5} />
                        Sync
                    </IconButton>
                    <IconButton onClick={onDisconnect} disabled={busy} title="Trennen">
                        <Unlink size={12} strokeWidth={2.5} />
                        Trennen
                    </IconButton>
                </div>
            )}
        </div>
    );
}

function NotConnectedCard({ onConnect, busy }) {
    return (
        <div style={{
            ...tokens.glass.card,
            padding: tokens.spacing.lg,
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing.md,
            alignItems: 'flex-start',
        }}>
            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary, lineHeight: 1.5 }}>
                Verbinde dein Strava-Konto, um Aktivitäten, Splits und Gear-Tracking direkt
                in OLE OS zu sehen.
            </p>
            <button
                type="button"
                onClick={onConnect}
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
                <Link2 size={14} strokeWidth={2.5} />
                {busy ? 'Öffne Browser…' : 'Mit Strava verbinden'}
            </button>
        </div>
    );
}

function EmptyCard({ onSync }) {
    return (
        <div style={{ ...tokens.glass.card, padding: tokens.spacing.lg }}>
            <p style={{ margin: 0, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.secondary }}>
                Noch keine Aktivitäten geladen. <span style={{ color: tokens.colors.accent.DEFAULT, cursor: 'pointer' }} onClick={onSync}>Jetzt syncen →</span>
            </p>
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

function ActivityList({ items }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            {items.slice(0, 20).map((a) => <ActivityRow key={a.id} a={a} />)}
        </div>
    );
}

function ActivityRow({ a }) {
    const km = (a.distance / 1000);
    const pace = paceFromMps(a.average_speed);
    const date = new Date(a.start_date_local);
    return (
        <a
            href={`https://www.strava.com/activities/${a.id}`}
            target="_blank"
            rel="noreferrer"
            style={{
                ...tokens.glass.card,
                padding: tokens.spacing.md,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: tokens.spacing.sm,
                textDecoration: 'none',
                color: 'inherit',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.text.primary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    <ExternalLink size={11} strokeWidth={2} color={tokens.colors.text.tertiary} />
                </div>
                <div style={{
                    fontSize: 11,
                    color: tokens.colors.text.tertiary,
                    letterSpacing: tokens.typography.letterSpacing.wide,
                    textTransform: 'uppercase',
                }}>
                    {fmtDate(date)} · {a.type}{a.gear_id ? ' · 👟' : ''}
                </div>
            </div>
            <div style={{ display: 'flex', gap: tokens.spacing.md, alignItems: 'center' }}>
                <Stat label="km"  value={km.toFixed(2)} />
                <Stat label="Pace" value={pace} />
                <Stat label="Avg HR" value={a.average_heartrate ? Math.round(a.average_heartrate) : '—'} />
            </div>
        </a>
    );
}

function Stat({ label, value }) {
    return (
        <div style={{ textAlign: 'right' }}>
            <div style={{
                fontFamily: tokens.typography.fontFamily.display,
                fontSize: tokens.typography.fontSize.md,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.accent.DEFAULT,
                lineHeight: 1,
            }}>{value}</div>
            <div style={{ fontSize: 9, color: tokens.colors.text.tertiary, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide, marginTop: 2 }}>
                {label}
            </div>
        </div>
    );
}

function IconButton({ children, onClick, disabled, title }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} title={title}
            style={{
                ...tokens.glass.button,
                padding: '8px 12px',
                fontSize: tokens.typography.fontSize.xs,
                fontWeight: tokens.typography.fontWeight.semibold,
                letterSpacing: tokens.typography.letterSpacing.wide,
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
            }}>
            {children}
        </button>
    );
}

function paceFromMps(mps) {
    if (!mps || mps <= 0) return '—';
    const secPerKm = 1000 / mps;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm - m * 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(d) {
    const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    return `${d.getDate()}. ${months[d.getMonth()]}`;
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
