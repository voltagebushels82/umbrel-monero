<p align="center">
  <a href="https://umbrel.com">
    <img src="https://raw.githubusercontent.com/deverickapollo/umbrel-monero/6c34c9fd4fd98208d1f71172737a2b2a16a651f2/pictures/Monero%20Dashboard.png" alt="Logo">
  </a>
  <h1 align="center">Monero Node for Umbrel</h1>
  <p align="center">
    Run a Monero node on your Umbrel personal server. An unofficial app by @deverickapollo and @CryptoGrampy
    <br />
    <a href="https://getmonero.org"><strong>getmonero.org »</strong></a>
    <br />
    <br />
    <a href="https://twitter.com/monero">
      <img src="https://img.shields.io/twitter/follow/Monero?style=social" />
    </a>
    <a href="https://telegram.me/monero">
      <img src="https://img.shields.io/badge/community-chat-%235351FB">
    </a>
    <a href="https://reddit.com/r/Monero">
      <img src="https://img.shields.io/reddit/subreddit-subscribers/monero?style=social">
    </a>
    <a href="https://github.com/monero-project/monero/issues">
      <img src="https://img.shields.io/badge/community-forum-%235351FB">
    </a>
  </p>
</p>

## Local development

Use Node.js 24 LTS and npm. The UI uses Vue 3, Bootstrap 5 and Vite; the API uses Express 5 and TypeScript 7.

```sh
npm ci
npm ci --prefix ui
cp .env.example .env
npm run build
npm run start:all:dev
```

Open http://localhost:5173. Vite proxies `/ping` and `/v1` to the API on port 8889. Set `MONERO_HOST`, `MONERO_RPC_PORT`, `MONERO_RPC_USER` and `MONERO_RPC_PASSWORD` in `.env` for your daemon. Re-run `npm run build` after changing TypeScript. The API stays available while the daemon is offline so settings can be repaired.

For a production build:

```sh
npm run build
npm run build:ui
npm start
```

Open http://localhost:8889. Do not create empty JSON/config files: the app creates them with valid defaults. Override paths using `JSON_STORE_FILE` and `MONERO_CONF_FILE`; do not edit source constants.

## Local containers

```sh
docker compose up --build -d
```

This builds the current checkout and starts the dashboard, monerod, Tor and i2pd with persistent named volumes. The service addresses, dashboard port 9976 inside Docker, and Tor image follow `../umbrel-apps/monero`. The local dashboard is published at http://localhost:8889. Local RPC credentials are `monero:monero`; all published ports bind to loopback. Tor and I2P are enabled by default, alongside clearnet blockchain synchronization.

Tor creates persistent RPC and P2P onion identities. i2pd creates a persistent Monero P2P destination and exposes SOCKS on port 4447, not SAM port 7656. The dashboard loads these real identities before generating the daemon configuration. A one-shot init service sets volume permissions for UID 1000; monerod, Tor and i2pd run as that user. The daemon waits for its config on first boot. Stop with `docker compose down`; volumes are retained. Normal startup downloads the blockchain.

The local network uses the same `10.21.0.0/16` address layout as the Umbrel package; do not run conflicting copies of that subnet simultaneously. Tor SOCKS (9050), I2P SOCKS (4447), and the I2P console (7070) are available only on host loopback for development checks. I2P can take several minutes to build usable tunnels. Incoming Tor/I2P peers require enabling **Incoming Connections** in Advanced Settings. Tor P2P forwards 18083 to the daemon on 18083; I2P P2P forwards to 18087. These are separate from ZMQ.

The Compose files are local examples, not Umbrel app-store manifests. For Umbrel, retain its authentication proxy, real RPC credentials, Tor services, host port mappings and persistent mounts. The dashboard has privileged settings and connection information and must remain behind that proxy.

## Settings and connections

- **Networks:** mainnet, testnet and stagenet. Saved legacy `test` settings migrate to `testnet`. Existing malformed anonymous-inbound lines containing `undefined` are regenerated on startup from saved settings.
- **Incoming peers:** Tor hidden services require a valid v3 onion hostname and the `MONERO_ONION_P2P_PORT` mapping (default 18083). The daemon binds to `0.0.0.0`, not a Docker DNS hostname. If incoming peers are disabled, UPnP and incoming clearnet peers are disabled too.
- **Tor:** `MONERO_TOR=false` disables Tor in default settings; on Umbrel the default is enabled. Configure `TOR_PROXY_IP` and `TOR_PROXY_PORT` before enabling it. The Tor peers switch only routes Tor peers/transactions. **Route clearnet peer connections through Tor** also sets the global proxy, disables direct incoming clearnet peers and daemon DNS lookups. This is daemon configuration, not a host-wide firewall; packet-level leak testing is still required for a deployment that depends on network isolation. The I2P switch enables its SOCKS proxy for I2P peers and transaction relay. Its generated P2P address appears in the Connect dialog. The clearnet proxy, Tor peers, and I2P peers switches are independent and can all be enabled together. Existing `torOnly` settings retain the clearnet-proxy behavior. Blockchain sync uses ordinary IP peers, reached directly or through Tor exits; onion/I2P peers cannot supply blocks. Enabling Tor or I2P peers automatically relays locally submitted transactions only through anonymity peers and waits when none are available; there is no separate private-broadcast switch.
- **Mining:** the dashboard shows local activity, H/s and thread count separately from network hashrate. Reward addresses are validated against the selected network. Background mining may remain idle according to daemon policy.
- **ZMQ/P2Pool:** enable ZMQ in Advanced Settings. ZMQ RPC defaults to 18082; ZMQ publish defaults to **18084**, distinct from Tor P2P port 18083. P2Pool needs the publish port. The connection dialog shows both; deployments must map them separately. ZMQ RPC is restricted but unauthenticated; expose these ports only to trusted clients.

## Separate restricted-RPC credentials

Monerod's native full and restricted listeners share `rpc-login`. This app provides an optional digest-authentication gateway with an independent wallet password. It forwards JSON and binary wallet requests only to the configured **restricted** listener; the daemon continues to enforce restricted methods.

Set `MONERO_RESTRICTED_RPC_PASSWORD` to a new password and optionally `MONERO_RESTRICTED_RPC_USER` (default `monero`). The gateway uses port 18090 by default (`MONERO_RESTRICTED_GATEWAY_PORT`), with upstream port 18089 (`MONERO_RESTRICTED_RPC_PORT`). Connection details automatically use the separate credentials and gateway port for restricted mode. Native RPC credentials remain `MONERO_RPC_USER`/`MONERO_RPC_PASSWORD`.

The gateway binds to 127.0.0.1 by default. Containers may set `MONERO_RESTRICTED_GATEWAY_HOST=0.0.0.0` and map its port; the local Compose example binds the host side to loopback. Use a trusted network, Tor, or TLS for remote access. Never point the gateway at the unrestricted listener. Restrict access to the native listeners so wallet users cannot bypass the gateway. Existing Umbrel manifests need an additional gateway port mapping to use this feature.

## Verification

```sh
npm run lint
npm test
npm run build:ui
npx playwright install chromium
npm run test:ui
npm audit
npm audit --prefix ui
docker build -t umbrel-monero:local .
```

API tests use an HTTP daemon fixture and temporary files. Browser tests exercise the dashboard, chart, dialogs, testnet selection and settings submission. `npm run test:docker:ui` runs the browser against the Docker deployment, including daemon restarts and persistence. It requires `MONERO_RESTRICTED_RPC_USER=wallet` and `MONERO_RESTRICTED_RPC_PASSWORD=local-e2e-wallet-only` in the test deployment and runner environment; use disposable volumes.

For real Tor/I2P verification, start a disposable stack with bounded download bandwidth and DNS checkpoint lookups disabled:

```sh
docker compose -p codex-monero-anon -f docker-compose.yml -f docker-compose.browser.yml up --build -d
```

Open the dashboard and enable **Incoming Connections**, keeping Tor and I2P enabled. Then run:

```sh
npm run test:anonymity
```

Set `E2E_DOCKER_SUDO=1` if Docker requires passwordless sudo. The test verifies Tor exit routing, authenticated onion RPC, and completed Tor/I2P Monero handshakes using an independent probe daemon and a second I2P router. The test removes its probe containers afterward. It requires curl, internet access, and time for I2P tunnels to form. A listening proxy alone does not count as a successful test. To remove the disposable stack and its data:

```sh
docker compose -p codex-monero-anon down --volumes
```

## Existing data and upgrades

Back up the app's configuration and blockchain data before replacing a deployment. Keep its persistent mounts and use the deployment's normal image update mechanism. Do not delete blockchain files or prune unrelated Docker resources to resolve a configuration error. The startup repair addresses the known malformed incoming-port and legacy-network settings; it does not repair a corrupt blockchain database.

## Contributing

We welcome and appreciate new contributions! Open a PR and I'll be sure to review it asap. For an bugs/feature requests, open an issue and I'll review it as my time allows.

## Acknowledgements

This app is built upon the work done by [Casa](https://github.com/casa) on its open source [API](https://github.com/Casa/Casa-Node-API) and Umbrel [umbrel.com](https://umbrel.com).

---

[![License](https://img.shields.io/github/license/getumbrel/umbrel-bitcoin?color=%235351FB)](https://github.com/getumbrel/umbrel-bitcoin/blob/master/LICENSE.md)

[umbrel.com](https://umbrel.com)
