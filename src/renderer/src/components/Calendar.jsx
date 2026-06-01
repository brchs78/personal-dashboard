// OLE OS — Calendar (Wochenübersicht)
// Mo–So horizontal, Zeitspalte 06–24h. Externe iCal-Subscriptions read-only;
// interne Events vom Coach/User bearbeitbar.

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft, ChevronRight, Settings as SettingsIcon, Plus, X,
    Trash2, RefreshCw, ExternalLink, AlertTriangle,
} from "lucide-react";
import tokens from "../styles/tokens";
import { useCalendar } from "../hooks/useCalendar";

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const HOUR_START = 6;
const HOUR_END = 24;
const HOUR_HEIGHT = 48; // px pro Stunde
const TIME_COL_WIDTH = 48;

function startOfWeek(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
    dt.setHours(0, 0, 0, 0);
    return dt;
}

function addDays(d, n) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
}

function isoWeek(d) {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
}

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDate(d) {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

function fmtTime(d) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Hash → Hue für Subscription-Farben
function hueFor(str) {
    let h = 0;
    for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % 360;
}

function subColor(ev) {
    if (ev.source === "internal") {
        return { fill: "rgba(192,38,211,0.18)", border: "#c026d3", accent: "#c026d3" };
    }
    const hue = hueFor(ev.caldav?.calendarUrl || ev.sourceUrl || ev.sourceId || ev.sourceLabel || "");
    return {
        fill: `hsla(${hue}, 70%, 55%, 0.18)`,
        border: `hsl(${hue}, 70%, 60%)`,
        accent: `hsl(${hue}, 70%, 70%)`,
    };
}

function toLocalInputValue(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Calendar() {
    const cal = useCalendar();
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [showSubs, setShowSubs] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [hover, setHover] = useState(null); // event-id
    const [editing, setEditing] = useState(null); // event or null

    const days = useMemo(
        () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
        [weekStart]
    );

    const weekEvents = useMemo(() => {
        const wkEnd = addDays(weekStart, 7);
        const wkStartMs = weekStart.getTime();
        const wkEndMs = wkEnd.getTime();
        return cal.events.filter((ev) => {
            const s = new Date(ev.start).getTime();
            const e = new Date(ev.end).getTime();
            return e >= wkStartMs && s <= wkEndMs;
        });
    }, [cal.events, weekStart]);

    const eventsByDay = useMemo(() => {
        const map = Array.from({ length: 7 }, () => []);
        weekEvents.forEach((ev) => {
            const s = new Date(ev.start);
            for (let i = 0; i < 7; i++) {
                if (sameDay(days[i], s)) {
                    map[i].push(ev);
                    break;
                }
            }
        });
        return map;
    }, [weekEvents, days]);

    const kw = isoWeek(weekStart);

    return (
        <div style={{ position: "relative", paddingBottom: 80 }}>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 16, gap: 12,
            }}>
                <div>
                    <div style={{
                        fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em",
                        color: tokens.colors.text.tertiary, marginBottom: 2,
                    }}>
                        Kalender · KW {kw}
                    </div>
                    <div style={{
                        fontSize: tokens.typography.fontSize.xl,
                        fontWeight: tokens.typography.fontWeight.bold,
                        color: tokens.colors.text.primary,
                        letterSpacing: tokens.typography.letterSpacing.tight,
                    }}>
                        {fmtDate(days[0])} – {fmtDate(days[6])}{days[6].getFullYear()}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <IconBtn onClick={() => setWeekStart(addDays(weekStart, -7))} title="Vorherige Woche">
                        <ChevronLeft size={16} />
                    </IconBtn>
                    <button
                        onClick={() => setWeekStart(startOfWeek(new Date()))}
                        style={{
                            fontSize: 12, padding: "6px 12px", borderRadius: tokens.radius.md,
                            background: tokens.colors.surface.glass, border: `1px solid ${tokens.colors.border.glass}`,
                            color: tokens.colors.text.secondary, cursor: "pointer",
                        }}
                    >
                        Heute
                    </button>
                    <IconBtn onClick={() => setWeekStart(addDays(weekStart, 7))} title="Nächste Woche">
                        <ChevronRight size={16} />
                    </IconBtn>
                    <IconBtn onClick={() => setShowSubs(true)} title="iCal-Abos">
                        <SettingsIcon size={16} />
                    </IconBtn>
                </div>
            </div>

            {/* Grid */}
            <div style={{
                ...tokens.glass.card,
                padding: 0,
                overflow: "hidden",
            }}>
                {/* Day Header */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, 1fr)`,
                    borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                    background: tokens.colors.surface.glass,
                }}>
                    <div />
                    {days.map((d, i) => {
                        const today = sameDay(d, new Date());
                        return (
                            <div key={i} style={{
                                padding: "10px 6px", textAlign: "center",
                                borderLeft: `1px solid ${tokens.colors.border.subtle}`,
                            }}>
                                <div style={{
                                    fontSize: 10, textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    color: today ? tokens.colors.accent.DEFAULT : tokens.colors.text.tertiary,
                                    fontWeight: 600,
                                }}>
                                    {DAY_LABELS[i]}
                                </div>
                                <div style={{
                                    fontSize: 15,
                                    fontWeight: today ? 700 : 500,
                                    color: today ? tokens.colors.accent.DEFAULT : tokens.colors.text.primary,
                                    marginTop: 2,
                                }}>
                                    {d.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Time grid */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, 1fr)`,
                    position: "relative",
                }}>
                    {/* Time labels column */}
                    <div style={{ position: "relative" }}>
                        {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => i + HOUR_START).map((h) => (
                            <div key={h} style={{
                                height: HOUR_HEIGHT,
                                fontSize: 10,
                                color: tokens.colors.text.tertiary,
                                padding: "2px 6px 0 0",
                                textAlign: "right",
                                borderTop: `1px solid ${tokens.colors.border.subtle}`,
                            }}>
                                {String(h).padStart(2, "0")}:00
                            </div>
                        ))}
                    </div>

                    {/* Day columns */}
                    {days.map((d, dayIdx) => (
                        <div key={dayIdx} style={{
                            position: "relative",
                            borderLeft: `1px solid ${tokens.colors.border.subtle}`,
                        }}>
                            {/* Hour gridlines */}
                            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                                <div key={i} style={{
                                    height: HOUR_HEIGHT,
                                    borderTop: `1px solid ${tokens.colors.border.subtle}`,
                                }} />
                            ))}

                            {/* Events */}
                            {eventsByDay[dayIdx].map((ev) => (
                                <EventBlock
                                    key={ev.id}
                                    ev={ev}
                                    hover={hover === ev.id}
                                    onMouseEnter={() => setHover(ev.id)}
                                    onMouseLeave={() => setHover(null)}
                                    onEdit={() => setEditing(ev)}
                                    onDelete={(event) => cal.deleteEvent(event.source === "caldav" ? event : event.id)}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Add button */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                <button
                    onClick={() => setShowAdd(true)}
                    style={{
                        ...tokens.glass.buttonAccent,
                        padding: "10px 18px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                    }}
                >
                    <Plus size={16} /> Termin
                </button>
            </div>

            {/* Subscription Drawer */}
            <AnimatePresence>
                {showSubs && (
                    <SubsDrawer
                        cal={cal}
                        onClose={() => setShowSubs(false)}
                    />
                )}
            </AnimatePresence>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {(showAdd || editing) && (
                    <EventModal
                        existing={editing}
                        onClose={() => { setShowAdd(false); setEditing(null); }}
                        onSave={async (data) => {
                            if (editing) await cal.updateEvent(editing.id, data, editing);
                            else await cal.addEvent(data);
                            setShowAdd(false);
                            setEditing(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Event Block ───────────────────────────────────────────────────
function EventBlock({ ev, hover, onMouseEnter, onMouseLeave, onEdit, onDelete }) {
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const startOffset = Math.max(0, startMin - HOUR_START * 60);
    const top = (startOffset / 60) * HOUR_HEIGHT;
    const durationMin = Math.max(20, endMin - startMin);
    const height = (durationMin / 60) * HOUR_HEIGHT;
    const colors = subColor(ev);
    const isWritable = !!ev.writable;

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                position: "absolute",
                top, height,
                left: 2, right: 2,
                background: colors.fill,
                borderLeft: `3px solid ${colors.border}`,
                borderRadius: 6,
                padding: "3px 6px",
                fontSize: 11,
                color: tokens.colors.text.primary,
                overflow: "hidden",
                cursor: isWritable ? "pointer" : "default",
                zIndex: hover ? 50 : 1,
                boxShadow: hover ? tokens.shadow.elevated : "none",
            }}
            onClick={() => { if (isWritable) onEdit(); }}
            title={`${ev.title}\n${fmtTime(start)}–${fmtTime(end)}${ev.location ? `\n${ev.location}` : ""}`}
        >
            <div style={{
                fontWeight: 600,
                lineHeight: 1.2,
                color: tokens.colors.text.primary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
            }}>
                {ev.title || "—"}
            </div>
            <div style={{
                fontSize: 10,
                color: tokens.colors.text.secondary,
                marginTop: 1,
            }}>
                {fmtTime(start)}
            </div>

            {hover && isWritable && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(ev); }}
                    style={{
                        position: "absolute",
                        top: 2, right: 2,
                        width: 18, height: 18,
                        borderRadius: 4,
                        border: "none",
                        background: "rgba(248,113,113,0.18)",
                        color: "#f87171",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    title="Löschen"
                >
                    <Trash2 size={11} />
                </button>
            )}
        </motion.div>
    );
}

// ── Icon Button ───────────────────────────────────────────────────
function IconBtn({ children, onClick, title }) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                width: 32, height: 32,
                borderRadius: tokens.radius.md,
                background: tokens.colors.surface.glass,
                border: `1px solid ${tokens.colors.border.glass}`,
                color: tokens.colors.text.secondary,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {children}
        </button>
    );
}

// ── Subscription Drawer ───────────────────────────────────────────
function SubsDrawer({ cal, onClose }) {
    const [label, setLabel] = useState("");
    const [url, setUrl] = useState("");
    const [adding, setAdding] = useState(false);
    const [localErr, setLocalErr] = useState(null);

    async function handleAdd() {
        if (!url.trim()) return;
        setAdding(true);
        setLocalErr(null);
        try {
            await cal.addSub({ label: label.trim(), url: url.trim() });
            setLabel("");
            setUrl("");
        } catch (e) {
            setLocalErr(String(e?.message || e));
        } finally {
            setAdding(false);
        }
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
                    backdropFilter: "blur(4px)", zIndex: 900,
                }}
            />
            <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={tokens.motion.spring.base}
                style={{
                    position: "fixed",
                    top: 0, right: 0, bottom: 0,
                    width: 380, maxWidth: "92vw",
                    background: tokens.colors.bg.elevated,
                    backdropFilter: "blur(28px) saturate(160%)",
                    borderLeft: `1px solid ${tokens.colors.border.strong}`,
                    boxShadow: tokens.shadow.modal,
                    zIndex: 901,
                    padding: 20,
                    overflowY: "auto",
                }}
            >
                <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 16,
                }}>
                    <div style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: 700,
                        color: tokens.colors.text.primary,
                    }}>
                        iCal-Abos
                    </div>
                    <button onClick={onClose} style={{
                        background: "none", border: "none", color: tokens.colors.text.secondary,
                        cursor: "pointer", padding: 4,
                    }}>
                        <X size={18} />
                    </button>
                </div>

                {/* iCloud CalDAV (Two-Way) */}
                <CalDAVSection cal={cal} />

                {/* Bestehende Subs */}
                {cal.subscriptions.length === 0 ? (
                    <div style={{
                        fontSize: 12, color: tokens.colors.text.tertiary,
                        padding: "12px 0", textAlign: "center",
                    }}>
                        Noch keine Kalender verbunden.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                        {cal.subscriptions.map((s) => (
                            <SubRow key={s.id} sub={s} onRemove={() => cal.removeSub(s.id)} />
                        ))}
                    </div>
                )}

                <button
                    onClick={cal.refresh}
                    disabled={cal.busy || cal.subscriptions.length === 0}
                    style={{
                        width: "100%", padding: "8px 12px",
                        borderRadius: tokens.radius.md,
                        background: tokens.colors.surface.glass,
                        border: `1px solid ${tokens.colors.border.glass}`,
                        color: tokens.colors.text.secondary,
                        cursor: cal.busy ? "wait" : "pointer",
                        fontSize: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        marginBottom: 24,
                    }}
                >
                    <RefreshCw size={13} /> Alle aktualisieren
                </button>

                {/* Neuer Eintrag */}
                <div style={{
                    fontSize: 11, textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: tokens.colors.text.tertiary,
                    marginBottom: 8,
                }}>
                    Neuer Kalender
                </div>
                <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Label (z.B. Uni)"
                    style={inputStyle()}
                />
                <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https:// oder webcal://"
                    style={{ ...inputStyle(), marginTop: 8 }}
                />
                {localErr && (
                    <div style={{
                        fontSize: 11, color: "#f87171",
                        marginTop: 6, padding: 6,
                        background: "rgba(248,113,113,0.1)",
                        borderRadius: 6,
                    }}>
                        {localErr}
                    </div>
                )}
                <button
                    onClick={handleAdd}
                    disabled={adding || !url.trim()}
                    style={{
                        ...tokens.glass.buttonAccent,
                        marginTop: 10,
                        width: "100%",
                        padding: "10px 14px",
                        cursor: adding ? "wait" : "pointer",
                        opacity: !url.trim() ? 0.5 : 1,
                        fontSize: 13,
                    }}
                >
                    {adding ? "Lade..." : "Hinzufügen"}
                </button>

                {/* Provider-Hilfe */}
                <div style={{
                    marginTop: 24, padding: 12,
                    background: tokens.colors.surface.glass,
                    border: `1px solid ${tokens.colors.border.subtle}`,
                    borderRadius: tokens.radius.md,
                    fontSize: 11, color: tokens.colors.text.secondary,
                    lineHeight: 1.6,
                }}>
                    <div style={{ fontWeight: 600, color: tokens.colors.text.primary, marginBottom: 6 }}>
                        Wie komme ich an die URL?
                    </div>
                    <div><b>iCloud:</b> icloud.com/calendar → Share-Icon → Öffentlicher Kalender → URL kopieren (webcal://...)</div>
                    <div style={{ marginTop: 4 }}><b>Google:</b> Settings → "Privatadresse im iCal-Format" (nicht die öffentliche!)</div>
                    <div style={{ marginTop: 4 }}><b>Outlook:</b> Settings → Shared calendars → Publish → ICS-Link</div>
                </div>
            </motion.div>
        </>
    );
}

// ── iCloud CalDAV Section ─────────────────────────────────────────
function CalDAVSection({ cal }) {
    const dav = cal.caldav || { connected: false };
    const [appleId, setAppleId] = useState("");
    const [password, setPassword] = useState("");
    const [connecting, setConnecting] = useState(false);
    const [err, setErr] = useState(null);

    async function connect() {
        if (!appleId.trim() || !password.trim()) return;
        setConnecting(true);
        setErr(null);
        try {
            await cal.caldavConnect({ appleId: appleId.trim(), password: password.trim() });
            setPassword("");
        } catch (e) {
            setErr(String(e?.message || e));
        } finally {
            setConnecting(false);
        }
    }

    function toggleVisible(url) {
        const cur = new Set(dav.selectedCalendars || []);
        if (cur.has(url)) cur.delete(url);
        else cur.add(url);
        cal.caldavSetVisible([...cur]);
    }

    return (
        <div style={{
            marginBottom: 24, padding: 12,
            background: tokens.colors.surface.glass,
            border: `1px solid ${tokens.colors.border.glass}`,
            borderRadius: tokens.radius.md,
        }}>
            <div style={{
                fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em",
                color: tokens.colors.text.tertiary, marginBottom: 8,
                display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
                <span>iCloud · Two-Way</span>
                {dav.connected && (
                    <span style={{
                        fontSize: 9, color: "#34d399",
                        textTransform: "none", letterSpacing: 0,
                    }}>
                        ● verbunden
                    </span>
                )}
            </div>

            {!dav.connected ? (
                <>
                    <input
                        value={appleId}
                        onChange={(e) => setAppleId(e.target.value)}
                        placeholder="Apple-ID (E-Mail)"
                        style={inputStyle()}
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="App-spezifisches Passwort"
                        style={{ ...inputStyle(), marginTop: 8 }}
                    />
                    {err && (
                        <div style={{
                            fontSize: 11, color: "#f87171", marginTop: 6, padding: 6,
                            background: "rgba(248,113,113,0.1)", borderRadius: 6,
                        }}>
                            {err}
                        </div>
                    )}
                    <button
                        onClick={connect}
                        disabled={connecting || !appleId.trim() || !password.trim()}
                        style={{
                            ...tokens.glass.buttonAccent,
                            marginTop: 10, width: "100%", padding: "10px 14px",
                            cursor: connecting ? "wait" : "pointer",
                            opacity: !appleId.trim() || !password.trim() ? 0.5 : 1,
                            fontSize: 13,
                        }}
                    >
                        {connecting ? "Verbinde..." : "iCloud verbinden"}
                    </button>
                    <div style={{
                        fontSize: 10, color: tokens.colors.text.tertiary,
                        marginTop: 8, lineHeight: 1.5,
                    }}>
                        App-Passwort erstellen auf <b>appleid.apple.com</b> → Anmeldung & Sicherheit → App-spezifische Passwörter. Wird verschlüsselt im macOS-Schlüsselbund gespeichert.
                    </div>
                </>
            ) : (
                <>
                    <div style={{
                        fontSize: 11, color: tokens.colors.text.secondary, marginBottom: 8,
                    }}>
                        {dav.appleId}
                    </div>

                    {/* Kalender-Checkboxen */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                        {(dav.calendars || []).map((c) => {
                            const visible = (dav.selectedCalendars || []).includes(c.url);
                            const isTarget = dav.targetCalendarUrl === c.url;
                            return (
                                <div key={c.url} style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    fontSize: 12, color: tokens.colors.text.primary,
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={visible}
                                        onChange={() => toggleVisible(c.url)}
                                        style={{ cursor: "pointer" }}
                                    />
                                    <span style={{
                                        flex: 1, whiteSpace: "nowrap", overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}>
                                        {c.displayName}
                                        {c.readOnly && (
                                            <span style={{ color: tokens.colors.text.tertiary, fontSize: 10 }}> · read-only</span>
                                        )}
                                    </span>
                                    {!c.readOnly && (
                                        <button
                                            onClick={() => cal.caldavSetTarget(isTarget ? null : c.url)}
                                            title={isTarget ? "Schreib-Ziel" : "Als Schreib-Ziel setzen"}
                                            style={{
                                                fontSize: 9, padding: "2px 6px",
                                                borderRadius: 4, cursor: "pointer",
                                                border: `1px solid ${isTarget ? "#c026d3" : tokens.colors.border.glass}`,
                                                background: isTarget ? "rgba(192,38,211,0.18)" : "transparent",
                                                color: isTarget ? "#e879f9" : tokens.colors.text.tertiary,
                                            }}
                                        >
                                            {isTarget ? "★ Ziel" : "Ziel"}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {dav.lastError && (
                        <div style={{ fontSize: 10, color: "#fbbf24", marginBottom: 8 }}>
                            {String(dav.lastError).slice(0, 80)}
                        </div>
                    )}

                    <button
                        onClick={() => cal.caldavDisconnect()}
                        style={{
                            width: "100%", padding: "8px 12px", borderRadius: tokens.radius.md,
                            background: "rgba(248,113,113,0.1)",
                            border: "1px solid rgba(248,113,113,0.3)",
                            color: "#f87171", cursor: "pointer", fontSize: 12,
                        }}
                    >
                        iCloud trennen
                    </button>
                </>
            )}
        </div>
    );
}

function SubRow({ sub, onRemove }) {
    const last = sub.lastFetchedAt ? new Date(sub.lastFetchedAt) : null;
    return (
        <div style={{
            padding: 10, borderRadius: tokens.radius.md,
            background: tokens.colors.surface.glass,
            border: `1px solid ${tokens.colors.border.glass}`,
            display: "flex", flexDirection: "column", gap: 4,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: tokens.colors.text.primary,
                    display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                    {sub.lastError && <AlertTriangle size={12} color="#fbbf24" />}
                    {sub.label}
                </div>
                <button
                    onClick={onRemove}
                    style={{
                        background: "none", border: "none",
                        color: tokens.colors.text.tertiary,
                        cursor: "pointer", padding: 2,
                    }}
                    title="Abo entfernen"
                >
                    <Trash2 size={13} />
                </button>
            </div>
            <div style={{
                fontSize: 10, color: tokens.colors.text.tertiary,
                display: "inline-flex", alignItems: "center", gap: 4,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
                <ExternalLink size={10} />
                {sub.url.replace(/^https?:\/\//, "").slice(0, 40)}
                {sub.url.length > 40 ? "…" : ""}
            </div>
            <div style={{ fontSize: 10, color: tokens.colors.text.tertiary }}>
                {last ? `Sync: ${last.toLocaleTimeString().slice(0, 5)} Uhr` : "Noch nicht synchronisiert"}
            </div>
            {sub.lastError && (
                <div style={{
                    fontSize: 10, color: "#fbbf24", marginTop: 2,
                }}>
                    {sub.lastError.slice(0, 80)}
                </div>
            )}
        </div>
    );
}

// ── Event Modal ───────────────────────────────────────────────────
function EventModal({ existing, onClose, onSave }) {
    const init = existing || {
        title: "",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        allDay: false,
        location: "",
        description: "",
    };
    const [title, setTitle] = useState(init.title);
    const [start, setStart] = useState(toLocalInputValue(init.start));
    const [end, setEnd] = useState(toLocalInputValue(init.end));
    const [location, setLocation] = useState(init.location);
    const [description, setDescription] = useState(init.description);

    async function save() {
        if (!title.trim()) return;
        await onSave({
            title: title.trim(),
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            location,
            description,
            allDay: false,
        });
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: "fixed", inset: 0,
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
                    zIndex: 950,
                }}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={tokens.motion.spring.snappy}
                style={{
                    position: "fixed",
                    top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 380, maxWidth: "92vw",
                    ...tokens.glass.modal,
                    padding: 20,
                    zIndex: 951,
                }}
            >
                <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: 16,
                }}>
                    <div style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: 700, color: tokens.colors.text.primary,
                    }}>
                        {existing ? "Termin bearbeiten" : "Neuer Termin"}
                    </div>
                    <button onClick={onClose} style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: tokens.colors.text.secondary, padding: 4,
                    }}>
                        <X size={18} />
                    </button>
                </div>

                <label style={labelStyle()}>Titel</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="z.B. Laufrunde mit Tom"
                    style={inputStyle()} autoFocus />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                    <div>
                        <label style={labelStyle()}>Start</label>
                        <input type="datetime-local" value={start}
                            onChange={(e) => setStart(e.target.value)}
                            style={inputStyle()} />
                    </div>
                    <div>
                        <label style={labelStyle()}>Ende</label>
                        <input type="datetime-local" value={end}
                            onChange={(e) => setEnd(e.target.value)}
                            style={inputStyle()} />
                    </div>
                </div>

                <label style={{ ...labelStyle(), marginTop: 10 }}>Ort</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)}
                    placeholder="optional" style={inputStyle()} />

                <label style={{ ...labelStyle(), marginTop: 10 }}>Notiz</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="optional" rows={2}
                    style={{ ...inputStyle(), resize: "vertical" }} />

                <button
                    onClick={save}
                    disabled={!title.trim()}
                    style={{
                        ...tokens.glass.buttonAccent,
                        marginTop: 16, width: "100%",
                        padding: "10px 14px",
                        cursor: !title.trim() ? "not-allowed" : "pointer",
                        opacity: !title.trim() ? 0.5 : 1,
                    }}
                >
                    {existing ? "Speichern" : "Anlegen"}
                </button>
            </motion.div>
        </>
    );
}

// ── Helpers ───────────────────────────────────────────────────────
function inputStyle() {
    return {
        ...tokens.glass.input,
        width: "100%",
        padding: "8px 10px",
        fontSize: 13,
        outline: "none",
        boxSizing: "border-box",
        fontFamily: "inherit",
    };
}

function labelStyle() {
    return {
        display: "block",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: tokens.colors.text.tertiary,
        marginBottom: 4,
        fontWeight: 600,
    };
}
