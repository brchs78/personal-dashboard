# OLE OS

Persönliches KI-Dashboard für Ole — gebaut auf Electron 28, React 18 und Vite. Trainingsplanung, Gesundheitsanalyse, Kalender-Sync und ein KI-Coach in einer lokalen Desktop-App für macOS.

---

## Features

### Coach
KI-Assistent (Claude Sonnet 4.5 / Opus 4.6) mit Tool-Use + SSE-Streaming: liest und schreibt ToDos, Kalendertermine, Habits, Trainingspläne und nutzt Strava-Aktivitäten als Kontext. Versteht Recovery-Status, aktuelle Trainingswoche und automatischen Aktivitäts-Kontext. Markdown-Rendering, Claude-Style-Startup-UI. Antwortet auf Deutsch.

### Voice-Mode
ElevenLabs TTS — der Coach spricht Antworten laut vor. API-Key und Voice-ID in den Einstellungen.

### Habit Tracker (Atomic Habits)
1%-Methode mit täglichen Check-ins, 21-Tage-Dot-Grid, Streak-Tracking und Identitäts-Framing ("Ich bin jemand, der …"). Habits sind anlegbar, bearbeitbar und mit Zwei-Minuten-Version + Kategorie (Mindset / Health / Productivity / Fitness).

### Kalender (Two-Way-Sync)
- **iCloud CalDAV** — echte Apple-Kalender lesen + Coach/User-Events zurückschreiben (ETag-Konfliktschutz, App-Passwort verschlüsselt im macOS-Schlüsselbund)
- **iCal-Abos** — read-only Subscriptions (iCloud, Google, Outlook) per `.ics`-URL
- Wochenraster Mo–So, 06–24 Uhr, RRULE/EXDATE-Expansion wiederkehrender Termine
- 15-Minuten-Polling + manueller Refresh

### Training
Wochenplan mit täglichen Sessions (Easy Run, Zone-2, Gym, Hockey, Rad …). Plan generierbar per Coach, Einheiten als erledigt markierbar.

### Gesundheit
Apple Health Import via SAX-Parser (Export.xml). Zeigt RHR, HRV, Schlaf, HR-Recovery — fließt automatisch in den Coach-Kontext.

### Strava
OAuth-Anbindung: Aktivitäten-Liste und Detail-Ansicht direkt in der App. Tokens verschlüsselt im macOS-Schlüsselbund. Coach kann Aktivitäten als Tool-Input lesen.

### ToDos
Buckets: Heute, Diese Woche, Überfällig, Inbox. Priorität, Kategorie (uni/sport/life/errands), Fälligkeitsdatum. Vollständig per Coach bedienbar.

---

## Stack

| Schicht | Technologie |
|---|---|
| Shell | Electron 28 |
| Build | electron-vite 1.0.27, Vite 4 |
| UI | React 18, Framer Motion, Lucide |
| CalDAV | tsdav (Basic Auth, iCloud) |
| iCal | node-ical (HTTP-Fetch + RRULE) |
| KI | Anthropic Claude (Sonnet 4.5 / Opus 4.6) — API-Key lokal in localStorage |
| Voice | ElevenLabs TTS — API-Key lokal in localStorage |
| Strava | OAuth2 (Tokens via `safeStorage`) |
| Sicherheit | `safeStorage` (macOS Keychain) für CalDAV-Passwort und Strava-Tokens |

---

## Entwicklung

```bash
npm install
npm run dev      # Electron + Vite HMR
npm run build    # Produktions-Build → out/
```

### Voraussetzungen
- macOS (für `safeStorage` / Apple Health)
- Node.js >= 18
- Anthropic API-Key (beim ersten Start eingeben)

### Kalender verbinden

**iCal-Abo (read-only):**
Kalender-Tab → Zahnrad → URL einfügen (`https://` oder `webcal://`)

**iCloud CalDAV (Two-Way):**
1. appleid.apple.com → Anmeldung & Sicherheit → App-spezifische Passwörter → neues Passwort erstellen
2. Kalender-Tab → Zahnrad → iCloud verbinden → Apple-ID + App-Passwort eingeben
3. Kalender auswählen, Schreib-Ziel festlegen

**Apple Health:**
`Einstellungen` → `Health` → Daten exportieren → `Export.xml` in `~/apple_health_export/` ablegen → App neu starten

---

## Architektur

```
src/
├── main/                   # Electron-Hauptprozess (Node.js/CJS)
│   ├── index.js            # App-Bootstrap, Fenster, Hotkey (Option+Space)
│   ├── calendar-caldav.js  # tsdav-Wrapper: CalDAV fetch/create/update/delete
│   ├── calendar-ical.js    # iCal HTTP-Fetch + RRULE-Expansion
│   ├── calendar-store.js   # Persistenz: Account, Cache, internal Events
│   ├── calendar-sync.js    # 15-min-Polling (subscriptions + CalDAV)
│   ├── calendar-ipc.js     # IPC-Bridge + Write-Routing
│   ├── coach-chat.js       # Anthropic Tool-Use Loop + SSE-Streaming
│   ├── coach-chat-tools.js # Tool-Definitionen + Dispatcher (inkl. Strava)
│   ├── strava-auth.js      # OAuth2 PKCE
│   ├── strava-client.js    # Strava REST + Token-Refresh
│   ├── strava-store.js     # Token-Persistenz (safeStorage)
│   ├── habit-store.js      # Habit + Check-in + Streak-Persistenz
│   ├── habit-ipc.js        # Habit IPC-Bridge
│   ├── health-parser.js    # SAX-Parser für Apple Health Export.xml
│   └── todo-store.js       # ToDo-Persistenz
├── preload/
│   └── index.js            # contextBridge: oleAPI.*
└── renderer/src/
    ├── components/         # React-Komponenten (Calendar, Coach, Training ...)
    ├── hooks/              # useCalendar, useHealth, ...
    └── styles/tokens.js    # Design-Tokens (Magenta + Indigo)
```

---

## Design

- Hintergrund `#0a0d1a` (dunkelblau), Glassmorphism-Karten
- Primär Magenta `#c026d3`, Sekundär Indigo `#6366f1`
- Global-Hotkey `Option+Space` — blendet Fenster ein/aus

---

## Datenschutz

Alle Daten bleiben lokal. Keine Telemetrie. Zum Anthropic-API werden nur Chat-Nachrichten und Tool-Ergebnisse gesendet (kein Passwort, keine Rohdaten). Zur ElevenLabs-API werden nur Antwort-Texte für TTS gesendet. CalDAV-App-Passwort und Strava-OAuth-Tokens werden ausschließlich im macOS-Schlüsselbund (`safeStorage`) gespeichert und verlassen nie das Gerät im Klartext.
