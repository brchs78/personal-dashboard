require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { app, BrowserWindow, globalShortcut, Tray, Menu,
    nativeImage, Notification, ipcMain } = require('electron')
const path = require('path')
const healthIPC = require('./health-ipc.js')
const stravaIPC = require('./strava-ipc.js')
const coachPlanIPC = require('./coach-plan-ipc.js')
const todoIPC = require('./todo-ipc.js')
const coachChatIPC = require('./coach-chat-ipc.js')
const calendarIPC = require('./calendar-ipc.js')
const habitIPC = require('./habit-ipc.js')
const habitStore = require('./habit-store.js')
const coachPlanStore = require('./coach-plan-store.js')
const stravaStore = require('./strava-store.js')
const vaultExportIPC = require('./vault-export-ipc.js')
const vaultExport = require('./vault-export.js')
const routineIPC = require('./routine-ipc.js')

let mainWindow = null
let tray = null
let isQuitting = false
const lastFired = {}

function showWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow()
    } else {
        mainWindow.show()
        mainWindow.focus()
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 480, height: 720, show: false,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#faf9f5',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
        },
    })
    if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }
    mainWindow.on('ready-to-show', () => mainWindow.show())

    // macOS: Fenster verstecken statt zerstören beim Schließen (roter X-Button)
    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault()
            mainWindow.hide()
        }
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

function registerHotkey() {
    const ok = globalShortcut.register('Alt+Space', () => {
        if (!mainWindow || mainWindow.isDestroyed()) { showWindow(); return }
        if (mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide()
        else { mainWindow.show(); mainWindow.focus() }
    })
    if (!ok) console.warn('[hotkey] Alt+Space registration FAILED — conflicting shortcut or missing permission')
    else console.log('[hotkey] Alt+Space registered OK')
}

function createTray() {
    tray = new Tray(nativeImage.createEmpty())
    updateTrayTitle()
    tray.setToolTip('OLE OS')
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'OLE OS öffnen', click: () => showWindow() },
        { type: 'separator' },
        { label: 'Beenden', click: () => { isQuitting = true; app.quit() } },
    ]))
    setInterval(updateTrayTitle, 60 * 60 * 1000)
}

function updateTrayTitle() {
    if (!tray || tray.isDestroyed()) return
    const days = Math.max(0, Math.round((new Date('2026-10-11') - new Date()) / 86400000))
    tray.setTitle(`  🏃 ${days}d`)
}

function startScheduler(vaultDeps) {
    const routines = [
        { time: '07:00', id: 'morning', title: 'Guten Morgen, Ole', body: 'Dein Tagesplan ist bereit.' },
        { time: '15:00', id: 'run', title: 'Lauf-Check', body: 'Heute schon trainiert?' },
        { time: '21:30', id: 'evening', title: 'Tag abschließen', body: 'Zeit für deine Zusammenfassung.' },
    ]
    setInterval(() => {
        const now = new Date()
        const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        const today = now.toDateString()
        routines.forEach(r => {
            if (hm === r.time && lastFired[r.id] !== today) {
                lastFired[r.id] = today
                new Notification({ title: r.title, body: r.body }).show()
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('routine-trigger', r.id)
                }
                if (r.id === 'evening' && vaultExport.loadSettings().autoExport) {
                    try {
                        const res = vaultExport.exportDay(null, vaultDeps)
                        console.log('[vault-export] daily export OK:', res.date)
                    } catch (e) {
                        console.warn('[vault-export] daily export failed:', e?.message)
                        new Notification({
                            title: 'Vault-Export fehlgeschlagen',
                            body: e?.message === 'vault_path_not_set'
                                ? 'Kein Vault-Pfad gesetzt — Settings → Obsidian Vault.'
                                : e?.message === 'vault_path_missing'
                                ? 'Vault-Ordner nicht gefunden.'
                                : `Fehler: ${e?.message || 'unbekannt'}`,
                        }).show()
                    }
                }
            }
        })
    }, 30 * 1000)
}

ipcMain.on('hide-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
})

app.on('before-quit', () => { isQuitting = true })

app.whenReady().then(() => {
    const vaultDeps = {
        getHabits: habitStore.getAll,
        getStreaks: habitStore.getStreaks,
        getPlan: coachPlanStore.loadCurrent,
        getActivities: stravaStore.loadCache,
        getCoachHistory: coachChatIPC.loadHistory,
    }
    createWindow(); registerHotkey(); createTray(); startScheduler(vaultDeps)
    healthIPC.init(() => mainWindow)
    stravaIPC.init(() => mainWindow)
    coachPlanIPC.init(() => mainWindow, {
        getHealthSummary: healthIPC.getCurrentSummary,
        getHealthTrend: healthIPC.getTrend,
    })
    todoIPC.init(() => mainWindow)
    habitIPC.init(() => mainWindow)
    calendarIPC.init(() => mainWindow)
    coachChatIPC.init(() => mainWindow, {
        getHealthSummary: healthIPC.getCurrentSummary,
    })
    vaultExportIPC.init(() => mainWindow, vaultDeps)
    routineIPC.init(() => mainWindow)
    app.on('activate', () => showWindow())
})
app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => { })