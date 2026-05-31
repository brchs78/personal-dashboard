// OLE OS — Coach Chat Loop mit Anthropic Tool-Use
// Loop: send → response → wenn tool_use → tools ausführen → wieder send …
// Bricht nach MAX_LOOP Iterationen mit Fehler ab.

const { TOOLS, dispatch } = require('./coach-chat-tools.js');

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
WOCHE: Mo Easy+Yoga · Di Hockey · Mi Easy+Gym · Do Hockey · Fr Rad · Sa Long Run · So Rest. Lauf-km nur Mo/Mi/Sa.
STATUS: Post-Weisheitszahn-OP + Antibiotika. Erlaubt: Zone 1-2, Hockey, Rad, Yoga. Verboten: Pool, Schwerheben, Max-Intensität.`;

function systemPrompt() {
    return `${BASE_PROFILE}

WERKZEUGE: Du hast Zugriff auf Tools für ToDos (lesen/anlegen/aktualisieren/abhaken/löschen), die heutige Trainings-Session und den Recovery-Status. Nutze sie aktiv statt zu raten.
MORGEN-RITUAL: Bei "Guten Morgen" oder ähnlichen Eröffnungen → erst Recovery + Training + offene ToDos abrufen, dann kompaktes Briefing, dann offene Frage "Was steht an?".
TODO-REGELN: Beim Anlegen sinnvolle Defaults (priority 2, category 'life'). dueDate nur setzen, wenn der User ein Datum/Tag nennt. Beim Abhaken erst list_todos um die korrekte ID zu finden.
STIL: Knapp, direkt, deutsch. Bestätige Aktionen in einem halben Satz. Schlage Tages-Reihenfolge mit Zeit-Blöcken vor, wenn der User unklar ist, was zu tun ist.
HEUTE: ${todayISO()}.`;
}

async function callAnthropic({ apiKey, messages }) {
    const r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt(),
            tools: TOOLS,
            messages,
        }),
    });
    if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Anthropic ${r.status}: ${txt}`);
    }
    return r.json();
}

async function chat({ apiKey, history, userMessage, ctx }) {
    if (!apiKey) throw new Error('missing_api_key');
    if (!userMessage || !String(userMessage).trim()) throw new Error('empty_message');

    const messages = [...(history || []), { role: 'user', content: String(userMessage) }];

    for (let i = 0; i < MAX_LOOP; i++) {
        const resp = await callAnthropic({ apiKey, messages });
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
