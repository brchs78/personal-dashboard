// OLE OS — Küchen-KI
// Anthropic-Calls: Kassenbon-PDF parsen + Rezeptvorschlag generieren.
// Main-seitig (wie coach-plan.js), API-Key kommt aus dem Renderer.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';

// Robustes JSON-Parsing: schält ```json-Fences ab, schneidet auf erstes/letztes
// Klammer-Paar zu. content = Text der Assistant-Antwort.
function extractJSON(text) {
    if (!text) throw new Error('leere_antwort');
    let t = String(text).trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    // erstes { oder [ bis letztes } oder ]
    const firstObj = t.indexOf('{');
    const firstArr = t.indexOf('[');
    let start = firstObj;
    if (firstArr !== -1 && (firstArr < firstObj || firstObj === -1)) start = firstArr;
    const lastObj = t.lastIndexOf('}');
    const lastArr = t.lastIndexOf(']');
    const end = Math.max(lastObj, lastArr);
    if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
    return JSON.parse(t);
}

async function callAnthropic({ apiKey, messages, maxTokens = 2000, system }) {
    if (!apiKey) throw new Error('missing_api_key');
    const r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
    });
    if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Anthropic ${r.status}: ${txt}`);
    }
    const data = await r.json();
    return (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
}

// Parst einen Kassenbon (PDF als base64) → Array von Inventar-Items.
async function parseReceipt({ apiKey, base64Pdf }) {
    if (!base64Pdf) throw new Error('missing_pdf');
    const system = `Du bist ein präziser Parser für deutsche Kassenbons (Supermarkt/Discounter).
Extrahiere JEDE gekaufte Lebensmittel-Position. Ignoriere Pfand-Rückgaben, Rabatt-Zeilen, Summen, Steuern.
Schätze sinnvolle Menge + Einheit (z.B. "1.5 kg", "500 g", "1 l", "6 Stk"). Wenn Menge unklar: qty 1, unit "Stk".
Preis = Endpreis der Position in Euro (Zahl). Erkenne MHD nur, wenn explizit aufgedruckt (sonst null).`;
    const userText = `Hier ist ein Kassenbon als PDF. Gib NUR ein JSON-Array zurück, keine Erklärung. Schema pro Position:
{ "name": string, "qty": number, "unit": string, "price": number, "expiryDate": string|null (YYYY-MM-DD) }`;
    const messages = [
        {
            role: 'user',
            content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
                { type: 'text', text: userText },
            ],
        },
    ];
    const text = await callAnthropic({ apiKey, messages, maxTokens: 3000, system });
    const parsed = extractJSON(text);
    const arr = Array.isArray(parsed) ? parsed : parsed.items || [];
    return arr
        .filter((i) => i && i.name)
        .map((i) => ({
            name: String(i.name).trim(),
            qty: Number(i.qty) || 1,
            unit: String(i.unit || 'Stk').trim(),
            price: i.price === null || i.price === undefined ? null : Number(i.price) || 0,
            expiryDate: i.expiryDate || null,
        }));
}

// Generiert einen Rezeptvorschlag aus Inventar + Makroziel + Trainingstag.
async function generateRecipe({ apiKey, inventory = [], macroTarget = {}, trainingLabel = '', servings = 1, mealType = '' }) {
    const invList = inventory.length
        ? inventory.map((i) => `- ${i.name}: ${i.qty} ${i.unit}`).join('\n')
        : '(Inventar leer)';
    const mt = macroTarget || {};
    const system = `Du bist Oles Ernährungs-Coach (Ausdauerathlet, 72kg, Marathon-Training).
Erstelle EIN konkretes, alltagstaugliches Rezept, das das Makroziel der Mahlzeit möglichst trifft und vorrangig vorhandenes Inventar nutzt.
Zutaten, die NICHT im Inventar sind, gehören in "missing".
Nutze realistische Mengen und gib die geschätzten Gesamt-Makros des Rezepts (für alle Portionen zusammen) an.
Antworte deutsch, knapp.`;
    const userText = `INVENTAR:
${invList}

TAGES-KONTEXT: ${trainingLabel || 'kein Trainingstag-Kontext'}${mealType ? ` · Mahlzeit: ${mealType}` : ''}
MAKROZIEL (für ${servings} Portion${servings > 1 ? 'en' : ''}): ${mt.kcal ?? '?'} kcal, ${mt.protein ?? '?'}g Protein, ${mt.carbs ?? '?'}g Carbs, ${mt.fat ?? '?'}g Fett

Gib NUR JSON zurück, Schema:
{
  "title": string,
  "servings": ${servings},
  "ingredients": [ { "name": string, "qty": number, "unit": string, "inInventory": boolean } ],
  "missing": [ string ],
  "steps": [ string ],
  "macros": { "kcal": number, "protein": number, "carbs": number, "fat": number }
}`;
    const messages = [{ role: 'user', content: userText }];
    const text = await callAnthropic({ apiKey, messages, maxTokens: 2000, system });
    const parsed = extractJSON(text);
    return {
        title: String(parsed.title || 'Rezept'),
        servings: Number(parsed.servings) || servings,
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
        missing: Array.isArray(parsed.missing) ? parsed.missing : [],
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        macros: parsed.macros || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    };
}

// Generiert einen Tagesplan (Frühstück/Mittag/Abend/Snack) aus Inventar +
// Tagesziel + bereits gegessenen Makros.
async function generateDayPlan({ apiKey, inventory = [], macroTarget = {}, trainingLabel = '', alreadyEaten = null }) {
    const invList = inventory.length
        ? inventory.map((i) => `- ${i.name}: ${i.qty} ${i.unit}`).join('\n')
        : '(Inventar leer)';
    const mt = macroTarget || {};
    const eaten = alreadyEaten
        ? `Bereits gegessen: ${alreadyEaten.kcal} kcal, ${alreadyEaten.protein}g P, ${alreadyEaten.carbs}g K, ${alreadyEaten.fat}g F`
        : 'Noch nichts gegessen heute.';
    const remaining = alreadyEaten
        ? `Verbleibend: ${Math.max(0,(mt.kcal||0)-(alreadyEaten.kcal||0))} kcal, ${Math.max(0,(mt.protein||0)-(alreadyEaten.protein||0))}g P, ${Math.max(0,(mt.carbs||0)-(alreadyEaten.carbs||0))}g K, ${Math.max(0,(mt.fat||0)-(alreadyEaten.fat||0))}g F`
        : `Tagesziel: ${mt.kcal ?? '?'} kcal, ${mt.protein ?? '?'}g P, ${mt.carbs ?? '?'}g K, ${mt.fat ?? '?'}g F`;

    const system = `Du bist Oles Ernährungs-Coach (Ausdauerathlet, 72kg, Marathon-Training).
Erstelle einen praktischen Tagesernährungsplan mit 3–4 Mahlzeiten, der das Makroziel trifft.
Nutze vorrangig verfügbares Inventar. Zutaten außerhalb des Inventars in "missing" angeben.
Antworte deutsch, knapp. Mahlzeiten realistisch und schnell zuzubereiten.`;

    const userText = `INVENTAR:
${invList}

TRAININGSTAG: ${trainingLabel || 'kein Kontext'}
${eaten}
${remaining}

Gib NUR JSON zurück. Schema:
{
  "meals": [
    {
      "type": "Frühstück" | "Mittagessen" | "Abendessen" | "Snack",
      "title": string,
      "ingredients": [ { "name": string, "qty": number, "unit": string, "inInventory": boolean } ],
      "missing": [ string ],
      "macros": { "kcal": number, "protein": number, "carbs": number, "fat": number },
      "prep": string
    }
  ]
}`;

    const messages = [{ role: 'user', content: userText }];
    const text = await callAnthropic({ apiKey, messages, maxTokens: 3000, system });
    const parsed = extractJSON(text);
    const meals = Array.isArray(parsed.meals) ? parsed.meals : [];
    return {
        meals: meals.map((m) => ({
            type: String(m.type || 'Mahlzeit'),
            title: String(m.title || 'Mahlzeit'),
            ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
            missing: Array.isArray(m.missing) ? m.missing : [],
            macros: m.macros || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            prep: String(m.prep || ''),
        })),
    };
}

module.exports = { parseReceipt, generateRecipe, generateDayPlan };
