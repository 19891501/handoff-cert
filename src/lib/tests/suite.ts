import { classify, PRESETS } from "../adopt/classify.ts";
import { adopt, verifyIncoming } from "../adopt/hook.ts";
import { tamper } from "../adopt/hosts.ts";
import {
  checkoutGraph,
  gateNode,
  isHandoffCommand,
  LANGGRAPH_END,
  readGoto,
  runGraph,
  wrapNode,
} from "../adopt/langgraph.ts";
import { PATTERNS } from "../adopt/patterns.ts";
import { jcs } from "../format/jcs.ts";
import { seal, samplePartiel } from "../format/proof.ts";
import { hammingBits, SAMPLE_STATE, shaHex } from "../format/sha.ts";
import { BENCH_CASES } from "../handoff/cases.ts";
import { certify } from "../handoff/engine.ts";
import { CORPUS_CASES } from "../handoff/corpus.ts";
import { KNOWN_FALSE, RESET_PROTOCOL, scanKnownFalse } from "../bench/falsify.ts";
import { attackCorpus, runAttack, runAttack11, runAttack12, runResetAB } from "../bench/attack.ts";
import { FAILURE_CLASSES } from "../bench/classes.ts";
import { scanText, scanValue } from "../bench/markers.ts";
import { ENGINE_FIXTURES, traceEngine } from "../bench/engine-trace.ts";
import { judge } from "../handoff/engine.ts";
import { CLAIM_ONLY_OK, STATUS_ONLY, statusPolarity } from "../bench/tokens.ts";
import { OFFER, OFFERS } from "../offer/catalog.ts";
import { catalogueRulesets, serveCertify } from "../offer/serve.ts";
import { getCase } from "../handoff/cases.ts";
import { FINAL_VERDICT, ATTACK_11_NOTE, ATTACK_12_NOTE } from "../bench/verdict.ts";
import { gateResume } from "../bench/gate.ts";
import {
  AMOUNT_ATOMIC,
  GATE_AMOUNT_ATOMIC,
  admitPayment,
  forgetNonce,
  hostedRequirements,
  hostedRequirementsFor,
  installNonceLedger,
  paymentRequiredBody,
  parsePaymentHeader,
  requirements,
  settlePayment,
  signExact,
  verifyPayment,
} from "../offer/x402.ts";
import { GATE_SKU, RECEIPT } from "../offer/mission.ts";
import { memoryLedger, sqlLedger, type SqlLike } from "../offer/nonce-ledger.ts";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface CheckResult {
  id: string;
  group: string;
  name: string;
  ok: boolean;
  critical: boolean;
  error?: string;
}

function fail(message: string): never {
  throw new Error(message);
}

function eq<T>(got: T, expected: T, label: string) {
  if (got !== expected) fail(`${label}: attendu ${String(expected)}, obtenu ${String(got)}`);
}

/** Simule ON CONFLICT DO NOTHING RETURNING pour sqlLedger, sans Postgres. */
function fakeSql(): SqlLike {
  const rows = new Map<string, { transaction: string; asset: string }>();
  const key = (network: string, payer: string, nonce: string) =>
    `${network}:${payer}:${nonce}`;
  return {
    async query(text, params = []) {
      const [network, payer, nonce, asset, transaction] = params as string[];
      if (/insert into x402_nonces/i.test(text)) {
        const k = key(network, payer, nonce);
        if (rows.has(k)) return [];
        const row = { transaction, asset };
        rows.set(k, row);
        return [row];
      }
      if (/select tx_hash as transaction/i.test(text)) {
        const row = rows.get(key(network, payer, nonce));
        return row ? [row] : [];
      }
      if (/delete from x402_nonces/i.test(text)) {
        rows.delete(key(network, payer, nonce));
        return [];
      }
      throw new Error(`sql inattendue: ${text}`);
    },
  };
}

export async function runSuite(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];

  async function check(
    group: string,
    id: string,
    name: string,
    fn: () => Promise<void> | void,
    critical = false,
  ) {
    try {
      await fn();
      out.push({ id, group, name, ok: true, critical });
    } catch (e) {
      out.push({
        id,
        group,
        name,
        ok: false,
        critical,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  for (const p of PRESETS) {
    await check("Command.goto", `goto-${p.id}`, p.title, () => {
      const c = classify(p.value);
      const h = isHandoffCommand(p.value);
      const expect = ["goto", "parent", "send"].includes(p.id);
      eq(c.handoff, expect, "classify");
      eq(h, expect, "isHandoffCommand");
    });
  }

  await check("Command.goto", "goto-end-array", "goto [__end__] n'est pas un handoff", () => {
    eq(classify({ goto: ["__end__"] }).handoff, false, "classify");
    eq(isHandoffCommand({ goto: ["__end__"] }), false, "isHandoff");
  });

  await check("Command.goto", "goto-fanout", "goto [a,b] est un handoff", () => {
    eq(classify({ goto: ["a", "b"] }).handoff, true, "classify");
  });

  await check("wrapNode", "wrap-silent", "return d'état : pas de sceau", async () => {
    const fn = wrapNode("n", () => ({ x: 1 }));
    const r = await fn({ order_id: "1" });
    if (isHandoffCommand(r)) fail("ne doit pas être un Command");
  });

  await check("wrapNode", "wrap-resume", "resume : pas de sceau", async () => {
    const fn = wrapNode("n", () => ({ resume: "yes" }));
    const r = (await fn({})) as { update?: { continuation_proof?: unknown } };
    if (r.update?.continuation_proof) fail("sceau sur resume");
  });

  await check("wrapNode", "wrap-end", "goto __end__ : pas de sceau", async () => {
    const fn = wrapNode("n", () => ({ goto: "__end__", update: { x: 1 } }));
    const r = (await fn({})) as { update?: { continuation_proof?: unknown } };
    if (r.update?.continuation_proof) fail("sceau sur END");
  });

  await check("wrapNode", "wrap-checkout", "checkout : sceau puis silence", async () => {
    const run = await runGraph(checkoutGraph());
    eq(run.steps.length, 2, "étapes");
    eq(run.steps[0]?.sealed, true, "payment");
    eq(run.steps[1]?.sealed, false, "fulfillment");
    eq(run.steps[0]?.proof?.status, "UNKNOWN", "pas de jugement à l'insertion");
    if ("payload" in (run.steps[0]?.proof ?? {})) fail("payload exporté");
  });

  await check("wrapNode", "wrap-match", "enveloppe identique → MATCH", async () => {
    const run = await runGraph(checkoutGraph());
    const step = run.steps[0]!;
    const v = await verifyIncoming(step.proof!, step.envelope);
    eq(v, "MATCH", "verify");
  });

  await check("wrapNode", "wrap-mismatch", "copie altérée → MISMATCH", async () => {
    const run = await runGraph(checkoutGraph());
    const step = run.steps[0]!;
    const v = await verifyIncoming(step.proof!, tamper("langgraph", step.envelope));
    eq(v, "MISMATCH", "verify");
  });

  for (const p of PATTERNS) {
    await check("Motifs", `pattern-${p.id}`, p.title, async () => {
      const r = await p.run();
      const sealed = r.steps.some((s) => s.sealed);
      eq(sealed, p.handoff, "sceau vs motif");
    });
  }

  await check("Format", "jcs-reorder", "JCS ignore l'ordre des clés", () => {
    eq(jcs({ b: 1, a: 2 }), jcs({ a: 2, b: 1 }), "digest");
  });

  await check("Format", "seal-payload", "seal retire payload", () => {
    const s = seal({ ...samplePartiel(), payload: { secret: 1 } });
    if ("payload" in s) fail("payload encore présent");
  });

  await check("Format", "adopt-unknown", "enveloppe inconnue refusée", async () => {
    const r = await adopt({ foo: 1 });
    eq(r.ok, false, "ok");
  });

  await check("SHA", "sha-reorder", "clés réordonnées : même SHA-256", async () => {
    const a = await shaHex("SHA-256", jcs(SAMPLE_STATE));
    const b = await shaHex(
      "SHA-256",
      jcs({ order_id: SAMPLE_STATE.order_id, charged: SAMPLE_STATE.charged, amount: SAMPLE_STATE.amount }),
    );
    eq(a, b, "digest");
  });

  await check("SHA", "sha-lie", "charged:false avalanche SHA-256", async () => {
    const a = await shaHex("SHA-256", jcs(SAMPLE_STATE));
    const b = await shaHex("SHA-256", jcs({ ...SAMPLE_STATE, charged: false }));
    if (a === b) fail("mensonge devrait diverger");
    const ham = hammingBits(a, b);
    if (ham.ratio < 0.3) fail(`avalanche trop faible: ${ham.ratio}`);
  });

  await check("SHA", "sha-sizes", "longueurs de digest", async () => {
    const t = jcs(SAMPLE_STATE);
    eq((await shaHex("SHA-1", t)).length, 40, "SHA-1");
    eq((await shaHex("SHA-256", t)).length, 64, "SHA-256");
    eq((await shaHex("SHA-512", t)).length, 128, "SHA-512");
  });

  await check("Falsification", "frozen-lock", "dossier : judge_v0(paquet) == v0_verdict", async () => {
    const rows = await scanKnownFalse();
    eq(rows.length, 4, "n");
    for (const k of KNOWN_FALSE) {
      const caze = CORPUS_CASES.find((c) => c.id === k.id);
      if (!caze) fail(`cas ${k.id} absent`);
      const cert = await certify(caze.payload);
      eq(cert.verdict, "REPRENABLE", k.tag);
      if (caze.expected === "REPRENABLE") fail(`${k.tag} n'est plus un faux positif`);
    }
    for (const r of rows) {
      if (!r.stillFalse) fail(`${r.tag} a disparu — le gel a bougé`);
    }
  });

  await check("Attaque", "claim-tuee", "CERT+GATE : le claim est tué par un kill", async () => {
    const report = await runAttack();
    eq(report.projectClaim, "tuee", "claim");
    if (!report.killer) fail("pas de killer");
    eq(report.killer.attack.id, "KFP-001", "premier contre-exemple");
    eq(report.killer.gate.decision, "PASS", "grille");
    eq(report.killer.gate.verdict, "REPRENABLE", "v0");
    if (report.nKills < 1) fail("aucun kill");
    if (report.nFalseReprenable < 4) fail("les 4 KFP doivent rester faux R");
  });

  await check("Attaque", "controle-lexique", "token FAIL arrête ; propre passe", async () => {
    const report = await runAttack();
    const stop = report.rows.find((r) => r.attack.id === "CTL-FAIL-TOKEN");
    const pass = report.rows.find((r) => r.attack.id === "CTL-CLEAN");
    if (!stop || !pass) fail("contrôles absents");
    eq(stop.gate.decision, "STOP", "fail");
    eq(stop.gate.verdict, "CORROMPU", "v0 fail");
    eq(pass.gate.decision, "PASS", "clean");
    eq(report.nControlOk, 2, "contrôles");
  });

  await check("Attaque", "reset-kfp001", "Reset A→B : historique effacé, B part quand même", async () => {
    eq(RESET_PROTOCOL.run, true, "lancé");
    const kfp = attackCorpus().find((a) => a.id === "KFP-001");
    if (!kfp) fail("KFP-001 absent");
    const reset = await runResetAB(kfp.packet);
    eq(reset.history, "effacee", "reset");
    eq(reset.b_continues, true, "B");
    eq(reset.kind, "gate-mecanique", "pas un LLM");
  });

  await check("Attaque", "gate-node", "gateNode coupe le FAIL, laisse KFP-001 — wrapNode laisse les deux", async () => {
    const fail = attackCorpus().find((a) => a.id === "CTL-FAIL-TOKEN")!;
    const kfp = attackCorpus().find((a) => a.id === "KFP-001")!;
    const node = () => ({ goto: "executor", update: { step: 1 } });
    const outFail = (await gateNode("planner", node, { packetOf: () => fail.packet })({})) as {
      goto?: unknown;
    };
    const outKfp = (await gateNode("planner", node, { packetOf: () => kfp.packet })({})) as {
      goto?: unknown;
    };
    const outWrap = (await wrapNode("planner", node)({})) as { goto?: unknown };
    eq(readGoto(outFail), LANGGRAPH_END, "FAIL → END");
    eq(readGoto(outKfp), "executor", "KFP-001 passe la grille");
    eq(readGoto(outWrap), "executor", "observateur");
  });

  await check("Verdict", "final-aligne", "gel du verdict = banc CERT+GATE", async () => {
    const report = await runAttack();
    eq(FINAL_VERDICT.claim_reprise_sure, "tue", "claim");
    eq(FINAL_VERDICT.kills, report.nKills, "kills");
    eq(FINAL_VERDICT.faux_reprenable, report.nFalseReprenable, "fauxR");
    eq(FINAL_VERDICT.attaques, report.n, "n");
    eq(FINAL_VERDICT.premier_contre_exemple, report.killer?.attack.id ?? "", "kfp");
    eq(FINAL_VERDICT.laboratoire, "tenu", "labo");
    eq(FINAL_VERDICT.produit_facture, "non", "sku");
  });

  await check("Attaque", "Attaque-11-1.0-gel", "1.1 n'altère pas le scoreboard 1.0", async () => {
    const report = await runAttack();
    eq(report.ruleset, "1.0", "ruleset");
    eq(report.nKills, 4, "kills");
    eq(report.nFalseReprenable, 7, "faux");
    eq(report.n, 9, "n");
    eq(report.killer?.attack.id ?? "", "KFP-001", "killer");
    eq(FINAL_VERDICT.kills, 4, "gel kills");
  });

  await check("Attaque", "Attaque-11-kfp001", "1.1 STOP sur KFP-001 ; 1.0 PASS", async () => {
    const kfp = attackCorpus().find((a) => a.id === "KFP-001");
    if (!kfp) fail("KFP-001 absent");
    const g10 = await gateResume(kfp.packet, "1.0");
    eq(g10.decision, "PASS", "1.0");
    eq(g10.verdict, "REPRENABLE", "v0");
    eq(g10.ruleset, "1.0", "r10");
    const g11 = await gateResume(kfp.packet, "1.1");
    eq(g11.decision, "STOP", "1.1");
    eq(g11.verdict, "CORROMPU", "v11");
    eq(g11.ruleset, "1.1", "r11");
  });

  await check("Attaque", "Attaque-11-scoreboard", "runAttack11 aligne ATTACK_11_NOTE, hors gel 1.0", async () => {
    const r11 = await runAttack11();
    eq(r11.ruleset, "1.1", "ruleset");
    eq(r11.n, ATTACK_11_NOTE.attack11_n, "n");
    eq(r11.nKills, ATTACK_11_NOTE.attack11_kills, "kills");
    eq(r11.nFalseReprenable, ATTACK_11_NOTE.attack11_faux_reprenable, "faux");
    eq(r11.nControlOk, 2, "ctl");
    eq(r11.killer?.attack.id ?? "", ATTACK_11_NOTE.attack11_killer, "killer");
    eq(FINAL_VERDICT.kills, 4, "gel 1.0 intact");
  });

  await check("Attaque", "Attaque-12-scoreboard", "runAttack12 aligne ATTACK_12_NOTE, hors gel 1.0", async () => {
    const r12 = await runAttack12();
    eq(r12.ruleset, "1.2", "ruleset");
    eq(r12.n, ATTACK_12_NOTE.attack12_n, "n");
    eq(r12.nKills, ATTACK_12_NOTE.attack12_kills, "kills");
    eq(r12.nFalseReprenable, ATTACK_12_NOTE.attack12_faux_reprenable, "faux");
    eq(r12.nControlOk, 2, "ctl");
    eq(r12.killer?.attack.id ?? "", ATTACK_12_NOTE.attack12_killer, "killer");
    eq(FINAL_VERDICT.kills, 4, "gel 1.0 intact");
  });

  await check("Falsification", "classes-occupancy", "4 classes occupées, parent vide", () => {
    const occupied = FAILURE_CLASSES.filter((c) => c.kfp);
    eq(occupied.length, 4, "occupées");
    const parent = FAILURE_CLASSES.find((c) => c.id === "preuve_impersonée");
    if (parent?.kfp) fail("le parent n'est pas un cas");
  });

  await check("Marqueurs", "bilingual", "EN success + FR confirme, succeeded invisible, absentes neutre", () => {
    const miss = scanText("the task succeeded with no problems");
    eq(miss.polarity, "none", "succeeded ≠ success");
    const en = scanText("the task was a success");
    if (!en.success.includes("success")) fail("success exact");
    const fr = scanText("Le mode exécuteur a été confirmé.");
    if (!fr.success.includes("confirme")) fail("confirmé → confirme");
    const fill = scanText("absentes");
    eq(fill.polarity, "none", "repli adaptateur");
    const hidden = scanValue({ executorModeObservedAfterHandoff: false });
    eq(hidden.visible.length, 0, "booléen");
    const word = scanText("false");
    eq(word.polarity, "none", "false ≠ fail");
  });

  await check("Moteur", "reduction", "critical → CORROMPU, error → PARTIEL, vide → REPRENABLE", () => {
    eq(judge([{ code: "X", severity: "critical", message: "c" }]), "CORROMPU", "c");
    eq(judge([{ code: "X", severity: "error", message: "e" }]), "PARTIEL", "e");
    eq(judge([{ code: "X", severity: "warning", message: "w" }]), "REPRENABLE", "w");
    eq(judge([]), "REPRENABLE", "vide");
  });

  await check("Moteur", "kfp001-no-critical", "X07 : REPRENABLE sans finding critical", () => {
    const x07 = ENGINE_FIXTURES.find((f) => f.id === "X07")!;
    const t = traceEngine(x07.payload, x07.expected);
    eq(t.verdict, "REPRENABLE", "v0");
    eq(t.falseSafe, true, "faux R");
    if (t.findings.some((f) => f.severity === "critical")) fail("un critical aurait corrigé 001");
  });

  await check("Offre", "sku", "prix public, couches séparées", async () => {
    eq(OFFER.sku, "handoff-cert-v1", "sku");
    eq(OFFER.price_eur, 0.001, "prix");
    const payload = getCase("clean_validation")!.payload;
    const res = await serveCertify({ paquet: payload });
    eq(res.integrite, "non_fourni", "intégrité");
    eq(res.certificate.verdict, "REPRENABLE", "verdict");
    eq(res.offer.billing, "preview", "pas de 402 faux");
    if ("findings" in (res.certificate as object)) fail("le public n'expose pas findings");
  });

  await check("Offre", "catalogue-skus", "GET catalogue : reçu 1.0 0.001 et grille 1.2 0.05", () => {
    const cat = catalogueRulesets();
    eq(cat.sku, RECEIPT.sku, "défaut reçu");
    eq(cat.ruleset, "1.0", "ruleset défaut");
    eq(cat.skus.length, 2, "deux SKUs");
    eq(OFFERS.length, 2, "OFFERS");
    const receipt = cat.skus.find((s) => s.sku === RECEIPT.sku);
    const gate = cat.skus.find((s) => s.sku === GATE_SKU.sku);
    if (!receipt) fail("reçu absent");
    if (!gate) fail("grille absente");
    eq(receipt.ruleset, "1.0", "reçu ruleset");
    eq(receipt.price_eur, 0.001, "reçu prix");
    eq(receipt.price_eur, RECEIPT.price_eur, "align mission reçu");
    eq(gate.ruleset, "1.2", "grille ruleset");
    eq(gate.price_eur, 0.05, "grille prix");
    eq(gate.price_eur, GATE_SKU.price_eur, "align mission grille");
  });

  await check("Tokens", "families", "status true ≠ claim true ; confirme claim-only", () => {
    if (!STATUS_ONLY.includes("true")) fail("true est status-ok seulement");
    if (CLAIM_ONLY_OK.includes("true")) fail("true n'est pas un token de claim");
    if (!CLAIM_ONLY_OK.includes("confirme")) fail("confirme polarise la claim");
    eq(statusPolarity("PASS"), "ok", "PASS");
    eq(statusPolarity("cancelled"), "fail", "cancelled");
    eq(statusPolarity(""), "none", "vide");
  });

  await check("x402", "facilitator", "signature EIP-3009 acceptée, montant faux refusé, settle sans clé honnête", async () => {
    installNonceLedger(memoryLedger());
    const payer = privateKeyToAccount(generatePrivateKey());
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const reqs = { ...requirements(), payTo: merchant };
    const payload = await signExact(payer, merchant);
    const ok = await verifyPayment(payload, reqs);
    eq(ok.isValid, true, "valid");
    eq(ok.payer?.toLowerCase(), payer.address.toLowerCase(), "payer");
    const bad = await signExact(payer, merchant, "1");
    const no = await verifyPayment(bad, reqs);
    eq(no.isValid, false, "amount");
    eq(no.invalidReason, "amount_mismatch", "reason");
    const settled = await settlePayment(payload, reqs);
    eq(settled.success, false, "pas de clé");
    eq(settled.errorReason, "no_settler_key", "honnête");
    eq(settled.transaction, "", "pas de hash fantôme");
    const still = await verifyPayment(payload, reqs);
    eq(still.isValid, true, "verify ne consomme pas");
    const replayBody = paymentRequiredBody("X-PAYMENT header is required");
    eq(replayBody.x402Version, 1, "v1");
    eq(replayBody.accepts[0]?.maxAmountRequired, AMOUNT_ATOMIC, "atomic");
    const parsed = parsePaymentHeader(JSON.stringify(payload));
    eq(parsed?.payload.authorization.from.toLowerCase(), payer.address.toLowerCase(), "header");
    const attacker = {
      ...requirements(),
      payTo: "0x0000000000000000000000000000000000000123" as typeof merchant,
    };
    eq(hostedRequirements().payTo, requirements().payTo, "V-01 serveur");
    if (hostedRequirements().payTo.toLowerCase() === attacker.payTo.toLowerCase() && attacker.payTo !== requirements().payTo) {
      fail("requirements client acceptés");
    }
  });

  await check("x402", "two-amounts", "reçu 1000 ; grille 1.2 = 50000 ; défaut = reçu", () => {
    eq(GATE_AMOUNT_ATOMIC, "50000", "gate atomic");
    eq(AMOUNT_ATOMIC, "1000", "receipt atomic");
    eq(hostedRequirements().maxAmountRequired, AMOUNT_ATOMIC, "default receipt");
    eq(hostedRequirementsFor("1.0").maxAmountRequired, AMOUNT_ATOMIC, "1.0");
    eq(hostedRequirementsFor("1.1").maxAmountRequired, AMOUNT_ATOMIC, "1.1");
    eq(hostedRequirementsFor("1.2").maxAmountRequired, GATE_AMOUNT_ATOMIC, "1.2");
    eq(Number(GATE_AMOUNT_ATOMIC) / 1_000_000, GATE_SKU.price_eur, "align GATE_SKU");
    eq(Number(AMOUNT_ATOMIC) / 1_000_000, RECEIPT.price_eur, "align RECEIPT");
    eq(hostedRequirementsFor("1.2").payTo, hostedRequirements().payTo, "V-01 1.2");
    const attacker = {
      ...requirements(),
      maxAmountRequired: "1",
      payTo: "0x0000000000000000000000000000000000000123" as const,
    };
    if (hostedRequirementsFor("1.2").maxAmountRequired === attacker.maxAmountRequired) {
      fail("requirements client acceptés");
    }
    if (hostedRequirementsFor("1.2").payTo === attacker.payTo) {
      fail("payTo client accepté");
    }
  });

  await check("x402", "admit-replay", "replay ≠ second certificat", async () => {
    const book = memoryLedger();
    installNonceLedger(book);
    const payer = privateKeyToAccount(generatePrivateKey());
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const reqs = { ...requirements(), payTo: merchant };
    const payload = await signExact(payer, merchant);
    const auth = payload.payload.authorization;
    await book.put(payload.network, auth.from, auth.nonce, reqs.asset, "0xabc");
    const admitted = await admitPayment(payload, reqs);
    if (admitted.ok) fail("coupon");
    eq(admitted.errorReason, "nonce_consumed", "consumed");
    installNonceLedger(memoryLedger());
  });

  await check("x402", "ledger", "settle rejoué renvoie la même tx, verify voit nonce_replay", async () => {
    const book = memoryLedger();
    installNonceLedger(book);
    const payer = privateKeyToAccount(generatePrivateKey());
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const reqs = { ...requirements(), payTo: merchant };
    const payload = await signExact(payer, merchant);
    const auth = payload.payload.authorization;
    await book.put(payload.network, auth.from, auth.nonce, reqs.asset, "0xabc");
    const again = await settlePayment(payload, reqs);
    eq(again.success, true, "idempotent");
    eq(again.transaction, "0xabc", "même tx");
    eq(again.replay, true, "replay");
    const replayed = await verifyPayment(payload, reqs);
    eq(replayed.isValid, false, "verify");
    eq(replayed.invalidReason, "nonce_replay", "reason");
    await forgetNonce(auth.nonce, auth.from);
  });

  await check("x402", "sql-ledger", "ON CONFLICT renvoie la première tx, casse pliée", async () => {
    const book = sqlLedger(fakeSql());
    installNonceLedger(book);
    const first = await book.put(
      "base-sepolia",
      "0xABC0000000000000000000000000000000000001",
      "0xAA",
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "0xaaa",
    );
    const again = await book.put(
      "base-sepolia",
      "0xabc0000000000000000000000000000000000001",
      "0xaa",
      "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      "0xbbb",
    );
    eq(first.transaction, "0xaaa", "insert");
    eq(again.transaction, "0xaaa", "first wins");
    eq(book.backend, "sql", "backend");
    const got = await book.get(
      "base-sepolia",
      "0xAbC0000000000000000000000000000000000001",
      "0xAa",
    );
    eq(got?.transaction, "0xaaa", "get");
    const payer = privateKeyToAccount(generatePrivateKey());
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const reqs = { ...requirements(), payTo: merchant };
    const payload = await signExact(payer, merchant);
    const auth = payload.payload.authorization;
    await book.put(payload.network, auth.from, auth.nonce, reqs.asset, "0xdead");
    const settled = await settlePayment(payload, reqs);
    eq(settled.success, true, "idempotent");
    eq(settled.transaction, "0xdead", "même tx");
    eq(settled.replay, true, "replay");
    const replayed = await verifyPayment(payload, reqs);
    eq(replayed.invalidReason, "nonce_replay", "verify");
    installNonceLedger(memoryLedger());
  });

  for (const c of BENCH_CASES) {
    const critical = c.expected !== "REPRENABLE";
    await check(
      "Contrat V0",
      `bench-${c.id}`,
      `${c.id} → ${c.expected}`,
      async () => {
        const cert = await certify(c.payload);
        eq(cert.verdict, c.expected, "verdict");
        if (c.expected !== "REPRENABLE" && cert.verdict === "REPRENABLE") {
          fail("FAUX REPRENABLE");
        }
      },
      critical,
    );
  }

  await check("x402", "pending-not-phantom", "pending empty tx is not a phantom success hash", async () => {
    const book = memoryLedger();
    installNonceLedger(book);
    const payer = privateKeyToAccount(generatePrivateKey());
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const reqs = { ...requirements(), payTo: merchant };
    const payload = await signExact(payer, merchant);
    const auth = payload.payload.authorization;
    const pending = await book.put(payload.network, auth.from, auth.nonce, reqs.asset, "");
    eq(pending.transaction, "", "pending vide");
    const got = await book.get(payload.network, auth.from, auth.nonce);
    eq(got !== null, true, "pending existe");
    eq(got?.transaction, "", "pas un hash");
    const settled = await settlePayment(payload, reqs);
    eq(settled.success, false, "pending ≠ succès");
    eq(settled.transaction, "", "pas de hash fantôme");
    eq(settled.errorReason, "nonce_replay", "pending bloque");
    const replayed = await verifyPayment(payload, reqs);
    eq(replayed.isValid, false, "verify");
    eq(replayed.invalidReason, "nonce_replay", "reason");
    const hashed = await book.put(payload.network, auth.from, auth.nonce, reqs.asset, "0xreal");
    eq(hashed.transaction, "0xreal", "upgrade");
    const again = await settlePayment(payload, reqs);
    eq(again.success, true, "replay");
    eq(again.transaction, "0xreal", "même tx");
    eq(again.replay, true, "flag");
    const admitted = await admitPayment(payload, reqs);
    if (admitted.ok) fail("second CERTIFY");
    eq(admitted.errorReason, "nonce_consumed", "consumed");
    installNonceLedger(memoryLedger());
  });

  await check("x402", "pending-recover", "lookup hash recovers pending as replay success", async () => {
    const book = memoryLedger();
    installNonceLedger(book);
    const payer = privateKeyToAccount(generatePrivateKey());
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const reqs = { ...requirements(), payTo: merchant };
    const payload = await signExact(payer, merchant);
    const auth = payload.payload.authorization;
    await book.put(payload.network, auth.from, auth.nonce, reqs.asset, "");
    const settled = await settlePayment(payload, reqs, async () => "0xabc");
    eq(settled.success, true, "recovered");
    eq(settled.transaction, "0xabc", "hash");
    eq(settled.replay, true, "replay");
    const got = await book.get(payload.network, auth.from, auth.nonce);
    eq(got?.transaction, "0xabc", "put");
    installNonceLedger(memoryLedger());
  });

  await check("x402", "pending-lookup-null", "lookup null keeps settle_pending, no phantom hash", async () => {
    const book = memoryLedger();
    installNonceLedger(book);
    const payer = privateKeyToAccount(generatePrivateKey());
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const reqs = { ...requirements(), payTo: merchant };
    const payload = await signExact(payer, merchant);
    const auth = payload.payload.authorization;
    await book.put(payload.network, auth.from, auth.nonce, reqs.asset, "");
    const settled = await settlePayment(payload, reqs, async () => null);
    eq(settled.success, false, "pas de succès");
    eq(settled.transaction, "", "pas de hash fantôme");
    eq(settled.errorReason, "settle_pending", "pending");
    const still = await book.get(payload.network, auth.from, auth.nonce);
    eq(still?.transaction, "", "pas de second write");
    installNonceLedger(memoryLedger());
  });

  await check("x402", "pending-first-wins", "first-wins still works", async () => {
    const mem = memoryLedger();
    const first = await mem.put("base-sepolia", "0xP", "0xN", "0xasset", "0xaaa");
    const second = await mem.put("base-sepolia", "0xP", "0xN", "0xasset", "0xbbb");
    eq(first.transaction, "0xaaa", "insert");
    eq(second.transaction, "0xaaa", "first-wins");
    const mem2 = memoryLedger();
    const pending = await mem2.put("base-sepolia", "0xQ", "0xM", "0xasset", "");
    eq(pending.transaction, "", "pending");
    const upgraded = await mem2.put("base-sepolia", "0xQ", "0xM", "0xasset", "0xccc");
    const lost = await mem2.put("base-sepolia", "0xQ", "0xM", "0xasset", "0xddd");
    eq(upgraded.transaction, "0xccc", "upgrade");
    eq(lost.transaction, "0xccc", "first-wins after pending");
    const store = new Map<string, { transaction: string; asset: string }>();
    const k = (network: string, payer: string, nonce: string) => `${network}:${payer}:${nonce}`;
    const sql: SqlLike = {
      async query(text, params = []) {
        if (/insert into x402_nonces/i.test(text)) {
          const [network, payer, nonce, asset, transaction] = params as string[];
          const id = k(network, payer, nonce);
          if (store.has(id)) return [];
          const row = { transaction, asset };
          store.set(id, row);
          return [row];
        }
        if (/update x402_nonces/i.test(text)) {
          const [network, payer, nonce, transaction] = params as string[];
          const row = store.get(k(network, payer, nonce));
          if (!row || row.transaction) return [];
          row.transaction = transaction;
          return [{ ...row }];
        }
        if (/select tx_hash as transaction/i.test(text)) {
          const [network, payer, nonce] = params as string[];
          const row = store.get(k(network, payer, nonce));
          return row ? [{ ...row }] : [];
        }
        throw new Error(`sql inattendue: ${text}`);
      },
    };
    const book = sqlLedger(sql);
    await book.put("base-sepolia", "0xR", "0xS", "0xasset", "");
    const sqlFirst = await book.put("base-sepolia", "0xR", "0xS", "0xasset", "0xaaa");
    const sqlAgain = await book.put("base-sepolia", "0xR", "0xS", "0xasset", "0xbbb");
    eq(sqlFirst.transaction, "0xaaa", "sql upgrade");
    eq(sqlAgain.transaction, "0xaaa", "sql first-wins");
    const sqlGot = await book.get("base-sepolia", "0xR", "0xS");
    eq(sqlGot?.transaction, "0xaaa", "sql get");
    const phantom = await book.put("base-sepolia", "0xT", "0xU", "0xasset", "");
    eq(phantom.transaction, "", "sql pending vide");
    installNonceLedger(memoryLedger());
  });

  return out;
}

export function tally(results: CheckResult[]) {
  return {
    n: results.length,
    ok: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    falseSafe: results.filter((r) => !r.ok && r.critical).length,
  };
}
