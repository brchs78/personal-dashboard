# OLE OS — Projekt-Snapshot

## Tech Stack
- **Electron:** 28.x (IPC, preload, main/renderer process separation)
- **React:** 18.x (renderer, hooks pattern, context for state)
- **Vite:** 4.x + electron-vite 1.0.27 (bundling main/renderer/preload separately)
- **Styling:** Inline `style={{}}` CSS-in-JS (no Tailwind), design tokens from `tokens.js`
- **UI Library:** lucide-react (icons), framer-motion (animations)
- **Build Target:** macOS arm64 + x64
- **Design Tokens:** `buildTokens(mode)` for light/dark theme switching via React context

## Core Architecture

### Process Structure
```
Main Process (Node.js)
├─ Electron window management
├─ IPC handlers (ipcMain.handle, ipcMain.on)
├─ File I/O & userData caching
├─ External API integrations (Strava, CalDAV, HealthKit)
├─ Sync loops (15-min calendars, health data, etc.)
└─ Logging & error handling

Preload (Contextual Bridge)
└─ Exposes window.oleAPI with limited IPC methods

Renderer (React)
├─ Components with inline styles + useTheme()
├─ Hooks for state (useTrainingPlan, useCalendar, useHealth, etc.)
└─ Communicates with main via window.oleAPI.* or direct IPC
```

### Directory Layout
```
src/
├─ main/
│  ├─ index.js                 — Electron app entry
│  ├─ coach-plan-store.js      — Training plan persistence (userData/training-plan.json)
│  ├─ coach-plan-ipc.js        — IPC handlers for plan operations
│  ├─ coach-chat-tools.js      — Tools for Claude coach agent
│  ├─ calendar-store.js        — Calendar event cache (internal + caldav)
│  ├─ calendar-caldav.js       — tsdav wrapper for iCloud CalDAV
│  ├─ calendar-ical.js         — iCal parsing & expansion
│  ├─ calendar-sync.js         — Sync loop for calendar events
│  ├─ calendar-ipc.js          — IPC handlers for calendar operations
│  ├─ health-parser.js         — SAX parser: sleep, RHR, HRV, HRRecovery, walkingHR
│  ├─ health-store.js          — Cache load/save + mtime-based reparse detection
│  ├─ health-ipc.js            — IPC: get-summary, get-trends, refresh; events health:ready/progress
│  ├─ health-sync.js           — [PLANNED] HealthKit Swift-bridge poller (120-min interval)
│  ├─ strava-auth.js           — OAuth2 flow (opens browser, handles redirect)
│  ├─ strava-client.js         — Strava API client (listActivities, getActivity)
│  ├─ strava-store.js          — Token + cache (userData/strava-tokens.json, strava-cache.json)
│  ├─ strava-ipc.js            — IPC: status, connect, disconnect, sync, list-activities
│  ├─ todo-store.js            — Todos persistence
│  ├─ todo-ipc.js              — IPC handlers for todos
│  ├─ coach-plan.js            — AI plan generation
│  ├─ coach-chat.js            — Claude chat session
│  └─ coach-chat-ipc.js        — IPC handlers for coach chat
│
├─ preload/
│  └─ index.js                 — contextBridge API definition (window.oleAPI)
│
└─ renderer/src/
   ├─ main.jsx                 — React entry, ThemeProvider wrapper
   ├─ app.jsx                  — Main App component, Settings modal
   ├─ styles/
   │  └─ tokens.js             — buildTokens(mode), colors, spacing, radius, typography
   ├─ hooks/
   │  ├─ useTheme.jsx          — Theme context provider + hook (light/dark mode)
   │  ├─ useTrainingPlan.js    — Training plan state + actions
   │  ├─ useCalendar.js        — Calendar events + CalDAV integration
   │  ├─ useHealth.js          — exports: useHealthSummary() + useHealthTrend(metric, days)
   │  └─ ... (other hooks)
   └─ components/
      ├─ Sidebar.jsx           — Tab navigation
      ├─ Calendar.jsx          — Event calendar + iCloud drawer
      ├─ TrainingPlan.jsx      — Weekly training plan with day-editing
      ├─ Health.jsx            — Health dashboard (sleep, HR, steps)
      ├─ CoachHome.jsx         — Coach chat interface
      ├─ Todos.jsx             — Task management
      ├─ VoiceMode.jsx         — Voice input overlay
      ├─ MarathonCountdown.jsx — Race timer
      ├─ StravaSection.jsx     — Strava activity feed
      └─ ... (other components)

userData/
├─ training-plan.json          — Current training plan (current.days[])
├─ calendar-cache.json         — Cached events (internal + caldav)
├─ calendar-caldav-account.json — iCloud credentials (safeStorage-encrypted)
├─ strava-cache.json           — Recent Strava activities
├─ health-cache.json           — Health data from Export.xml (legacy)
└─ health-data.json            — [PLANNED] HealthKit synced data
```

## Design Conventions

### Styling
- **No CSS files** — All styles as inline objects: `style={{ ... }}`
- **Token usage:** `const { tokens } = useTheme()` in every component that uses styling
- **Colors:** Access via `tokens.colors.*` (bg, text, accent, border, status, tab, etc.)
- **Spacing:** `tokens.spacing.*` (xs, sm, md, lg, xl)
- **Radius:** `tokens.radius.*` (sm, md, lg, pill)
- **Fonts:** Space Grotesk (display), Newsreader (body) via Google Fonts
- **Motion:** framer-motion with tokens.motion presets

### Component Patterns
```jsx
// ✓ Correct pattern (with useTheme inside component)
function MyComponent() {
  const { tokens } = useTheme();
  const mutableData = useMemo(() => getMutableDependentData(tokens), [tokens]);
  return <div style={{ color: tokens.colors.text.primary }}>...</div>;
}

// ✗ Old pattern (static import, cannot switch themes)
import tokens from '../styles/tokens';  // Don't do this anymore
```

### IPC Pattern
- **Main → Renderer:** `webContents.send('event-name', data)`
- **Renderer → Main:** `window.oleAPI.method()` or direct `ipcRenderer.invoke('handler-name', params)`
- **Error Handling:** Renderer wraps API calls in try-catch, logs errors locally

### Persistence
- All state lives in `userData/*.json` files
- Cache is loaded on app start, synced periodically (15-60 min intervals)
- No database — JSON files are sufficient for 1-5 years of data

## Key Files & Their Roles

| File | Purpose |
|---|---|
| `src/renderer/src/styles/tokens.js` | Design tokens: `buildTokens(mode)` generates light/dark theme objects |
| `src/renderer/src/hooks/useTheme.jsx` | React context for theme (light/dark), localStorage persistence, CSS var syncing |
| `src/preload/index.js` | Exposes window.oleAPI with IPC methods (plan, calendar, health, etc.) |
| `src/main/coach-plan-store.js` | Load/save training plan, compute current week, update individual days |
| `src/main/calendar-store.js` | Merge internal + caldav events, manage subscriptions, caching |
| `src/main/calendar-caldav.js` | tsdav wrapper, HealthKit auth, CRUD operations on iCloud events |
| `src/renderer/src/components/Calendar.jsx` | Weekly calendar view, event blocks, CalDAV connection drawer |
| `src/renderer/src/components/TrainingPlan.jsx` | Training plan UI, day-edit modal with modal+pencil pattern |

## Important Gotchas

1. **Module-level constants with tokens:** Don't use `import tokens` statically. Every component needs `const { tokens } = useTheme()` inside it to get theme updates.

2. **Utility functions with token deps:** If a utility uses tokens (colors, spacing), make it accept `tokens` as a parameter instead of relying on module-level import. Example: `function getCategories(tokens) { ... }`

3. **Renderer process:** Can access `window.oleAPI.*` via contextBridge preload. No direct access to Node.js `fs`, `path`, etc.

4. **electron-vite config:** multi-entry bundling — if adding new main process files, ensure they're in `rollupOptions.input`.

5. **Dynamic imports:** tsdav is ESM, but main is CJS. Use `await import('tsdav')` not `require('tsdav')`.

6. **BrowserWindow backgroundColor:** Static at startup (`#faf9f5` for light), but CSS body background is dynamic via ThemeProvider useEffect. Window background flashes briefly on startup.

## Building & Running

```bash
# Development
npm run dev              # Starts vite + electron, hot reload

# Build
npx electron-vite build  # Produces out/main, out/preload, out/renderer

# Package (macOS)
npm run build:mac        # Electron-builder, creates .dmg/.app
```

## API Keys & Credentials

- **Strava:** API token in `localStorage` (safe to push, read-only for activities)
- **iCloud CalDAV:** Username + app-password encrypted via `safeStorage` in `calendar-caldav-account.json` (never in plaintext)
- **HealthKit:** No API keys — uses OS permissions (user grants access via dialog)

## Design Colors (Light Theme)

- **Background:** `#faf9f5` (cream)
- **Text:** `#1a1a1a` (dark)
- **Accent (Coral):** `#cc785c`
- **Secondary (Indigo):** `#6366f1`
- **Borders:** Various glass + subtle grays

## Design Colors (Dark Theme)

- **Background:** `#1a1a1a` (dark)
- **Text:** `#faf9f5` (light cream)
- **Accent (Coral):** `#d4916e` (lighter for contrast)
- **Secondary (Indigo):** `#818cf8` (lighter)
