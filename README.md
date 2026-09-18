# HANDOFF CERT

Couche de certification entre deux unités de travail autonomes.

Une machine termine une partie du travail. Une autre doit reprendre.
HANDOFF certifie si le paquet contient assez d’état, de preuves et de reste
pour le faire **sans reconstruire l’histoire**.

Il ne fait pas le travail. Il ne choisit pas l’agent. Il ne paie personne.
Ce n’est pas un standard. Facturation : `preview`. Licence MIT.
Pas de paquet npm publié, pas de clients payants.

```
AGENT A  →  POST /api/v1/certify  →  certificat  →  AGENT B
```

## Verdict final — 2026-09-18

**V0 est gelé.** Quatre faux REPRENABLE (KFP-001 à KFP-004) sont publics et
lockés. Le claim CERT+GATE (« B ne part pas à tort ») est **tué** : premier
contre-exemple **KFP-001** (vscode#311420). Banc : **4 kills / 7 faux
REPRENABLE / 9 attaques**. Contrôles lexique 2/2 (un token FAIL arrête encore
B) — insuffisant. On ne retune pas V0.

Notaire rejouable. Grille calquée sur un juge aveugle. B part à tort quand le
monde est CORROMPU sans token FAIL.

Un ruleset **1.1** existe comme **notaire séparé** (booléens) — expérimental,
non vendu, jamais un patch silencieux de 1.0. KFP-001 y devient CORROMPU ;
`terminated ⊂ termine` y survit. Le SKU `handoff-cert-v1` certifie uniquement
le ruleset **1.0**. Le gel 1.0 reste rouge.

> **English.** V0 is frozen. Four known false REPRENABLE cases (KFP-001–004)
> stay locked. The CERT+GATE claim is dead: KFP-001 is the first
> counter-example (world CORROMPU, V0 says REPRENABLE, the gate PASSes). Bench:
> 4 kills / 7 false REPRENABLE / 9 attacks. Ruleset 1.1 is a separate notary
> (booleans), not a silent patch; 1.0 stays locked red. MIT, not a standard, billing is
> preview. No published npm package, no paying customers.

## Verdicts

| Verdict | Sens |
|---|---|
| **REPRENABLE** | assez d’état, de preuves et de reste — selon le ruleset, pas selon la vérité du monde |
| **PARTIEL** | il manque une information requise |
| **CORROMPU** | une affirmation est contredite ; continuer propagerait l’erreur |

Faux REPRENABLE = erreur critique (une machine continuerait).

## API

```bash
curl -sS http://localhost:8080/api/v1/certify \
  -H 'content-type: application/json' \
  -d '{"paquet":{"from":"a","to":"b","task":"…","work_done":[],"work_remaining":["suite"]}}'
```

Réponse : deux couches, jamais fusionnées.

```json
{
  "certificate": { "verdict": "REPRENABLE", "ruleset": "1.0", "input_hash": "sha256:…" },
  "integrite": "non_fourni",
  "offer": { "sku": "handoff-cert-v1", "price_eur": 0.001, "billing": "preview" }
}
```

SKU `handoff-cert-v1` · ruleset `1.0` · **0,001 € / certificat** · facturation
`preview` tant que `X402_PAY_TO` n’est pas posé.

## x402 (Base Sepolia)

Facilitateur local, spec v1 `exact` / EIP-3009 USDC.

```
GET  /api/x402
POST /api/x402/verify
POST /api/x402/settle
```

- **Requirements hébergés** : verify, settle et certify utilisent les
  `hostedRequirements` du serveur. Jamais le `payTo` du client.
- **JSON avant paiement** : `POST /api/v1/certify` parse le JSON (400 si
  invalide) **puis** appelle `gateCertify`. Un body illisible ne déclenche pas
  le 402.
- Replay d’un nonce déjà settled sur **certify** → `nonce_consumed` (402, pas
  un second certificat). Verify d’un nonce consommé → `nonce_replay` (verify
  ne consomme pas). Un settle rejoué renvoie la **même** tx.
- Sans `X-PAYMENT` : certify reste 200 (preview) si `X402_PAY_TO` est vide.
- Avec `X402_PAY_TO=0x…` : POST `/api/v1/certify` exige un paiement ; 402 sinon.
- `X402_SETTLER_KEY` : clé qui soumet `transferWithAuthorization`. Absente →
  `no_settler_key`, **pas** de hash inventé.
- Ledger `x402_nonces` : clé `(network, payer, nonce)`. Preview : mémoire.
  Production : SQL (Neon).

1000 atomic = 0,001 USDC testnet.

Insertion LangGraph : `wrapNode` autour de `Command.goto` seulement
(observateur). `gateNode` est le couple CERT+GATE attaqué.

## Ruleset V0 — gelé

Déterministe. Sans LLM. Fail-closed sur les champs manquants.
`CLAIM ≠ EVIDENCE` n’est implémenté que si un **token** FAIL croise une claim
de succès. Les booléens, specs, chemins et ledgers de chat ne sont pas des
pièces.

## Falsification

Quatre faux REPRENABLE documentés, lockés. Si on « corrige » le juge, le test
casse.

| Tag | Cas | V0 | Correct |
|---|---|---|---|
| KFP-001 | X07 VS Code | REPRENABLE | CORROMPU |
| KFP-002 | X09 CrewAI | REPRENABLE | PARTIEL |
| KFP-003 | X10 CrewAI | REPRENABLE | PARTIEL |
| KFP-004 | X16 Magentic | REPRENABLE | PARTIEL |

Dossier : [`falsification/`](./falsification/).

## Lancer

```bash
npm install
npm test
npm run dev
```

Interface : Accueil · Offre · Certifier · Falsification · Adopter · Verdict.

## Licence

MIT. Pas un standard. Le juge V0 est gelé : une PR qui fait disparaître un KFP
sans changer le ruleset est une régression.
