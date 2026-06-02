# Health Data System — Current & Planned

## Current Implementation (Export-based)

### Problem
- User manually exports Health data from iPhone once per day: File → Export → Apple Health data (XML)
- Only pulls **historical data** (everything in Health app), not incremental
- File at `~/apple_health_export/Export.xml` (user must copy manually)
- Parser: SAX-based streaming parser (efficient for large XML)
- Caching: `userData/health-cache.json`
- **Bottleneck:** User must remember to export every morning; no live data until export + app parse

### Current Data Pipeline

```
iPhone Health App
       ↓
User clicks: File → Export
       ↓ (downloads .zip with Export.xml)
User moves: ~/Downloads/Export.xml → ~/apple_health_export/Export.xml
       ↓
App startup: main process reads ~/apple_health_export/Export.xml
       ↓
SAX Parser (streaming)
       ↓
userData/health-cache.json (parsed records)
       ↓
Health.jsx renders: SleepSection, HeartSection, StepsCard
```

### Current Files
- **Parser:** `src/main/health-parser.js` — SAX streaming parser for Export.xml
- **Store:** `src/main/health-store.js` — Cache load/save; mtime-based reparse detection
- **IPC:** `src/main/health-ipc.js` — handlers: `health:get-summary`, `health:get-trends`, `health:refresh`; broadcasts `health:ready` + `health:progress`
- **Hook:** `src/renderer/src/hooks/useHealth.js` — exports `useHealthSummary()` + `useHealthTrend(metric, days)`
- **Cache:** `userData/health-cache.json`
- **Component:** `src/renderer/src/components/Health.jsx`

### Current Data Types Parsed
- Sleep stages: Awake, REM, Core, Deep (NOT "InBed")
- Resting Heart Rate (RHR)
- HRV (SDNN)
- HR Recovery (1 min post-exercise)
- Walking HR Average
- **NOT parsed:** Steps, Workouts (will come via HealthKit)

### Current Aggregate Structure (health-cache.json)
Day-keyed object (not arrays):
```json
{
  "meta": {
    "exportDate": "2026-06-01",
    "recordsScanned": 450000,
    "recordsKept": 12000,
    "parseMs": 8200,
    "lastExportMtime": 1748700000000,
    "bytes": 750000000
  },
  "days": {
    "2026-06-01": {
      "rhr":           { "sum": 58, "n": 1, "src": "Apple Watch von Ole" },
      "hrv":           { "sum": 45, "n": 1, "src": "Apple Watch von Ole" },
      "hrRecovery1min": { "sum": 28, "n": 1, "src": "Apple Watch von Ole" },
      "walkingHrAvg":  { "sum": 95, "n": 2, "src": "Apple Watch von Ole" },
      "sleep": {
        "stages": { "awake": 25, "rem": 90, "core": 210, "deep": 70 },
        "start": "2026-05-31T23:10:00+02:00",
        "end":   "2026-06-01T07:00:00+02:00",
        "src":   "Apple Watch von Ole"
      }
    }
  },
  "latest": {
    "rhr": { "avg": 58 },
    "hrv": { "avg": 45 },
    "sleep": { "totalMin": 395, "stages": { "awake": 25, "rem": 90, "core": 210, "deep": 70 } }
  }
}
```

---

## Planned Implementation (HealthKit API)

### Goal
**Eliminate manual export.** App automatically syncs sleep, HR, and steps every 120 minutes via native macOS HealthKit API. User authorizes once, data flows continuously.

### Benefits vs Export
| Aspect | Export | HealthKit |
|---|---|---|
| **User Action** | Daily manual export | One-time authorization |
| **Sync Frequency** | On-demand (manual) | Automatic (120-min interval) |
| **Data Freshness** | Delayed (after export) | Live (syncs every 2 hours) |
| **Completeness** | All-time (entire XML) | Differential (since last sync) |
| **Reliability** | Manual steps → failure risk | Automated → reliable |
| **Energy** | Rebuilds entire cache | Incremental merge |

### Architecture

#### 1. Integration Point: `src/main/health-sync.js` (NEW)

**Purpose:** Native HealthKit polling, differential sync, cache management.

```js
// Pseudo-implementation outline
import * as healthkit from 'node-healthkit';
import fs from 'fs';

const CACHE_PATH = path.join(app.getPath('userData'), 'health-data.json');
const SYNC_INTERVAL = 120 * 60 * 1000; // 120 minutes

class HealthSync {
  constructor() {
    this.syncTimer = null;
    this.isAuthorized = false;
    this.cache = this.loadCache();
  }

  loadCache() {
    try {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    } catch {
      return { sleep: [], heartRate: [], steps: [], workouts: [], lastSync: null, lastError: null };
    }
  }

  saveCache() {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(this.cache, null, 2));
  }

  async authorize() {
    try {
      // Triggers macOS permission dialog (once per app install)
      await healthkit.initHealthKit({
        permissions: {
          read: [
            'HKCategoryTypeIdentifierSleepAnalysis',
            'HKQuantityTypeIdentifierHeartRate',
            'HKQuantityTypeIdentifierStepCount'
          ]
        }
      });
      this.isAuthorized = true;
      return true;
    } catch (err) {
      console.error('HealthKit authorization failed:', err);
      return false;
    }
  }

  async syncSleep(sinceDate) {
    const samples = await healthkit.getSleepSamples({
      startDate: sinceDate,
      endDate: new Date()
    });
    // Transform: [{ startDate, endDate, value }] → [{ date, duration, quality, efficiency }]
    return samples.map(s => ({
      date: formatDate(s.startDate),
      duration: (s.endDate - s.startDate) / 3600,
      quality: s.value === 'InBed' ? 'unknown' : 'good',
      efficiency: 0.9 // Approximation from HealthKit data
    }));
  }

  async syncHeartRate(sinceDate) {
    const samples = await healthkit.getHeartRateSamples({
      startDate: sinceDate,
      endDate: new Date()
    });
    // Aggregate by day: [{ date, restingHR, hrv }]
    const byDate = {};
    samples.forEach(s => {
      const date = formatDate(s.startDate);
      byDate[date] = byDate[date] || [];
      byDate[date].push(s.value);
    });
    return Object.entries(byDate).map(([date, values]) => ({
      date,
      restingHR: Math.min(...values), // Resting = minimum
      hrv: null // HRV not directly available; could derive from variability
    }));
  }

  async syncSteps(sinceDate) {
    const samples = await healthkit.getStepCount({
      startDate: sinceDate,
      endDate: new Date()
    });
    // [{ date, count }]
    return samples.map(s => ({
      date: formatDate(s.startDate),
      count: s.value
    }));
  }

  async fullSync() {
    if (!this.isAuthorized) {
      console.log('HealthKit not authorized, skipping sync');
      return;
    }

    try {
      const sinceDate = this.cache.lastSync ? new Date(this.cache.lastSync) : new Date(Date.now() - 30*24*3600*1000);

      // Fetch all data types in parallel
      const [sleep, heartRate, steps] = await Promise.all([
        this.syncSleep(sinceDate),
        this.syncHeartRate(sinceDate),
        this.syncSteps(sinceDate)
      ]);

      // Merge: deduplicate by date, keep newer data
      this.cache.sleep = this.mergeSleep(this.cache.sleep, sleep);
      this.cache.heartRate = this.mergeHeartRate(this.cache.heartRate, heartRate);
      this.cache.steps = this.mergeSteps(this.cache.steps, steps);
      this.cache.lastSync = new Date().toISOString();
      this.cache.lastError = null;

      this.saveCache();
      return this.cache;
    } catch (err) {
      console.error('HealthKit sync failed:', err);
      this.cache.lastError = err.message;
      this.saveCache();
      throw err;
    }
  }

  mergeSleep(cached, fresh) {
    const byDate = {};
    cached.forEach(s => { byDate[s.date] = s; });
    fresh.forEach(s => { byDate[s.date] = s; }); // Fresh overwrites cached
    return Object.values(byDate).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  mergeHeartRate(cached, fresh) {
    // Similar merge logic
    return [...cached, ...fresh].reduce((acc, item) => {
      const existing = acc.find(x => x.date === item.date);
      if (existing) Object.assign(existing, item);
      else acc.push(item);
      return acc;
    }, []);
  }

  mergeSteps(cached, fresh) {
    // Similar merge logic
    return [...cached, ...fresh].reduce((acc, item) => {
      const existing = acc.find(x => x.date === item.date);
      if (existing) Object.assign(existing, item);
      else acc.push(item);
      return acc;
    }, []);
  }

  startSync() {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => this.fullSync().catch(err => console.error('Scheduled sync failed:', err)), SYNC_INTERVAL);
  }

  stopSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export default new HealthSync();
```

#### 2. IPC Handlers: `src/main/health-ipc.js` (NEW)

```js
import HealthSync from './health-sync.js';
import { ipcMain } from 'electron';

ipcMain.handle('health:authorize', async () => {
  const authorized = await HealthSync.authorize();
  if (authorized) {
    HealthSync.startSync(); // Start polling
  }
  return { authorized };
});

ipcMain.handle('health:sync-now', async () => {
  try {
    const data = await HealthSync.fullSync();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('health:status', () => {
  return {
    authorized: HealthSync.isAuthorized,
    lastSync: HealthSync.cache.lastSync,
    lastError: HealthSync.cache.lastError
  };
});

// Emit updates to renderer periodically or on sync
export function broadcastHealthUpdate(webContents) {
  webContents.send('health:updated', HealthSync.cache);
}
```

#### 3. Renderer Hook: `src/renderer/src/hooks/useHealth.js` (MODIFY)

**Current:** Static cache read on mount.
**Planned:** Listen to `health:updated` IPC events, re-render on sync.

```jsx
import { useEffect, useState } from 'react';

export function useHealth() {
  const [health, setHealth] = useState({
    sleep: [],
    heartRate: [],
    steps: [],
    workouts: [],
    lastSync: null,
    lastError: null
  });
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Check initial status
    window.oleAPI?.health?.status?.().then(status => {
      setAuthorized(status.authorized);
    });

    // Listen for IPC updates (every 120 min sync)
    const unsub = window.oleAPI?.health?.onUpdated?.((data) => {
      setHealth(data);
    });

    return unsub;
  }, []);

  const authorize = async () => {
    const { authorized } = await window.oleAPI?.health?.authorize?.();
    setAuthorized(authorized);
  };

  const syncNow = async () => {
    const { success } = await window.oleAPI?.health?.syncNow?.();
    return success;
  };

  return {
    health,
    authorized,
    authorize,
    syncNow
  };
}
```

#### 4. UI Updates: `src/renderer/src/app.jsx` (Settings Modal)

Add two buttons to the Settings modal:

```jsx
function SettingsModal({ onClose }) {
  const { tokens } = useTheme();
  const { authorized, authorize, syncNow, health } = useHealth();
  const [syncing, setSyncing] = useState(false);

  const handleAuthorize = async () => {
    await authorize();
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
  };

  return (
    <div style={/* modal styles */}>
      <h2>Settings</h2>

      {/* Existing: API Key, Max HR */}

      {/* NEW: Health Section */}
      <div style={{ marginTop: tokens.spacing.lg }}>
        <h3>Health Data</h3>
        {!authorized ? (
          <button
            style={{ ...buttonStyle(tokens), background: tokens.colors.accent.coral }}
            onClick={handleAuthorize}
          >
            Authorize HealthKit
          </button>
        ) : (
          <div>
            <p style={{ color: tokens.colors.text.secondary }}>
              ✓ HealthKit connected
            </p>
            <p style={{ fontSize: '0.85rem', color: tokens.colors.text.tertiary }}>
              Last synced: {health.lastSync ? new Date(health.lastSync).toLocaleString() : 'Never'}
            </p>
            <button
              style={{ ...buttonStyle(tokens) }}
              onClick={handleSyncNow}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        )}
      </div>

      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

### Data Flow (After Implementation)

```
1. App starts
   → health-ipc.js registers handlers
   → HealthSync checks localStorage for 'health:authorized'
   → If authorized: startSync() → 120-min timer begins

2. User first-time setup:
   → Settings → "Authorize HealthKit"
   → OS shows permission dialog (once per install)
   → User accepts
   → HealthSync.authorize() succeeds
   → App immediately calls fullSync()
   → health-data.json populated

3. Every 120 minutes (automatic):
   → HealthSync.fullSync() runs
   → Fetches sleep, HR, steps since lastSync
   → Merges into cache
   → Emits health:updated IPC
   → Health.jsx component re-renders

4. User manually triggers sync:
   → Settings → "Sync Now"
   → health:sync-now handler → fullSync() → immediate update

5. App restart:
   → Cache loaded from disk
   → Health.jsx displays immediately (no wait)
   → 120-min timer resumes

6. Error handling:
   → If HealthKit sync fails → lastError logged
   → UI shows "Last synced: 2 days ago (error)"
   → Falls back to cached data
   → Retries in next 120-min cycle
```

### Migration Path (Export → HealthKit)

**Phase 1 (Current):** Export-based, manual user action.

**Phase 2 (Planned):** HealthKit syncs new data, export data coexists.
- HealthKit data source: `source: 'healthkit'`
- Export data source: `source: 'export'`
- UI displays merged view (no duplication)
- User can continue exporting if desired (ignored)

**Phase 3 (Future):** Deprecate export, rely entirely on HealthKit.

### Limitations & Mitigations

| Limitation | Mitigation |
|---|---|
| HealthKit data not available offline | Cache persists offline; sync resumes online |
| HRV estimation uncertain | Use heart rate variability approximation (std dev of HR samples) |
| Workouts only on Phase 3 | Phase 2 focuses on sleep/HR/steps; workout syncs later |
| No integration with wearables (Garmin, Fitbit) | HealthKit syncs from Apple Watch only; wearables manual import if needed |

---

## Testing Checklist

### Phase 2 Deployment
- [ ] `npm install node-healthkit` succeeds
- [ ] electron-vite build succeeds (no HealthKit module errors)
- [ ] Health.jsx renders without crash
- [ ] Settings modal loads, "Authorize HealthKit" button visible
- [ ] Click button → OS permission dialog appears
- [ ] Accept permissions → app shows "✓ HealthKit connected"
- [ ] "Sync Now" button fetches data (check browser console for logs)
- [ ] After 120 sec (test with reduced interval): auto-sync triggers, data updates
- [ ] App restart: cache loads, data persists
- [ ] Deny permissions → app shows "HealthKit not authorized"
- [ ] Manual export still works (coexists with HealthKit)

---

## File Summary

| File | Status | Purpose |
|---|---|---|
| `scripts/healthkit-bridge.swift` | NEW (Phase 2) | Swift CLI that calls HealthKit, outputs JSON |
| `resources/healthkit-bridge` | NEW (Phase 2) | Compiled Swift binary (git-ignored, built locally) |
| `src/main/health-sync.js` | NEW (Phase 2) | HealthKit poller: calls Swift bridge, merges cache |
| `src/main/health-ipc.js` | MODIFY (Phase 2) | Add: authorize, sync-healthkit, healthkit-status handlers |
| `src/preload/index.js` | MODIFY (Phase 2) | Add: health.authorize, health.syncNow, health.onUpdated |
| `src/renderer/src/hooks/useHealth.js` | MODIFY (Phase 2) | Add useHealthKitSync() hook |
| `src/renderer/src/app.jsx` | MODIFY (Phase 2) | Add "Authorize HealthKit" + "Sync Now" in Settings |
| `userData/health-data.json` | NEW (Phase 2) | HealthKit-synced data (separate from export cache) |
| `userData/health-cache.json` | KEEP | Legacy export data (coexists; deprecated Phase 3) |
