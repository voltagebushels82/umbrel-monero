import http from 'node:http';

export function createRpcMock() {
  const state = {
    info: {}, peers: [], failures: new Set(), requests: [],
    reset() {
      this.info = {
        status: 'OK', height: 515055, target_height: 0, synchronized: true,
        mainnet: true, nettype: 'mainnet', difficulty: 12000,
        database_size: 1000, outgoing_connections_count: 0, version: '0.18.5.4',
      };
      this.peers = [];
      this.failures.clear();
      this.requests = [];
    },
  };
  state.reset();
  state.server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const message = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const method = message.method || req.url;
    state.requests.push(method);
    res.setHeader('Content-Type', 'application/json');
    if (state.failures.has(method)) {
      res.writeHead(500).end(JSON.stringify({error: {code: -1, message: 'Injected daemon failure'}}));
      return;
    }
    let result;
    switch (method) {
      case 'get_version': result = {status: 'OK', version: 196621, release: true}; break;
      case 'get_info': case '/get_info': result = state.info; break;
      case 'get_connections': result = {status: 'OK', connections: state.peers}; break;
      case '/get_transaction_pool_stats': result = {status: 'OK', pool_stats: {bytes_total: 0, txs_total: 0}}; break;
      default:
        res.writeHead(400).end(JSON.stringify({error: {message: `Unexpected test RPC: ${method}`}}));
        return;
    }
    res.end(JSON.stringify(message.method ? {jsonrpc: '2.0', id: message.id, result} : result));
  });
  return state;
}
