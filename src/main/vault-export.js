// OLE OS — Obsidian Vault Export
// Schreibt Trainings-, Habit- und Daily-Notes als Markdown in einen
// konfigurierten Obsidian-Vault. Settings persistieren in userData/vault-settings.json.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// ── Settings ─────────────────────────────────────────────────────────────

function settingsPath() {
    return path.join(app.getPath('userData'), 'vault-settings.json');
}

function defaults() {
    return { path: '', autoExport: false, lastExport: null };
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
};

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function ensureVault(vaultPath) {
    if (!vaultPath) throw new Error('vault_path_not_set');
    if (!fs.existsSync(vaultPath)) throw new Error('vault_path_missing');
    for (const sub of Object.values(FOLDERS)) {
        const dir = path.join(vaultPath, sub);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

function writeFile(vaultPath, sub, name, body) {
    const file = path.join(vaultPath, sub, name);
    fs.writeFileSync(file, body);
    return file;
}

function yamlString(value) {
    // Minimaler YAML-String-Escape (Quotes nur wenn nötig)
    if (value == null) return '';
    const s = String(value);
    if (/^[A-Za-z0-9_\-./: ]+$/.test(s) && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return `"${s.replace(/"/g, '\\"')}"`;
}

function metersToKm(m) { return m == null ? null : Math.round((m / 1000) * 100) / 100; }
function secToMin(s) { return s == null ? null : Math.round(s / 60); }

// ── Habit Export ─────────────────────────────────────────────────────────

function exportHabits(vaultPath, date, deps) {
    const state = deps.getHabits();          // { habits, checkins }
    const streaks = deps.getStreaks?.() || {}; // { habitId: streak }
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
        lines.push('| Status | Habit | Streak |');
        lines.push('|--------|-------|--------|');
        for (const h of active) {
            const tick = doneIds.has(h.id) ? '✅' : '⬜';
            const name = `${h.emoji || ''} ${h.name}`.trim();
            const streak = streaks[h.id] ?? 0;
            lines.push(`| ${tick} | ${name} | ${streak} |`);
        }
    }
    lines.push('');
    lines.push(`[[${FOLDERS.daily}/${date}|← Daily]]`);
    lines.push('');

    return writeFile(vaultPath, FOLDERS.habits, `${date}.md`, lines.join('\n'));
}

// ── Training Export ──────────────────────────────────────────────────────

function exportTraining(vaultPath, date, deps) {
    const plan = deps.getPlan?.();
    const planDay = plan?.days?.find((d) => d.date === date) || null;
    const cache = deps.getActivities?.() || { activities: [] };
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
    } else if (!planDay) {
        lines.push('_Kein Plan und keine Aktivität für diesen Tag._');
        lines.push('');
    }

    lines.push(`[[${FOLDERS.daily}/${date}|← Daily]]`);
    lines.push('');

    return writeFile(vaultPath, FOLDERS.training, `${date}.md`, lines.join('\n'));
}

// ── Daily Index Export ───────────────────────────────────────────────────

function exportDaily(vaultPath, date) {
    const lines = [];
    lines.push('---');
    lines.push('source: ole_os');
    lines.push('type: daily');
    lines.push(`date: ${date}`);
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
    lines.push('## Notizen');
    lines.push('-');
    lines.push('');
    return writeFile(vaultPath, FOLDERS.daily, `${date}.md`, lines.join('\n'));
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
    saveSettings({ lastExport: new Date().toISOString() });
    return { ok: true, date: d, files };
}

module.exports = {
    loadSettings,
    saveSettings,
    exportDay,
    exportHabits,
    exportTraining,
    exportDaily,
};
