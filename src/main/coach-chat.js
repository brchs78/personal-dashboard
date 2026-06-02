// OLE OS — Coach Chat Loop mit Anthropic Tool-Use (Streaming via SSE)
// Loop: send → SSE stream → wenn tool_use → tools ausführen → wieder send …
// Bricht nach MAX_LOOP Iterationen mit Fehler ab.

const { TOOLS, dispatch } = require('./coach-chat-tools.js');
const stravaStore = require('./strava-store.js');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';
const MAX_LOOP = 8;
const MAX_TOKENS = 1500;

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

const BASE_PROFILE = `Du bist Oles persönlicher KI-Sportcoach und Life-Optimierer.
IDENTITÄT: Ole, VWL-Student 2. Semester, LMU München. 193cm, 72kg.
TRAINING: Volume over Speed. Marathon Sub 3:10h (Pace 4:30/km) am 11.10.2026. Zone-2-Laufen ist Kern. Aktuell Phase 1 Base-Building.
WOCHE: Mo Easy+Yoga · Di Hockey · Mi Easy+Gym · Do Hockey · Fr Rad · Sa Long Run · So Rest. Lauf-km nur Mo/Mi/Sa.`;

function systemPrompt() {
    return `${BASE_PROFILE}

STRAVA: Du hast DIREKTEN Zugriff auf Oles Strava-Daten via get_recent_activities und get_activity_detail. FRAGE NIEMALS nach Lauf-Daten (km, Pace, Puls) — rufe sie IMMER selbst ab. Wenn Ole ein Training erwähnt, hole dir sofort die Daten und analysiere sie.
WERKZEUGE: Du hast Zugriff auf Tools für ToDos, Trainings-Session, Recovery-Status, Kalender und Strava-Aktivitäten. Nutze sie aktiv statt zu raten.
KALENDER: Liste/Erstelle/Aktualisiere/Lösche Kalendertermine. Externe Subscriptions (iCloud/Google/Outlook) sind read-only — erkennbar an source !== 'internal'. Bei "Termin morgen 14 Uhr" Default-Dauer 60min. Bestätige knapp.
MORGEN-RITUAL: Bei "Guten Morgen" oder ähnlichen Eröffnungen → erst Recovery + Training + letzte Strava-Aktivitäten + offene ToDos abrufen, dann kompaktes Briefing mit Trainings-Feedback, dann offene Frage "Was steht an?".
TRAINING-FEEDBACK: Wenn Ole von einem Lauf/Training erzählt → IMMER zuerst get_recent_activities aufrufen, dann die passende Aktivität mit get_activity_detail analysieren. Gib konkretes Feedback zu Pace, HR-Zonen, Splits.
TODO-REGELN: Beim Anlegen sinnvolle Defaults (priority 2, category 'life'). dueDate nur setzen, wenn der User ein Datum/Tag nennt. Beim Abhaken erst list_todos um die korrekte ID zu finden.
STIL: Knapp, direkt, deutsch. Bestätige Aktionen in einem halben Satz. Schlage Tages-Reihenfolge mit Zeit-Blöcken vor, wenn der User unklar ist, was zu tun ist.
HEUTE: ${todayISO()}.`;
}

// Parst Anthropic SSE-Stream. Ruft onEvent({ type, ... }) für jedes Event auf
// und gibt am Ende das vollständige assistant message-content-Array zurück.
async function streamAnthropic({ apiKey, messages, onEvent }) {
    const r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'accept': 'text/event-stream',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt(),
            tools: TOOLS,
            messages,
            stream: true,
        }),
    });
    if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Anthropic ${r.status}: ${txt}`);
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';

    // Akkumulator für content blocks (text + tool_use), indexiert nach Block-Index
    const blocks = [];
    let stopReason = null;

    function parseEvent(rawEvent) {
        // SSE: 'event: <name>\ndata: <json>\n\n' (oder nur data-Zeilen)
        const lines = rawEvent.split('\n');
        let dataLine = '';
        for (const line of lines) {
            if (line.startsWith('data:')) {
                dataLine += line.slice(5).trimStart();
            }
        }
        if (!dataLine) return;
        let json;
        try { json = JSON.parse(dataLine); } catch { return; }
        const type = json.type;

        if (type === 'content_block_start') {
            const block = json.content_block;
            blocks[json.index] = block.type === 'text'
                ? { type: 'text', text: '' }
                : block.type === 'tool_use'
                    ? { type: 'tool_use', id: block.id, name: block.name, input: {}, _inputJson: '' }
                    : { ...block };
            if (block.type === 'text') onEvent?.({ type: 'text_start' });
        } else if (type === 'content_block_delta') {
            const d = json.delta;
            const b = blocks[json.index];
            if (!b) return;
            if (d.type === 'text_delta') {
                b.text += d.text;
                onEvent?.({ type: 'text_delta', delta: d.text });
            } else if (d.type === 'input_json_delta') {
                b._inputJson += d.partial_json || '';
            }
        } else if (type === 'content_block_stop') {
            const b = blocks[json.index];
            if (b && b.type === 'tool_use') {
                try { b.input = b._inputJson ? JSON.parse(b._inputJson) : {}; }
                catch { b.input = {}; }
                delete b._inputJson;
            }
        } else if (type === 'message_delta') {
            if (json.delta?.stop_reason) stopReason = json.delta.stop_reason;
        }
    }

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE-Events sind durch '\n\n' getrennt
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
            const evt = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            parseEvent(evt);
        }
    }
    if (buf.trim()) parseEvent(buf);

    return { content: blocks, stop_reason: stopReason };
}

// Letzte Aktivitäten aus dem Cache als Kontext-Snippet (kein API-Call).
function recentActivitySnippet(maxItems = 3) {
    try {
        const cache = stravaStore.loadCache();
        if (!cache?.activities?.length) return null;
        const items = cache.activities.slice(0, maxItems).map((a) => {
            const km = (a.distance / 1000).toFixed(1);
            const min = (a.moving_time / 60).toFixed(0);
            const pace = a.distance > 0 ? ((a.moving_time / 60) / (a.distance / 1000)).toFixed(2) : '—';
            const hr = a.average_heartrate ? `Ø${Math.round(a.average_heartrate)}bpm` : 'kein HR';
            const date = (a.start_date_local || '').slice(0, 10);
            return `• ${date} ${a.type}: ${a.name} — ${km}km, ${min}min, ${pace}min/km, ${hr}`;
        });
        return `[STRAVA-KONTEXT — letzte Aktivitäten]\n${items.join('\n')}\n(Für Details nutze get_activity_detail mit der ID.)`;
    } catch { return null; }
}

async function chat({ apiKey, history, userMessage, ctx }) {
    if (!apiKey) throw new Error('missing_api_key');
    if (!userMessage || !String(userMessage).trim()) throw new Error('empty_message');

    // Strava-Kontext automatisch an erste User-Nachricht anhängen
    const stravaCtx = recentActivitySnippet();
    const enrichedMessage = stravaCtx
        ? `${String(userMessage)}\n\n${stravaCtx}`
        : String(userMessage);

    const messages = [...(history || []), { role: 'user', content: enrichedMessage }];

    for (let i = 0; i < MAX_LOOP; i++) {
        // Reset des Stream-Buffers im Renderer vor jeder Loop-Iteration
        ctx?.onStreamReset?.();

        const resp = await streamAnthropic({
            apiKey,
            messages,
            onEvent: (ev) => {
                if (ev.type === 'text_delta') {
                    ctx?.onStreamDelta?.({ delta: ev.delta });
                }
            },
        });
        messages.push({ role: 'assistant', content: resp.content });

        if (resp.stop_reason !== 'tool_use') {
            const text = (resp.content || [])
                .filter((b) => b.type === 'text')
                .map((b) => b.text)
                .join('');
            return { messages, text };
        }

        const toolUses = (resp.content || []).filter((b) => b.type === 'tool_use');
        const toolResults = [];
        for (const block of toolUses) {
            ctx?.onToolEvent?.({ tool: block.name, input: block.input, status: 'started' });
            try {
                const result = await dispatch(block.name, block.input || {}, ctx);
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify(result ?? null),
                });
                ctx?.onToolEvent?.({ tool: block.name, input: block.input, status: 'done', result });
            } catch (e) {
                const msg = String(e?.message || e);
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: msg,
                    is_error: true,
                });
                ctx?.onToolEvent?.({ tool: block.name, input: block.input, status: 'error', error: msg });
            }
        }
        messages.push({ role: 'user', content: toolResults });
    }
    throw new Error('tool_loop_exceeded');
}

module.exports = { chat };
