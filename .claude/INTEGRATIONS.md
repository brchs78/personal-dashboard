# External Integrations — Architecture & Patterns

## Pattern Overview

All external integrations follow the same pattern:

```
External API (Strava, iCloud CalDAV, HealthKit)
       ↓
Main Process Handler (auth, fetch, cache, persist)
       ↓
userData/*.json (cache for offline)
       ↓
IPC bridge (main → renderer)
       ↓
React Hook (useState, useEffect, data transforms)
       ↓
UI Component (displays + actions)
```

---

## 1. Strava Integration

### Purpose
Display recent running/cycling activities, pace metrics, elevation.

### Files
- **Main Handler:** `src/main/strava.js` (if separated) or inline in coach-chat-tools.js
- **IPC:** `src/main/coach-ipc.js` handler `strava:fetch`
- **Renderer Hook:** `src/renderer/src/hooks/useStrava.js` (if componentized)
- **UI Component:** `src/renderer/src/components/StravaSection.jsx`
- **Cache:** `userData/strava-cache.json`

### Credentials
- **OAuth2 Flow:** User clicks "Connect Strava" → browser opens → Strava grants token
- **Credentials:** `STRAVA_CLIENT_ID` + `STRAVA_CLIENT_SECRET` from `.env` file (NOT in repo)
- **Token Storage:** Encrypted in `userData/strava-tokens.json` via safeStorage (NOT localStorage)
- **Scope:** Read-only public activities (`activity:read_all`)

### Data Flow
1. User clicks "Connect Strava" in Settings
2. `strava:connect` IPC → `strava-auth.js` opens browser for OAuth
3. Redirect captures tokens → `strava-store.saveTokens(tokens)`
4. Every sync (or on manual "Sync"): main process calls Strava API via `strava-client.js`
4. Fetch last 10 activities: `GET /v3/athlete/activities`
5. Cache parsed activities in `userData/strava-cache.json`
6. Renderer listens to `strava:updated` IPC event
7. `StravaSection.jsx` displays activities with pace/elevation/distance

### StravaSection.jsx Structure
```jsx
function StravaSection() {
  const { tokens } = useTheme();
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    // Listen for IPC updates
    window.oleAPI?.strava?.onUpdated?.((activities) => {
      setActivities(activities);
    });
  }, []);

  return <div style={{...}}>
    {activities.map(a => <ActivityCard key={a.id} activity={a} tokens={tokens} />)}
  </div>;
}
```

### Cache Structure
```json
{
  "activities": [
    {
      "id": "...",
      "name": "Morning Run",
      "type": "Run",
      "distance": 10.5,
      "moving_time": 3600,
      "elapsed_time": 3800,
      "average_speed": 10.2,
      "max_speed": 12.1,
      "elevation_gain": 120,
      "start_date": "2026-06-02T06:00:00Z",
      "start_date_local": "2026-06-02T08:00:00",
      "achievement_count": 2
    }
  ],
  "lastFetch": "2026-06-02T10:30:00Z",
  "lastError": null
}
```

---

## 2. iCloud CalDAV Integration

### Purpose
Two-way sync: read iCloud calendar events into OLE OS, write coaching calendar events back to iCloud.

### Files
- **Main Store:** `src/main/calendar-store.js` (loads/saves cache + account config)
- **CalDAV Wrapper:** `src/main/calendar-caldav.js` (tsdav abstraction)
- **iCal Parser:** `src/main/calendar-ical.js` (expandVEvents for RRULE/EXDATE)
- **Sync Loop:** `src/main/calendar-sync.js` (15-min interval, ctag-based polling)
- **IPC Handlers:** `src/main/calendar-ipc.js` (connect, disconnect, list, fetch, create, update, delete)
- **Renderer Hook:** `src/renderer/src/hooks/useCalendar.js`
- **UI Component:** `src/renderer/src/components/Calendar.jsx`
- **Cache:** `userData/calendar-cache.json`
- **Credentials:** `userData/calendar-caldav-account.json` (safeStorage-encrypted)

### Credentials & Security
- **Entry Point:** Settings modal "iCloud verbinden" button
- **Input:** Apple ID + app-specific password (from appleid.apple.com)
- **Storage:**
  - Plaintext only during `caldav:connect` IPC call
  - Password immediately encrypted via `safeStorage.encryptString()` → base64 JSON
  - Never returned to renderer after initial connect
- **Retrieval:** On sync, main process decrypts via `safeStorage.decryptString()` on-demand

### Credential File: `userData/calendar-caldav-account.json`
```json
{
  "appleId": "ole@example.com",
  "passwordEnc": "base64-encrypted-app-password",
  "connected": true,
  "selectedCalendars": ["https://caldav.icloud.com/calendars/p/..."],
  "targetCalendarUrl": "https://caldav.icloud.com/calendars/p/...",
  "lastSync": "2026-06-02T10:00:00Z",
  "lastError": null
}
```

### CalDAV Sync Flow

#### 1. Authorization (One-time or re-auth)
```
User clicks "iCloud verbinden"
  → Enters Apple ID + app password
  → IPC → calendar:caldav-connect
  → Main: tsdav.createDAVClient({ username, password })
  → Test connection (listCalendars)
  → If success: save encrypted password + mark connected
  → If fail: clear credentials + show error
  → Emit calendar:caldav-status updated
```

#### 2. Continuous Sync (15-min loop, ctag short-circuit)
```
calendar-sync.js refreshAll():
  For each selected calendar:
    Check ctag (collection tag) vs stored ctag
    If unchanged: skip
    If changed: fetchCalendarObjects(calendar, timeRange=[now-30d, now+7d])
    For each returned ICS object:
      Parse via node-ical
      Expand RRULE/EXDATE via calendar-ical.expandVEvents()
      Merge into calendar-cache.json
  Emit calendar:updated to renderer
```

#### 3. Write-Back (Create/Update/Delete)
```
Coach says: "Add meeting 14:00 tomorrow"
  → coach-chat-tools.js create_calendar_event()
  → Check: caldav.connected && targetCalendarUrl set?
    If yes: tsdav.createCalendarObject() → saves to iCloud
    If no: local internal store (fallback)
  → Cache updated, emit calendar:updated
  → Event visible in calendar immediately

User edits/deletes event:
  → Check source: caldav vs internal vs subscription
  → If caldav: tsdav.updateCalendarObject() (ETag required for conflict detection)
  → If internal: local store
  → If subscription: error (read-only)
```

### Cache Structure: `userData/calendar-cache.json`
```json
{
  "events": [
    {
      "id": "unique-id",
      "uid": "UID@icloud.com",
      "title": "Coach Session",
      "description": "Running form check",
      "location": "Central Park",
      "start": "2026-06-05T10:00:00Z",
      "end": "2026-06-05T11:00:00Z",
      "allDay": false,
      "source": "caldav",
      "writable": true,
      "sourceLabel": "Calendar",
      "caldav": {
        "calendarUrl": "https://caldav.icloud.com/calendars/p/...",
        "objectUrl": "https://caldav.icloud.com/calendars/p/.../events/...",
        "etag": "\"abc123\""
      }
    },
    {
      "id": "...",
      "source": "internal",
      "writable": true
    },
    {
      "id": "...",
      "source": "subscription",
      "writable": false
    }
  ],
  "lastSync": "2026-06-02T10:00:00Z"
}
```

### IPC Handlers (calendar-ipc.js)

| Handler | Params | Returns | Notes |
|---|---|---|---|
| `calendar:caldav-connect` | { appleId, password } | { connected, calendars } | Encrypts password, saves account |
| `calendar:caldav-disconnect` | — | { connected: false } | Clears credentials |
| `calendar:caldav-status` | — | { connected, appleId, selectedCalendars, targetCalendarUrl, lastSync, lastError } | No password in response |
| `calendar:list-calendars` | — | [{ url, displayName }] | Returns selected calendars |
| `calendar:add-event` | { title, start, end, ... } | { event } | Routes to caldav or internal |
| `calendar:update-event` | { id, title, start, ... } | { event } | Handles ETag conflicts |
| `calendar:delete-event` | { id } | { success } | — |

---

## 3. HealthKit Integration (PLANNED)

### Purpose
Automatically sync sleep, heart rate, and step data from macOS Health app without daily manual export.

### Files
- **Main Store:** `src/main/health-sync.js` (NEW — HealthKit polling + cache)
- **IPC Handlers:** `src/main/health-ipc.js` (NEW — authorize, sync, status)
- **Renderer Hook:** `src/renderer/src/hooks/useHealth.js` (MODIFY — listen to IPC)
- **UI Component:** `src/renderer/src/components/Health.jsx` (MODIFY — add buttons)
- **Cache:** `userData/health-data.json` (NEW)

### Credentials & Security
- **Authorization:** User clicks "Authorize HealthKit" in Settings
- **Flow:** OS shows permission dialog (native, not in-app)
- **Scope:** Read-only (Sleep, Heart Rate, Steps)
- **Storage:** No credentials needed — OS handles access via keychain
- **Persistence:** Flag in `localStorage.setItem('health:authorized', true)`

### Data Flow
1. App starts → check `localStorage['health:authorized']`
2. If authorized: start 120-min sync interval
3. On interval: fetch Sleep/HR/Steps from HealthKit since lastSync
4. Parse/aggregate data (daily summaries)
5. Merge with cached data (dedup by date)
6. Save to `userData/health-data.json`
7. Emit `health:updated` IPC event
8. Renderer components listen and refresh

### node-healthkit API (Minimal)

```js
import * as healthkit from 'node-healthkit';

// Request permissions (shows OS dialog once per app install)
await healthkit.initHealthKit({ permissions: { read: ['Sleep', 'HKQuantityTypeIdentifierHeartRate', 'HKQuantityTypeIdentifierStepCount'] } });

// Fetch sleep data
const sleepSamples = await healthkit.getSleepSamples({ startDate, endDate });
// → [{ startDate, endDate, value: 'HKCategoryValueSleepAnalysisInBed' }]

// Fetch heart rate (daily average)
const hrSamples = await healthkit.getHeartRateSamples({ startDate, endDate });
// → [{ startDate, value (bpm), sourceBundle }]

// Fetch step count (daily)
const stepSamples = await healthkit.getStepCount({ startDate, endDate });
// → [{ startDate, value (steps) }]
```

### Cache Structure: `userData/health-data.json`

```json
{
  "sleep": [
    {
      "date": "2026-06-01",
      "duration": 7.5,
      "quality": "good",
      "efficiency": 0.92
    }
  ],
  "heartRate": [
    {
      "date": "2026-06-01",
      "restingHR": 58,
      "hrv": 45
    }
  ],
  "steps": [
    {
      "date": "2026-06-01",
      "count": 12500
    }
  ],
  "workouts": [
    {
      "date": "2026-06-01",
      "type": "Running",
      "distance": 10.2,
      "duration": 3600,
      "pace": "5:52/km",
      "avgHR": 148,
      "source": "healthkit"
    }
  ],
  "lastSync": "2026-06-02T10:30:00Z",
  "lastSyncStatus": "success"
}
```

### IPC Handlers (health-ipc.js — PLANNED)

| Handler | Params | Returns | Notes |
|---|---|---|---|
| `health:authorize` | — | { authorized: true/false } | Triggers OS permission dialog |
| `health:sync-now` | — | { lastSync, lastError } | Manually trigger sync |
| `health:status` | — | { authorized, lastSync, lastSyncStatus } | Check sync status |
| `health:data` | — | { sleep, heartRate, steps } | Fetch current cached data |

### MVP Scope (Phase 2)
- **Include:** Sleep, Heart Rate (resting + HRV), Steps
- **Exclude:** Workouts (Phase 3), nutrition, medications, etc.
- **Polling:** Every 120 min (not aggressive)

---

## Integration Checklist

When adding a new integration:

1. **Main Process Handler:** Create fetch/sync logic, persist to userData/*.json
2. **IPC Bridge:** Expose via ipcMain.handle in dedicated *-ipc.js file
3. **Preload:** Add to window.oleAPI namespace in preload/index.js
4. **Renderer Hook:** Create useX hook (useState, useEffect, useCallback)
5. **UI Component:** Component calls hook, uses tokens for styling, listens to IPC updates
6. **Cache:** Define JSON schema, store in userData/
7. **Settings:** Add auth button (if needed) in app.jsx Settings modal
8. **Error Handling:** Graceful fallback (cached data, error message)
9. **Testing:** Manual test: auth → sync → UI update → app restart → data persisted

---

## Common Patterns

### Syncing with Differential Updates
```js
// Load lastSync timestamp from cache
const lastSync = cache.lastSync ? new Date(cache.lastSync) : new Date(Date.now() - 30*24*3600*1000);

// Fetch only delta
const newData = await api.fetch({ since: lastSync });

// Merge: deduplicate by ID/date, keep newer items
const merged = { ...cache.items, ...newData };

// Save with new timestamp
cache.items = merged;
cache.lastSync = new Date().toISOString();
```

### Error Handling in Sync
```js
try {
  const data = await externalAPI.fetch();
  cache.items = data;
  cache.lastError = null;
} catch (err) {
  console.error('Sync failed:', err);
  cache.lastError = err.message;
  // Use cached data as fallback
}
// Always save cache, even on error (for recovery)
saveCache(cache);
```

### IPC Broadcast to Renderer
```js
// Main process, after sync completes
const data = readCacheSync();
webContents.send('integration:updated', data);

// Renderer component
useEffect(() => {
  const unsub = window.oleAPI?.integration?.onUpdated?.((data) => {
    setData(data);
  });
  return unsub;
}, []);
```
