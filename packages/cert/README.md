# `@handoff/cert`

TypeScript SDK + CLI for [HANDOFF CERT](https://github.com/19891501/handoff-cert).

HTTP client for `POST /api/v1/certify` and the CERT+GATE couple `gateResume`.
V0 is a **frozen receipt**, not a safety gate. Billing is **preview**.
**No paying customers. Not published to npm until credentials exist.** MIT, not a standard.

## Install (when published)

```bash
npm i @handoff/cert
```

This repo: `npx handoff-cert` (root `bin`). After publish: `npx @handoff/cert` or `npx --package=@handoff/cert handoff-cert`.

Export path (prepared, not a fake publish):

```json
"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }
```

`npm publish` is refused without `npm whoami`. See `scripts/publish-cert.mjs`.

## SDK

```ts
import { certify, gateResume, createClient } from "@handoff/cert";

const receipt = await certify(paquet);           // ruleset 1.0, 0.001€ receipt
const gate = await gateResume(paquet, { ruleset: "1.2" }); // 0.05€ grille
if (gate.decision === "STOP") process.exit(2);

const client = createClient({ baseUrl: "http://localhost:8080" });
await client.catalogue();
```

Default URL: `$HANDOFF_CERT_URL` or `http://localhost:8080`.
Pass `X-PAYMENT` via `{ payment }` — never invented. 402 is `PaymentRequiredError`.

## CLI

```bash
npx handoff-cert certify --ruleset 1.0 packet.json
npx handoff-cert gate --ruleset 1.2 packet.json
npx handoff-cert catalogue
```

Exit 0 = ok / PASS. Exit 2 = STOP. Exit 1 = error.

SKU `handoff-cert-v1` · 1.0 · 0,001 €. SKU `handoff-gate-v12` · 1.2 · 0,05 €.
Facturation `preview`. Pas de clients payants.
