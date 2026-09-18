# HANDOFF CERT

Couche de certification entre deux unités de travail autonomes.

Une machine termine une partie du travail. Une autre doit reprendre.
HANDOFF certifie si le paquet contient assez d’état, de preuves et de reste
pour le faire **sans reconstruire l’histoire**.

Il ne fait pas le travail. Il ne choisit pas l’agent. Il ne paie personne.

```
AGENT A  →  POST /api/v1/certify  →  certificat  →  AGENT B
```

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

SKU `handoff-cert-v1` · **0,001 € / certificat** · facturation `preview` tant que `X402_PAY_TO` n’est pas posé.

## x402 (Base Sepolia)

Facilitateur local, spec v1 `exact` / EIP-3009 USDC.

```
GET  /api/x402
POST /api/x402/verify
POST /api/x402/settle
```

- Sans `X-PAYMENT` : certify reste 200 (preview) si `X402_PAY_TO` est vide.
- Avec `X402_PAY_TO=0x…` : POST `/api/v1/certify` exige un paiement ; 402 sinon.
- `X402_SETTLER_KEY` : clé qui soumet `transferWithAuthorization`. Absente → `no_settler_key`, **pas** de hash inventé.

1000 atomic = 0,001 USDC testnet.

Insertion LangGraph : `wrapNode` autour de `Command.goto` seulement.

## Ruleset V0 — gelé

Déterministe. Sans LLM. Fail-closed sur les champs manquants.
`CLAIM ≠ EVIDENCE` n’est implémenté que si un **token** FAIL croise une claim de succès.
Les booléens, specs, chemins et ledgers de chat ne sont pas des pièces.

## Falsification

Quatre faux REPRENABLE documentés, lockés. Si on « corrige » le juge, le test casse.

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

Interface : Accueil · Offre · Certifier · Falsification · Adopter.

## Licence

MIT. Le juge V0 est gelé : une PR qui fait disparaître un KFP sans changer le ruleset est une régression.
