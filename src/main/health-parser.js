// OLE OS — Apple Health Streaming-Parser
// Liest Export.xml im SAX-Modus (kein DOM), filtert Phase-1-Types,
// aggregiert in Tages-Buckets. Designed für 700+ MB Inputs.
//
// Phase 1 Scope:
//   - Sleep Stages (Awake/REM/Core/Deep)
//   - Resting Heart Rate
//   - HRV (SDNN)
//   - Heart Rate Recovery (1 min)
//   - Walking HR Average

const fs = require('fs');
const sax = require('sax');

// Whitelist — alles andere wird beim Streamen verworfen
const KEEP_TYPES = new Set([
    'HKCategoryTypeIdentifierSleepAnalysis',
    'HKQuantityTypeIdentifierRestingHeartRate',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute',
    'HKQuantityTypeIdentifierWalkingHeartRateAverage',
]);

// Sleep-Stage Mapping (Apple → kurz)
const SLEEP_STAGE_MAP = {
    HKCategoryValueSleepAnalysisAwake: 'awake',
    HKCategoryValueSleepAnalysisAsleepREM: 'rem',
    HKCategoryValueSleepAnalysisAsleepCore: 'core',
    HKCategoryValueSleepAnalysisAsleepDeep: 'deep',
    // HKCategoryValueSleepAnalysisInBed: ignorieren — überlappt mit Stages
    // HKCategoryValueSleepAnalysisAsleepUnspecified: legacy, ignorieren
};

// Source-Priorität bei Dubletten (höher = bevorzugt)
const SOURCE_PRIO = {
    'Apple Watch von Ole': 100,
    'Schlaf': 90,
    'Health': 80,
    'iPhone von Ole': 50,
    'iPhone von Ole (2)': 50,
    'iPhone': 40,
    'Strava': 30,
    'Runna': 30,
    'Komoot': 30,
    'GymKit': 20,
};
function srcPrio(name) {
    return SOURCE_PRIO[name] ?? 10;
}

// "2026-05-30T07:21:00+0200" → "2026-05-30"
function dateKey(iso) {
    return iso.slice(0, 10);
}

// Sleep-Tag = Aufwach-Datum (endDate), nicht startDate
function sleepDayKey(endIso) {
    return dateKey(endIso);
}

function ensureDay(days, key) {
    if (!days[key]) {
        days[key] = {
            rhr: { sum: 0, n: 0, src: null },
            hrv: { sum: 0, n: 0, src: null },
            hrRecovery1min: { sum: 0, n: 0, src: null },
            walkingHrAvg: { sum: 0, n: 0, src: null },
            sleep: {
                stages: { awake: 0, rem: 0, core: 0, deep: 0 },
                start: null,
                end: null,
                src: null,
            },
        };
    }
    return days[key];
}

function addQuantity(bucket, value, sourceName) {
    // Bei mehreren Sources pro Tag: behalte die höher-priorisierte
    const prio = srcPrio(sourceName);
    if (bucket.src == null) {
        bucket.src = sourceName;
        bucket.sum = value;
        bucket.n = 1;
        return;
    }
    if (srcPrio(bucket.src) === prio) {
        bucket.sum += value;
        bucket.n += 1;
        return;
    }
    if (prio > srcPrio(bucket.src)) {
        bucket.src = sourceName;
        bucket.sum = value;
        bucket.n = 1;
    }
    // niedrigere Source: ignorieren
}

function minutesBetween(startIso, endIso) {
    return Math.max(0, (new Date(endIso) - new Date(startIso)) / 60000);
}

/**
 * @param {string} xmlPath
 * @param {object} [opts]
 * @param {(percent:number)=>void} [opts.onProgress]
 * @returns {Promise<Aggregates>}
 */
function parseHealthExport(xmlPath, opts = {}) {
    return new Promise((resolve, reject) => {
        const t0 = Date.now();
        let totalBytes = 0;
        try {
            totalBytes = fs.statSync(xmlPath).size;
        } catch (e) {
            return reject(e);
        }

        const meta = {
            exportDate: null,
            recordsScanned: 0,
            recordsKept: 0,
            parseMs: 0,
            lastExportMtime: fs.statSync(xmlPath).mtimeMs,
            bytes: totalBytes,
        };
        const days = {};

        const parser = sax.createStream(true, { trim: true });
        let bytesRead = 0;
        let lastProgress = 0;

        parser.on('opentag', (node) => {
            const a = node.attributes;

            if (node.name === 'ExportDate') {
                meta.exportDate = a.value;
                return;
            }

            if (node.name !== 'Record') return;
            meta.recordsScanned++;

            const type = a.type;
            if (!KEEP_TYPES.has(type)) return;

            meta.recordsKept++;
            const source = a.sourceName || '';

            // Sleep ist Category, value ist String wie "HKCategoryValueSleepAnalysisAsleepCore"
            if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
                const stage = SLEEP_STAGE_MAP[a.value];
                if (!stage) return;
                const key = sleepDayKey(a.endDate);
                const day = ensureDay(days, key);
                // Source-Prio: erste Source pro Tag setzt den Lead, andere ignorieren
                if (day.sleep.src == null) day.sleep.src = source;
                if (srcPrio(source) < srcPrio(day.sleep.src)) return;
                if (srcPrio(source) > srcPrio(day.sleep.src)) {
                    // höhere Source kommt rein → reset
                    day.sleep = {
                        stages: { awake: 0, rem: 0, core: 0, deep: 0 },
                        start: null, end: null, src: source,
                    };
                }
                day.sleep.stages[stage] += minutesBetween(a.startDate, a.endDate);
                if (!day.sleep.start || a.startDate < day.sleep.start) day.sleep.start = a.startDate;
                if (!day.sleep.end   || a.endDate   > day.sleep.end)   day.sleep.end   = a.endDate;
                return;
            }

            // Quantity types
            const v = parseFloat(a.value);
            if (!Number.isFinite(v)) return;
            const key = dateKey(a.startDate);
            const day = ensureDay(days, key);

            if (type === 'HKQuantityTypeIdentifierRestingHeartRate')                addQuantity(day.rhr,            v, source);
            else if (type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN')   addQuantity(day.hrv,            v, source);
            else if (type === 'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute') addQuantity(day.hrRecovery1min, v, source);
            else if (type === 'HKQuantityTypeIdentifierWalkingHeartRateAverage')    addQuantity(day.walkingHrAvg,   v, source);
        });

        parser.on('error', (err) => {
            // sax wirft bei nicht-fatalen Issues — wir versuchen weiterzulesen
            parser._parser.error = null;
            parser._parser.resume();
        });

        parser.on('end', () => {
            meta.parseMs = Date.now() - t0;

            // Buckets → finale Werte (avg) + latest
            const finalDays = {};
            const latest = { rhr: null, hrv: null, hrRecovery: null, sleep: null, walkingHr: null };

            const keys = Object.keys(days).sort(); // ISO yyyy-mm-dd sortiert chronologisch
            for (const k of keys) {
                const d = days[k];
                const out = {};
                if (d.rhr.n)            out.rhr            = { avg: d.rhr.sum / d.rhr.n,                       n: d.rhr.n };
                if (d.hrv.n)            out.hrv            = { avg: d.hrv.sum / d.hrv.n,                       n: d.hrv.n };
                if (d.hrRecovery1min.n) out.hrRecovery1min = { avg: d.hrRecovery1min.sum / d.hrRecovery1min.n, n: d.hrRecovery1min.n };
                if (d.walkingHrAvg.n)   out.walkingHrAvg   = { avg: d.walkingHrAvg.sum / d.walkingHrAvg.n,     n: d.walkingHrAvg.n };

                const s = d.sleep;
                const stagesTotal = s.stages.awake + s.stages.rem + s.stages.core + s.stages.deep;
                if (stagesTotal > 0) {
                    out.sleep = {
                        totalMin: stagesTotal,
                        stages: s.stages,
                        start: s.start,
                        end: s.end,
                    };
                }
                if (Object.keys(out).length) finalDays[k] = out;
            }

            // Latest pro Metrik (jüngster Tag mit Wert)
            for (let i = keys.length - 1; i >= 0; i--) {
                const k = keys[i];
                const d = finalDays[k];
                if (!d) continue;
                if (!latest.rhr        && d.rhr)            latest.rhr        = { value: d.rhr.avg,            date: k };
                if (!latest.hrv        && d.hrv)            latest.hrv        = { value: d.hrv.avg,            date: k };
                if (!latest.hrRecovery && d.hrRecovery1min) latest.hrRecovery = { value: d.hrRecovery1min.avg, date: k };
                if (!latest.walkingHr  && d.walkingHrAvg)   latest.walkingHr  = { value: d.walkingHrAvg.avg,   date: k };
                if (!latest.sleep      && d.sleep)          latest.sleep      = { ...d.sleep, date: k };
                if (latest.rhr && latest.hrv && latest.hrRecovery && latest.walkingHr && latest.sleep) break;
            }

            resolve({ meta, days: finalDays, latest });
        });

        const stream = fs.createReadStream(xmlPath, { highWaterMark: 1024 * 1024 });
        stream.on('data', (chunk) => {
            bytesRead += chunk.length;
            if (opts.onProgress) {
                const pct = Math.min(99, Math.floor((bytesRead / totalBytes) * 100));
                if (pct > lastProgress) {
                    lastProgress = pct;
                    opts.onProgress(pct);
                }
            }
        });
        stream.on('error', reject);
        stream.pipe(parser);
    });
}

module.exports = { parseHealthExport, KEEP_TYPES, SLEEP_STAGE_MAP };
