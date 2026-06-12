// OLE OS — Küchen-KI
// Anthropic-Calls: Kassenbon-PDF parsen + Rezeptvorschlag generieren.
// Main-seitig (wie coach-plan.js), API-Key kommt aus dem Renderer.

const { ANTHROPIC_URL, ANTHROPIC_VERSION, MODEL } = require('./constants.js');
const { fetchWithRetry } = require('./utils/anthropic-fetch.js');

// Festes Ernährungsprofil — gilt für ALLE Rezept-/Tagesplan-Vorschläge.
const DIET_PROFILE = `ERNÄHRUNGS-PROFIL (IMMER strikt beachten):
- Vegetarisch: KEIN Fleisch, KEIN Fisch, KEINE Meeresfrüchte. Eier, Milchprodukte, Käse sind erlaubt.
- Günstig einkaufen: bevorzuge preiswerte Grundzutaten (Hülsenfrüchte, Eier, Haferflocken, Reis, Nudeln, Kartoffeln, Quark/Skyr, Tofu, saisonales Gemüse, Tiefkühlgemüse). Vermeide teure Spezial- oder Convenience-Produkte.
- KEIN Ofen verfügbar: Zubereitung NUR mit Herd (Pfanne/Topf), Mikrowelle oder ganz ohne Kochen. NIEMALS Backofen, Backen, Überbacken, Grill oder Rösten im Ofen voraussetzen.`;

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
    const r = await fetchWithRetry(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
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
${DIET_PROFILE}
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
${DIET_PROFILE}
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

// Generiert einen Meal-Prep-Plan: 1–2 Batch-Gerichte, die über mehrere Tage
// portioniert werden, + Tageszuordnung (pro Trainingstag) + Einkaufsliste.
// days: [{ date, label, macroTarget:{kcal,protein,carbs,fat} }]
async function generatePrepPlan({ apiKey, inventory = [], days = [], mealTypes = [] }) {
    if (!days.length) throw new Error('missing_days');
    const invList = inventory.length
        ? inventory.map((i) => `- ${i.name}: ${i.qty} ${i.unit}`).join('\n')
        : '(Inventar leer)';
    const dayList = days.map((d) =>
        `- ${d.date} (${d.label}): pro Mahlzeit-Anteil je nach Mahlzeit, Tagesziel ${d.macroTarget?.kcal ?? '?'} kcal / P${d.macroTarget?.protein ?? '?'} K${d.macroTarget?.carbs ?? '?'} F${d.macroTarget?.fat ?? '?'}`
    ).join('\n');
    const meals = mealTypes.length ? mealTypes.join(', ') : 'Mittagessen, Abendessen';

    const system = `Du bist Oles Ernährungs-Coach (Ausdauerathlet, 72kg, Marathon-Training).
${DIET_PROFILE}
Plane MEAL-PREP: Erstelle 1–2 Batch-Gerichte, die sich gut vorkochen, kühlen/portionieren lassen und über die Tage skalieren.
Verteile die Portionen auf die genannten Tage und Mahlzeiten. Pro Trainingstag mehr Kohlenhydrate an harten/langen Tagen, weniger an Ruhetagen.
Nutze vorrangig vorhandenes Inventar. Was fehlt, kommt in die Einkaufsliste — günstig und mengen-realistisch.
Antworte deutsch, knapp und praktisch.`;

    const userText = `INVENTAR:
${invList}

PREP FÜR DIESE TAGE:
${dayList}

ZU PREPPENDE MAHLZEITEN: ${meals}

Gib NUR JSON zurück. Schema:
{
  "batches": [
    {
      "title": string,
      "portions": number,
      "ingredients": [ { "name": string, "qty": number, "unit": string, "inInventory": boolean } ],
      "steps": [ string ],
      "macrosPerPortion": { "kcal": number, "protein": number, "carbs": number, "fat": number }
    }
  ],
  "schedule": [
    { "date": "YYYY-MM-DD", "mealType": string, "batch": string, "portions": number, "macros": { "kcal": number, "protein": number, "carbs": number, "fat": number } }
  ],
  "shoppingList": [ { "name": string, "qty": number, "unit": string, "estPrice": number|null } ]
}`;

    const messages = [{ role: 'user', content: userText }];
    const text = await callAnthropic({ apiKey, messages, maxTokens: 4000, system });
    const p = extractJSON(text);
    return {
        batches: (Array.isArray(p.batches) ? p.batches : []).map((b) => ({
            title: String(b.title || 'Gericht'),
            portions: Number(b.portions) || 1,
            ingredients: Array.isArray(b.ingredients) ? b.ingredients : [],
            steps: Array.isArray(b.steps) ? b.steps : [],
            macrosPerPortion: b.macrosPerPortion || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        })),
        schedule: (Array.isArray(p.schedule) ? p.schedule : []).map((s) => ({
            date: String(s.date || ''),
            mealType: String(s.mealType || 'Mahlzeit'),
            batch: String(s.batch || ''),
            portions: Number(s.portions) || 1,
            macros: s.macros || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        })),
        shoppingList: (Array.isArray(p.shoppingList) ? p.shoppingList : []).map((i) => ({
            name: String(i.name || ''),
            qty: Number(i.qty) || 1,
            unit: String(i.unit || 'Stk'),
            estPrice: i.estPrice === null || i.estPrice === undefined ? null : Number(i.estPrice) || null,
        })),
    };
}

// Schätzt Makros einer gegessenen Mahlzeit aus freier Text-Beschreibung.
// Ole tippt nur, WAS er gegessen hat — die KI schätzt kcal/Protein/Carbs/Fett.
async function estimateMeal({ apiKey, description, mealType = '' }) {
    if (!description || !String(description).trim()) throw new Error('missing_description');
    const system = `Du schätzt Nährwerte gegessener Mahlzeiten für einen Ausdauerathleten (72kg).
Aus einer kurzen Beschreibung schätzt du realistische Gesamt-Makros der gegessenen Portion.
Fehlen Mengenangaben, nimm typische Portionsgrößen an. Sei realistisch, nicht zu niedrig.
Antworte NUR mit JSON, keine Erklärung.`;
    const userText = `Gegessene Mahlzeit${mealType ? ` (${mealType})` : ''}: "${String(description).trim()}"

Gib NUR JSON zurück. Schema:
{ "name": string (kurzer, sauberer Mahlzeit-Name), "kcal": number, "protein": number, "carbs": number, "fat": number }`;
    const messages = [{ role: 'user', content: userText }];
    const text = await callAnthropic({ apiKey, messages, maxTokens: 500, system });
    const p = extractJSON(text);
    return {
        name: String(p.name || String(description).trim()),
        kcal: Math.round(Number(p.kcal) || 0),
        protein: Math.round(Number(p.protein) || 0),
        carbs: Math.round(Number(p.carbs) || 0),
        fat: Math.round(Number(p.fat) || 0),
    };
}

module.exports = { parseReceipt, generateRecipe, generateDayPlan, estimateMeal, generatePrepPlan };
