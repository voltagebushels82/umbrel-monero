import http from 'node:http';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import auth from 'http-auth';
import DigestClient from 'digest-fetch';
import {Agent, fetch} from 'undici';

// The upstream MUST be monerod's restricted listener, never its administrative RPC port.
export function createRestrictedRpcGateway({username, password, upstream, upstreamUsername, upstreamPassword}) {
  if (!username || !password || /[:\r\n]/.test(username)) throw new Error('Restricted RPC credentials are required');
  const origin = new URL(upstream);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.username || origin.password) throw new Error('Invalid restricted RPC upstream');
  const realm = 'Monero restricted RPC';
  const hash = createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const digest = auth.digest({realm, qop: 'auth', file: () => `${username}:${realm}:${hash}`});
  const forward = digest.check(async (req, res) => {
    const dispatcher = new Agent({connections: 1});
    try {
      const credentials = digest.parseAuthorization(req.headers.authorization || '');
      if (credentials?.uri !== req.url || credentials?.qop !== 'auth' || credentials?.realm !== realm) {
        res.writeHead(401).end(); return;
      }
      if (!['GET', 'POST'].includes(req.method) || !req.url.startsWith('/') || req.url.startsWith('//')) {
        res.writeHead(400).end(); return;
      }
      const target = new URL(req.url, origin);
      if (target.origin !== origin.origin) { res.writeHead(400).end(); return; }
      const chunks = []; let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 16 * 1024 * 1024) { res.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      // Per-request clients avoid sharing digest nonce counters between concurrent requests.
      const client = new DigestClient(upstreamUsername, upstreamPassword);
      // Monerod binds a digest nonce to its TCP connection. Drain the challenge
      // before retrying, and keep both requests on the same connection.
      client.getClient = async () => async (url, options) => {
        const response = await fetch(url, {...options, dispatcher});
        if (response.status === 401) await response.arrayBuffer();
        return response;
      };
      const response = await client.fetch(target.href, {
        method: req.method,
        headers: {'content-type': req.headers['content-type'] || 'application/json'},
        body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        redirect: 'manual', signal: AbortSignal.timeout(30000),
      });
      // Never expose upstream authentication challenges or follow redirects with administrative credentials.
      if (response.status === 401 || response.status >= 300 && response.status < 400) {
        if (!response.bodyUsed) await response.body?.cancel(); res.writeHead(502).end(); return;
      }
      res.writeHead(response.status, {'content-type': response.headers.get('content-type') || 'application/octet-stream'});
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    } finally {
      await dispatcher.destroy();
    }
  });
  const server = http.createServer((req, res) => {
    // Bound unauthenticated challenge memory and nonce lifetime.
    digest.nonces = digest.nonces.filter(nonce => nonce[1] > Date.now() - 300000).slice(-1000);
    forward(req, res);
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  return server;
}

export function startRestrictedRpcGateway(env = process.env) {
  if (!env.MONERO_RESTRICTED_RPC_PASSWORD) return;
  const port = Number(env.MONERO_RESTRICTED_GATEWAY_PORT || 18090);
  const upstreamPort = Number(env.MONERO_RESTRICTED_RPC_PORT || 18089);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65535 || upstreamPort === Number(env.MONERO_RPC_PORT || 18081)) throw new Error('Restricted RPC must use a separate valid upstream port');
  const server = createRestrictedRpcGateway({
    username: env.MONERO_RESTRICTED_RPC_USER || 'monero', password: env.MONERO_RESTRICTED_RPC_PASSWORD,
    upstream: `http://${env.MONERO_HOST || '127.0.0.1'}:${upstreamPort}`,
    upstreamUsername: env.MONERO_RPC_USER || 'monero', upstreamPassword: env.MONERO_RPC_PASSWORD || 'monero',
  });
  server.listen(port, env.MONERO_RESTRICTED_GATEWAY_HOST || '127.0.0.1');
  server.on('error', error => { console.error('Restricted RPC gateway failed:', error.message); process.exitCode = 1; });
  return server;
}
