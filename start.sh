#!/bin/bash
# OLE OS Launcher – startet die App im Hintergrund ohne Terminal

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$APP_DIR/.ole-os.log"
PID_FILE="$APP_DIR/.ole-os.pid"

# Prüfe ob schon eine Instanz läuft
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "OLE OS läuft bereits (PID $OLD_PID). Bringe Fenster in den Vordergrund..."
        osascript -e 'tell application "Electron" to activate' 2>/dev/null
        exit 0
    fi
fi

# Starte die App im Hintergrund
cd "$APP_DIR"
nohup npm run dev > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "✅ OLE OS gestartet (PID $!)"
echo "   Log: $LOG_FILE"
echo "   Stoppen: $APP_DIR/stop.sh"
