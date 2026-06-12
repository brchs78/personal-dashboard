// OLE OS — Obsidian Vault Export
// Schreibt Trainings-, Habit-, Daily- und Coach-Notes als Markdown in einen
// konfigurierten Obsidian-Vault. Settings persistieren in userData/vault-settings.json.
// Auto-Section-Marker bewahren User-Edits außerhalb des generierten Blocks.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { todayISO } = require('./utils/date.js');

// ── Settings ─────────────────────────────────────────────────────────────

function settingsPath() {
    return path.join(app.getPath('userData'), 'vault-settings.json');
}

function defaults() {
    return { path: '', autoExport: false, exportCoach: false, lastExport: null };
}

function loadSettings() {
    try {
        const p = settingsPath();
        if (!fs.existsSync(p)) return defaults();
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return { ...defaults(), ...data };
    } catch (e) {
        console.warn('[vault-export] settings load failed:', e?.message);
        return defaults();
    }
}

function saveSettings(patch) {
    const next = { ...loadSettings(), ...patch };
    fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
    return next;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const FOLDERS = {
    daily: '20_Daily',
    training: '30_Training',
    habits: '40_Habits',
    coach: '_ai/coach-sessions',
};

const BEGIN_MARKER = '<!-- BEGIN auto -->';
const END_MARKER = '<!-- END auto -->';

function ensureVault(vaultPath) {
    if (!vaultPath) throw new Error('vault_path_not_set');
    if (!fs.existsSync(vaultPath)) throw new Error('vault_path_missing');
    for (const sub of Object.values(FOLDERS)) {
        const dir = path.join(vaultPath, sub);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

// Merge: erhält User-Bereich nach END_MARKER, ersetzt nur Auto-Block dazwischen.
// Erstschreibung (kein Marker im Bestand) überschreibt komplett.
function mergePreservingUser(existing, newAutoContent) {
    const wrapped = `${BEGIN_MARKER}\n${newAutoContent}\n${END_MARKER}`;
    if (!existing) return wrapped + '\n';
    const endIdx = existing.indexOf(END_MARKER);
    if (endIdx < 0) return wrapped + '\n';
    const userTail = existing.slice(endIdx + END_MARKER.length);
    return wrapped + userTail;
}

function writeManaged(vaultPath, sub, name, autoContent) {
    const file = path.join(vaultPath, sub, name);
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    fs.writeFileSync(file, mergePreservingUser(existing, autoContent));
    return file;
}

function writeFull(vaultPath, sub, name, content) {
    const file = path.join(vaultPath, sub, name);
    fs.writeFileSync(file, content);
    return file;
}

function yamlString(value) {
    if (value == null) return '';
    const s = String(value);
    if (/^[A-Za-z0-9_\-./: ]+$/.test(s) && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return `"${s.replace(/"/g, '\\"')}"`;
}

function metersToKm(m) { return m == null ? null : Math.round((m / 1000) * 100) / 100; }
function secToMin(s) { return s == null ? null : Math.round(s / 60); }

function slugify(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'habit';
}

// ── Habit Export ─────────────────────────────────────────────────────────

function exportHabits(vaultPath, date, deps) {
    const state = deps.getHabits();
    const streaks = deps.getStreaks?.() || {};
    const active = state.habits.filter((h) => !h.archived);
    const doneIds = new Set(state.checkins[date] || []);
    const total = active.length;
    const completed = active.filter((h) => doneIds.has(h.id)).length;
    const rate = total ? Math.round((completed / total) * 100) : 0;

    const lines = [];
    lines.push('---');
    lines.push('source: ole_os');
    lines.push('type: habit-log');
    lines.push(`date: ${date}`);
    lines.push(`completed: ${completed}`);
    lines.push(`total: ${total}`);
    lines.push(`rate: ${rate}`);
    if (active.length) {
        lines.push('streaks:');
        for (const h of active) {
            const slug = slugify(h.name);
            const streak = streaks[h.id] ?? 0;
            lines.push(`  ${slug}: ${streak}`);
        }
    }
    lines.push('tags: [area/habits, source/ole_os]');
    lines.push(`updated: ${yamlString(new Date().toISOString())}`);
    lines.push('---');
    lines.push('');
    lines.push(`# Habits · ${date}`);
    lines.push('');
    lines.push(`**${completed}/${total}** erledigt · Rate ${rate}%`);
    lines.push('');
    if (active.length === 0) {
        lines.push('_Keine aktiven Habits._');
    } else {
        lines.push('| Status | Habit | Identität | Streak |');
        lines.push('|--------|-------|-----------|--------|');
        for (const h of active) {
            const tick = doneIds.has(h.id) ? '✅' : '⬜';
            const name = `${h.emoji || ''} ${h.name}`.trim();
            const identity = h.identity ? `*${h.identity}*` : '—';
            const streak = streaks[h.id] ?? 0;
            lines.push(`| ${tick} | ${name} | ${identity} | ${streak} |`);
        }
    }
    lines.push('');
    lines.push(`[[${FOLDERS.daily}/${date}|← Daily]] · [[${FOLDERS.habits}/_index|↑ Index]]`);

    return writeManaged(vaultPath, FOLDERS.habits, `${date}.md`, lines.join('\n'));
}

// ── Training Export ──────────────────────────────────────────────────────

function exportTraining(vaultPath, date, deps) {
    const plan = deps.getPlan?.();
    const planDay = plan?.days?.find((d) => d.date === date) || null;
    const cache = deps.getActivities?.() || { activities: [] };
    const lastSync = cache?.lastSync || null;
    const activities = (cache.activities || []).filter((a) => {
        const d = (a.start_date_local || a.start_date || '').slice(0, 10);
        return d === date;
    });

    const lines = [];
    lines.push('---');
    lines.push('source: ole_os');
    lines.push('type: workout');
    lines.push(`date: ${date}`);
    if (activities[0]) {
        const a = activities[0];
        lines.push(`sport: ${yamlString((a.sport_type || a.type || 'unknown').toLowerCase())}`);
        const km = metersToKm(a.distance);
        const min = secToMin(a.moving_time);
        if (km != null) lines.push(`distance_km: ${km}`);
        if (min != null) lines.push(`duration_min: ${min}`);
        if (a.average_heartrate) lines.push(`avg_hr: ${Math.round(a.average_heartrate)}`);
    } else if (planDay) {
        lines.push(`sport: ${yamlString((planDay.type || 'rest').toLowerCase())}`);
        if (planDay.distanceKm) lines.push(`distance_km: ${planDay.distanceKm}`);
        if (planDay.durationMin) lines.push(`duration_min: ${planDay.durationMin}`);
    }
    lines.push('tags: [area/marathon, source/ole_os]');
    if (lastSync) lines.push(`strava_last_sync: ${yamlString(lastSync)}`);
    lines.push(`updated: ${yamlString(new Date().toISOString())}`);
    lines.push('---');
    lines.push('');
    lines.push(`# Training · ${date}`);
    lines.push('');

    if (planDay) {
        lines.push('## Plan');
        lines.push(`- **${planDay.title || planDay.type || '—'}**`);
        if (planDay.distanceKm) lines.push(`- Distanz: ${planDay.distanceKm} km`);
        if (planDay.durationMin) lines.push(`- Dauer: ${planDay.durationMin} min`);
        if (planDay.paceTarget) lines.push(`- Pace-Ziel: ${planDay.paceTarget}`);
        if (planDay.hrZone) lines.push(`- HR-Zone: ${planDay.hrZone}`);
        if (planDay.notes) lines.push(`- Notiz: ${planDay.notes}`);
        lines.push('');
    }

    if (activities.length) {
        lines.push('## Ist (Strava)');
        for (const a of activities) {
            const km = metersToKm(a.distance);
            const min = secToMin(a.moving_time);
            const hr = a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '—';
            lines.push(`- **${a.name || a.sport_type || 'Aktivität'}** · ${km ?? '?'} km · ${min ?? '?'} min · Ø HR ${hr}`);
        }
        lines.push('');
    } else if (planDay) {
        lines.push('## Ist (Strava)');
        const hint = lastSync ? `_Keine Aktivität am ${date} im Cache (letzter Sync: ${new Date(lastSync).toLocaleString('de-DE')})._` : '_Kein Strava-Sync — bitte in OLE OS „Sync" auslösen._';
        lines.push(hint);
        lines.push('');
    } else {
        lines.push('_Kein Plan und keine Aktivität für diesen Tag._');
        lines.push('');
    }

    lines.push(`[[${FOLDERS.daily}/${date}|← Daily]] · [[${FOLDERS.training}/_index|↑ Index]] · [[50_Projects/marathon-2026/README|Marathon-Hub]]`);

    return writeManaged(vaultPath, FOLDERS.training, `${date}.md`, lines.join('\n'));
}

// ── Daily Index Export ───────────────────────────────────────────────────

function exportDaily(vaultPath, date) {
    const lines = [];
    lines.push('---');
    lines.push('source: ole_os');
    lines.push('type: daily');
    lines.push(`date: ${date}`);
    lines.push('tags: [type/daily, source/ole_os]');
    lines.push(`updated: ${yamlString(new Date().toISOString())}`);
    lines.push('---');
    lines.push('');
    lines.push(`# ${date}`);
    lines.push('');
    lines.push('## Training');
    lines.push(`![[${FOLDERS.training}/${date}]]`);
    lines.push('');
    lines.push('## Habits');
    lines.push(`![[${FOLDERS.habits}/${date}]]`);
    lines.push('');
    return writeManaged(vaultPath, FOLDERS.daily, `${date}.md`, lines.join('\n'));
}

// ── Coach Session Export ─────────────────────────────────────────────────

function messageToText(msg) {
    if (typeof msg.content === 'string') return msg.content.trim();
    if (Array.isArray(msg.content)) {
        return msg.content
            .map((c) => (typeof c === 'string' ? c : c?.text || ''))
            .filter(Boolean)
            .join('\n')
            .trim();
    }
    return '';
}

function exportCoachSessions(vaultPath, date, deps) {
    if (!deps.getCoachHistory) return null;
    const history = deps.getCoachHistory() || [];
    const dayMessages = history.filter((m) => {
        const ts = m.timestamp || m.created_at || m.ts;
        if (!ts) return false;
        const d = new Date(ts).toISOString().slice(0, 10);
        return d === date;
    });
    if (!dayMessages.length) return null;

    const lines = [];
    lines.push('---');
    lines.push('source: ole_os');
    lines.push('type: coach-session');
    lines.push(`date: ${date}`);
    lines.push(`message_count: ${dayMessages.length}`);
    lines.push('tags: [area/coach, source/ole_os]');
    lines.push(`updated: ${yamlString(new Date().toISOString())}`);
    lines.push('---');
    lines.push('');
    lines.push(`# Coach-Session · ${date}`);
    lines.push('');
    for (const m of dayMessages) {
        const role = m.role === 'assistant' ? '🤖 Coach' : m.role === 'user' ? '👤 Ole' : `_${m.role}_`;
        const text = messageToText(m);
        if (!text) continue;
        lines.push(`### ${role}`);
        lines.push(text);
        lines.push('');
    }
    lines.push(`[[${FOLDERS.daily}/${date}|← Daily]]`);
    return writeFull(vaultPath, FOLDERS.coach, `${date}.md`, lines.join('\n'));
}

// ── Orchestrator ─────────────────────────────────────────────────────────

function exportDay(date, deps) {
    const settings = loadSettings();
    ensureVault(settings.path);
    const d = date || todayISO();
    const files = {
        habits: exportHabits(settings.path, d, deps),
        training: exportTraining(settings.path, d, deps),
        daily: exportDaily(settings.path, d),
    };
    if (settings.exportCoach) {
        const coach = exportCoachSessions(settings.path, d, deps);
        if (coach) files.coach = coach;
    }
    saveSettings({ lastExport: new Date().toISOString() });
    return { ok: true, date: d, files };
}

function exportRange(fromDate, toDate, deps) {
    const settings = loadSettings();
    ensureVault(settings.path);
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('invalid_range');
    }
    const results = [];
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
        const d = cur.toISOString().slice(0, 10);
        try {
            results.push(exportDay(d, deps));
        } catch (e) {
            results.push({ ok: false, date: d, error: e?.message });
        }
    }
    return { ok: true, count: results.length, results };
}

module.exports = {
    loadSettings,
    saveSettings,
    exportDay,
    exportRange,
    exportHabits,
    exportTraining,
    exportDaily,
    exportCoachSessions,
};
