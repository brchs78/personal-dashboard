// OLE OS — Strava OAuth 2.0 (Loopback Flow)
// - startConnect() spawnt einen lokalen HTTP-Server, öffnet Strava-Authorize-URL im Browser.
// - Strava redirects mit ?code → wir tauschen Code gegen Access+Refresh Token.
// - refreshAccessToken() rotiert Tokens automatisch wenn der access_token <5min Gültigkeit hat.

const { shell } = require('electron');
const http = require('http');

const SCOPES = 'read,activity:read_all';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';

function buildAuthorizeUrl(clientId, redirectUri) {
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        approval_prompt: 'auto',
        scope: SCOPES,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
}

// Spawnt loopback-server, gibt Promise mit { code, scope } zurück sobald Strava redirected.
function awaitCallback(port) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${port}`);
            if (url.pathname !== '/callback') {
                res.writeHead(404); res.end('Not found'); return;
            }
            const code = url.searchParams.get('code');
            const scope = url.searchParams.get('scope');
            const error = url.searchParams.get('error');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><meta charset="utf-8"><title>OLE OS</title>
<style>body{background:#0a0d1a;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:rgba(255,255,255,0.05);border:1px solid rgba(199,26,211,0.2);padding:32px 40px;border-radius:16px;text-align:center}
h1{margin:0 0 8px;background:linear-gradient(135deg,#c026d3,#6366f1);-webkit-background-clip:text;background-clip:text;color:transparent;font-size:24px}
p{margin:0;color:rgba(255,255,255,0.6)}</style>
<div class="card"><h1>${error ? 'Fehler' : 'Strava verbunden ✓'}</h1>
<p>${error ? error : 'Du kannst dieses Tab schließen und zur App zurückkehren.'}</p></div>`);

            // Server schließen nachdem Response raus ist
            setImmediate(() => server.close());

            if (error) reject(new Error(`Strava authorize error: ${error}`));
            else if (code) resolve({ code, scope });
            else reject(new Error('No code in callback'));
        });

        server.on('error', reject);
        server.listen(port, '127.0.0.1');
    });
}

async function exchangeCode(clientId, clientSecret, code) {
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
        }),
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
    return await res.json();
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
    return await res.json();
}

// Vollständiger Connect-Flow: Server starten, Browser öffnen, Code abwarten, Token tauschen
async function startConnect({ clientId, clientSecret, port = 8472 }) {
    const redirectUri = `http://localhost:${port}/callback`;
    const callbackPromise = awaitCallback(port);
    const authUrl = buildAuthorizeUrl(clientId, redirectUri);
    await shell.openExternal(authUrl);
    const { code } = await callbackPromise;
    const tokens = await exchangeCode(clientId, clientSecret, code);
    return tokens; // { access_token, refresh_token, expires_at, athlete: { ... } }
}

module.exports = { startConnect, refreshAccessToken };
