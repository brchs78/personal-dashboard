// OLE OS — Zentrale Konstanten (Main-Process)
// Einzige Quelle für Anthropic-Endpoint/Model/Version + Marathon-Ziel.
// Renderer hat ein eigenes Spiegel-Modul (src/renderer/src/lib/constants.js),
// da Main (CJS) und Renderer (ESM) getrennte Bundles sind.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-5';

const MARATHON_DATE = '2026-10-11';
const MARATHON_LOCATION = 'München';
const TARGET_TIME = '3:10';
const TARGET_PACE = '4:30/km';

module.exports = {
    ANTHROPIC_URL,
    ANTHROPIC_VERSION,
    MODEL,
    MARATHON_DATE,
    MARATHON_LOCATION,
    TARGET_TIME,
    TARGET_PACE,
};
