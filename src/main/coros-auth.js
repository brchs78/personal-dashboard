// OLE OS — COROS MCP OAuth (OAuth 2.1 + PKCE + Dynamic Client Registration)
// Implementiert den OAuthClientProvider des @modelcontextprotocol/sdk gegen
// coros-store (verschlüsselte Persistenz) + einen Loopback-HTTP-Server, der
// den Authorization-Code aus dem Browser-Redirect abfängt (Muster: strava-auth.js).

const { shell } = require('electron');
const http = require('http');
const store = require('./coros-store.js');

const REDIRECT_PORT = 8473; // Strava nutzt 8472
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

// Loopback-Server: liefert Promise mit dem ?code sobald COROS zurück-redirectet.
function startCallbackServer() {
    let resolveCode, rejectCode;
    const codePromise = new Promise((res, rej) => { resolveCode = res; rejectCode = rej; });

    const server = http.createServer((req, res) => {
        const url = new URL(req.url, REDIRECT_URI);
        if (url.pathname !== '/callback') {
            res.writeHead(404); res.end('Not found'); return;
        }
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>OLE OS</title>
<style>body{background:#0a0d1a;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:rgba(255,255,255,0.05);border:1px solid rgba(199,26,211,0.2);padding:32px 40px;border-radius:16px;text-align:center}
h1{margin:0 0 8px;background:linear-gradient(135deg,#c026d3,#6366f1);-webkit-background-clip:text;background-clip:text;color:transparent;font-size:24px}
p{margin:0;color:rgba(255,255,255,0.6)}</style>
<div class="card"><h1>${error ? 'Fehler' : 'COROS verbunden ✓'}</h1>
<p>${error ? error : 'Du kannst dieses Tab schließen und zur App zurückkehren.'}</p></div>`);

        setImmediate(() => server.close());

        if (error) rejectCode(new Error(`COROS authorize error: ${error}`));
        else if (code) resolveCode(code);
        else rejectCode(new Error('No code in callback'));
    });

    server.on('error', rejectCode);
    server.listen(REDIRECT_PORT, '127.0.0.1');

    return {
        codePromise,
        close: () => { try { server.close(); } catch {} },
    };
}

// OAuthClientProvider-Implementierung (SDK-Interface).
function createAuthProvider() {
    return {
        get redirectUrl() { return REDIRECT_URI; },
        get clientMetadata() {
            return {
                client_name: 'OLE OS',
                redirect_uris: [REDIRECT_URI],
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
                token_endpoint_auth_method: 'none',
            };
        },
        clientInformation() { return store.loadOAuth().clientInformation; },
        saveClientInformation(info) { store.saveOAuthField('clientInformation', info); },
        tokens() { return store.loadOAuth().tokens; },
        saveTokens(tokens) { store.saveOAuthField('tokens', tokens); },
        saveCodeVerifier(verifier) { store.saveOAuthField('codeVerifier', verifier); },
        codeVerifier() {
            const v = store.loadOAuth().codeVerifier;
            if (!v) throw new Error('no_code_verifier');
            return v;
        },
        // Wird vom SDK während connect() aufgerufen → Browser öffnen.
        redirectToAuthorization(authorizationUrl) {
            shell.openExternal(authorizationUrl.toString());
        },
        invalidateCredentials(scope) {
            if (scope === 'all') { store.clearOAuth(); return; }
            const blob = store.loadOAuth();
            if (scope === 'tokens') delete blob.tokens;
            else if (scope === 'verifier') delete blob.codeVerifier;
            else if (scope === 'client') delete blob.clientInformation;
            store.saveOAuth(blob);
        },
    };
}

module.exports = { createAuthProvider, startCallbackServer, REDIRECT_URI, REDIRECT_PORT };
