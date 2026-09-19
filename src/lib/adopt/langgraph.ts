import { gateResume, type RulesetId } from "@/lib/bench/gate";
import type { AdoptResult } from "./hook";
import { adopt } from "./hook";
import type { ContinuationProof } from "@/lib/format/proof";

export const LANGGRAPH_END = "__end__";

export type LangGraphCommand = {
  update?: Record<string, unknown>;
  goto?: unknown;
  graph?: unknown;
  resume?: unknown;
};

export type NodeFn<S extends Record<string, unknown>> = (
  state: S,
) => unknown | Promise<unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isHandoffCommand(value: unknown): value is LangGraphCommand {
  if (!isRecord(value)) return false;
  if (value.resume !== undefined && value.goto === undefined) return false;
  const goto = value.goto;
  if (typeof goto === "string") return goto.length > 0 && goto !== LANGGRAPH_END;
  if (Array.isArray(goto)) {
    return goto.some((item) => {
      if (typeof item === "string") return item.length > 0 && item !== LANGGRAPH_END;
      if (isRecord(item) && typeof item.node === "string") return item.node !== LANGGRAPH_END;
      return false;
    });
  }
  if (isRecord(goto) && typeof goto.node === "string") return goto.node !== LANGGRAPH_END;
  return false;
}

export function readGoto(command: LangGraphCommand): string | null {
  const goto = command.goto;
  if (typeof goto === "string") return goto;
  if (Array.isArray(goto) && typeof goto[0] === "string") return goto[0];
  if (isRecord(goto) && typeof goto.node === "string") return goto.node;
  return null;
}

function stripSealed(state: Record<string, unknown>): Record<string, unknown> {
  const {
    continuation_proof: _p,
    continuation_error: _e,
    ...rest
  } = state;
  void _p;
  void _e;
  return rest;
}

export async function sealHandoff(
  nodeName: string,
  state: Record<string, unknown>,
  command: LangGraphCommand,
  graph = "graph",
): Promise<{ command: LangGraphCommand; envelope: unknown }> {
  if (!isHandoffCommand(command)) return { command, envelope: null };
  const goto = readGoto(command);
  if (!goto) return { command, envelope: null };
  const envelope = {
    graph,
    node: nodeName,
    command: { goto, graph: command.graph ?? null },
    state: stripSealed(state),
    updates: command.update ?? {},
  };
  const result: AdoptResult = await adopt(envelope);
  if (!result.ok) {
    return {
      envelope,
      command: {
        ...command,
        update: {
          ...(command.update ?? {}),
          continuation_proof: null,
          continuation_error: result.reason,
        },
      },
    };
  }
  return {
    envelope,
    command: {
      ...command,
      update: {
        ...(command.update ?? {}),
        continuation_proof: result.proof,
      },
    },
  };
}

export function wrapNode<S extends Record<string, unknown>>(
  nodeName: string,
  node: NodeFn<S>,
  opts?: { graph?: string },
): (state: S) => Promise<unknown> {
  const graph = opts?.graph ?? "graph";
  return async (state: S) => {
    const result = await node(state);
    if (!isHandoffCommand(result)) return result;
    const sealed = await sealHandoff(nodeName, state, result, graph);
    return sealed.command;
  };
}

function stopCommand(
  command: LangGraphCommand,
  extra: Record<string, unknown>,
): LangGraphCommand {
  return {
    ...command,
    goto: LANGGRAPH_END,
    update: {
      ...(command.update ?? {}),
      continuation_gate: "STOP",
      ...extra,
    },
  };
}

/**
 * Grille : certify() puis STOP si le verdict n'est pas REPRENABLE.
 * wrapNode reste l'observateur (silence, pas de juge). gateNode est le couple attaqué.
 * ruleset 1.0 (défaut) : comportement actuel. 1.1 / 1.2 : gateResume(..., ruleset) ;
 * module manquant → fail closed (END) pour ce ruleset seulement.
 */
export function gateNode<S extends Record<string, unknown>>(
  nodeName: string,
  node: NodeFn<S>,
  opts?: {
    graph?: string;
    packetOf?: (state: S) => unknown;
    ruleset?: RulesetId;
  },
): (state: S) => Promise<unknown> {
  const graph = opts?.graph ?? "graph";
  const ruleset: RulesetId = opts?.ruleset ?? "1.0";
  return async (state: S) => {
    const result = await node(state);
    if (!isHandoffCommand(result)) return result;
    const sealed = await sealHandoff(nodeName, state, result, graph);
    const packet =
      opts?.packetOf?.(state) ??
      (isRecord(state) ? (state.packet ?? state.handoff) : undefined);
    if (packet === undefined || packet === null) {
      return stopCommand(sealed.command, { continuation_error: "paquet_absent" });
    }

    let g;
    if (ruleset === "1.1" || ruleset === "1.2") {
      try {
        g = await gateResume(packet, ruleset);
      } catch {
        return stopCommand(sealed.command, {
          continuation_error: `ruleset_${ruleset}_unavailable`,
        });
      }
    } else {
      g = await gateResume(packet);
    }

    if (g.decision === "STOP") {
      return stopCommand(sealed.command, { continuation_verdict: g.verdict });
    }
    return {
      ...sealed.command,
      update: {
        ...(sealed.command.update ?? {}),
        continuation_gate: "PASS",
        continuation_verdict: g.verdict,
      },
    };
  };
}

export interface GraphStep {
  node: string;
  goto: string | null;
  sealed: boolean;
  proof: ContinuationProof | null;
  error: string | null;
  envelope: unknown | null;
}

export async function runGraph<S extends Record<string, unknown>>(args: {
  name: string;
  start: string;
  nodes: Record<string, NodeFn<S>>;
  input: S;
  edges?: Record<string, string>;
}): Promise<{ state: S; steps: GraphStep[] }> {
  let current = args.start;
  let state = { ...args.input };
  const steps: GraphStep[] = [];
  let guard = 0;
  while (current && current !== LANGGRAPH_END && guard < 12) {
    guard += 1;
    const fn = args.nodes[current];
    if (!fn) break;
    const out = await fn(state);
    if (isHandoffCommand(out)) {
      const update = (out.update ?? {}) as Record<string, unknown>;
      const {
        continuation_proof: proofRaw,
        continuation_error,
        ...rawUpdate
      } = update;
      const envelope = {
        graph: args.name,
        node: current,
        command: { goto: readGoto(out), graph: out.graph ?? null },
        state: stripSealed(state),
        updates: rawUpdate,
      };
      state = { ...state, ...update } as S;
      const proof = isRecord(proofRaw) ? (proofRaw as unknown as ContinuationProof) : null;
      steps.push({
        node: current,
        goto: readGoto(out),
        sealed: Boolean(proof),
        proof,
        error: typeof continuation_error === "string" ? continuation_error : null,
        envelope,
      });
      current = readGoto(out) ?? LANGGRAPH_END;
    } else {
      if (isRecord(out)) state = { ...state, ...(out as Partial<S>) };
      const next = args.edges?.[current] ?? LANGGRAPH_END;
      steps.push({
        node: current,
        goto: next,
        sealed: false,
        proof: null,
        error: null,
        envelope: null,
      });
      current = next;
    }
  }
  return { state, steps };
}

type CheckoutState = Record<string, unknown> & {
  order_id: string;
  charged?: boolean;
  payment?: { status: string; charge_id: string };
  fulfilled?: boolean;
  continuation_proof?: ContinuationProof | null;
};

function paymentAgent(_state: CheckoutState): LangGraphCommand {
  return {
    update: {
      charged: true,
      payment: { status: "succeeded", charge_id: "ch_1" },
    },
    goto: "fulfillment_agent",
  };
}

function fulfillmentAgent(state: CheckoutState) {
  return { fulfilled: Boolean(state.charged) };
}

export function checkoutGraph() {
  const graph = "checkout";
  return {
    name: graph,
    start: "payment_agent",
    nodes: {
      payment_agent: wrapNode("payment_agent", paymentAgent, { graph }),
      fulfillment_agent: wrapNode("fulfillment_agent", fulfillmentAgent, { graph }),
    },
    input: { order_id: "ord_9" } as CheckoutState,
  };
}

export const WRAP_PATCH = `.addNode(
  "payment_agent",
  wrapNode("payment_agent", paymentAgent, { graph: "checkout" }),
)`;
