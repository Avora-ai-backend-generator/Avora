const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { createHash } = require('node:crypto');
const { browserLogin, refreshNativeSession, revokeNativeSession, normalizeAuthBase } = require('../dist/browserAuth');

async function serverFixture(t) {
  let base;
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    requests.push({ path: req.url, body: raw });
    res.setHeader('Content-Type', 'application/json');
    const send = value => res.end(JSON.stringify(value));
    if (req.url === '/.well-known/oauth-authorization-server') return send({ issuer: base, native_api_resource: `${base}/api/v1`, authorization_endpoint: `${base}/oauth/authorize`, token_endpoint: `${base}/oauth/token`, registration_endpoint: `${base}/oauth/register` });
    if (req.url === '/oauth/register') return send({ client_id: 'cli-client' });
    if (req.url === '/oauth/token') return send({ token_type: 'bearer', access_token: 'access-private', refresh_token: 'refresh-private', expires_in: 900 });
    if (req.url === '/oauth/revoke') return send({});
    res.writeHead(404).end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { base, requests };
}

test('PKCE browser round trip validates state and issuer, rotates and revokes', async t => {
  const { base, requests } = await serverFixture(t);
  let authorization, callback;
  const session = await browserLogin({ apiBaseUrl: `${base}/api/v1`, clientName: 'Avora CLI', openBrowser: async address => {
    authorization = new URL(address);
    callback = new URL(authorization.searchParams.get('redirect_uri'));
    callback.searchParams.set('code', 'one-use-code');
    callback.searchParams.set('iss', base);
    callback.searchParams.set('state', 'wrong-state');
    assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    callback.searchParams.set('iss', 'https://wrong.example');
    assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set('iss', base);
    const response = await fetch(callback);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /access-private|refresh-private|one-use-code/);
  } });
  const exchange = new URLSearchParams(requests.find(r => r.path === '/oauth/token').body);
  assert.equal(createHash('sha256').update(exchange.get('code_verifier')).digest('base64url'), authorization.searchParams.get('code_challenge'));
  assert.equal(exchange.get('resource'), `${base}/api/v1`);
  assert.equal(exchange.get('redirect_uri'), authorization.searchParams.get('redirect_uri'));
  assert.equal(session.apiBaseUrl, base);
  assert.ok(session.expiresAt > Date.now());
  await assert.rejects(fetch(callback)); // Listener was closed after login.
  const renewed = await refreshNativeSession(session);
  await revokeNativeSession(renewed);
  assert.equal(new URLSearchParams(requests.filter(r => r.path === '/oauth/token')[1].body).get('grant_type'), 'refresh_token');
  assert.equal(requests.at(-1).path, '/oauth/revoke');
});

test('denial, cancellation and timeout never exchange a code or leave a listener', async t => {
  for (const mode of ['denied', 'cancel', 'timeout']) {
    const { base, requests } = await serverFixture(t);
    const controller = new AbortController();
    let callback;
    await assert.rejects(browserLogin({ apiBaseUrl: base, clientName: 'Avora VS Code', signal: controller.signal, timeoutMs: mode === 'timeout' ? 200 : 2000,
      openBrowser: async address => {
        const url = new URL(address);
        callback = new URL(url.searchParams.get('redirect_uri'));
        if (mode === 'cancel') { controller.abort(); return; }
        if (mode === 'timeout') return;
        callback.searchParams.set('state', url.searchParams.get('state'));
        callback.searchParams.set('iss', base);
        callback.searchParams.set('error', 'access_denied');
        await fetch(callback);
      },
    }), /cancel|timed out|aborted/i);
    assert.ok(!requests.some(r => r.path === '/oauth/token'));
    if (callback) await assert.rejects(fetch(callback));
  }
});

test('credentials cannot follow an insecure or different server URL', async () => {
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/?token=secret']) assert.throws(() => normalizeAuthBase(url));
  await assert.rejects(refreshNativeSession({ apiBaseUrl: 'https://example.com', issuer: 'https://other.example', resource: 'https://example.com/api/v1' }), /changed/);
});
