import { attackCorpus } from "@/lib/bench/attack";
import type { RulesetId } from "@/lib/bench/gate";
import type { Verdict } from "@/lib/handoff/types";
import {
  gateNode,
  LANGGRAPH_END,
  runGraph,
  wrapNode,
  type GraphStep,
  type LangGraphCommand,
  type NodeFn,
} from "./langgraph";

/** Paid grille. V0 (1.0) remains the frozen receipt — not this starter. */
export const STARTER_RULESET: RulesetId = "1.2";
export const STARTER_GRAPH = "support";
export const STARTER_FROM = "planner";
export const STARTER_TO = "executor";

export const STARTER_PATCH = `.addNode(
  "planner",
  gateNode("planner", planner, { graph: "support", ruleset: "1.2" }),
)`;

export type StarterKind = "wrap" | "1.0" | "1.2";

export type StarterState = Record<string, unknown> & {
  packet: unknown;
  handed?: boolean;
  executed?: boolean;
  continuation_gate?: string;
  continuation_verdict?: Verdict | string;
  continuation_error?: string;
};

function planner(_state: StarterState): LangGraphCommand {
  return {
    update: { handed: true },
    goto: STARTER_TO,
  };
}

function executor(state: StarterState) {
  return { executed: Boolean(state.handed) };
}

function plannerNode(kind: StarterKind): NodeFn<StarterState> {
  if (kind === "wrap") {
    return wrapNode(STARTER_FROM, planner, { graph: STARTER_GRAPH });
  }
  return gateNode(STARTER_FROM, planner, {
    graph: STARTER_GRAPH,
    ruleset: kind,
    packetOf: (s) => s.packet,
  });
}

export function starterGraph(packet: unknown, kind: StarterKind = STARTER_RULESET) {
  return {
    name: STARTER_GRAPH,
    start: STARTER_FROM,
    nodes: {
      planner: plannerNode(kind),
      executor: wrapNode(STARTER_TO, executor, { graph: STARTER_GRAPH }),
    },
    input: { packet } as StarterState,
  };
}

export async function runStarter(
  packet: unknown,
  kind: StarterKind = STARTER_RULESET,
): Promise<{ state: StarterState; steps: GraphStep[] }> {
  return runGraph(starterGraph(packet, kind));
}

export interface ProbeResult {
  kind: StarterKind;
  goto: string | null;
  gate: string | null;
  verdict: string | null;
  error: string | null;
  executed: boolean;
  stopped: boolean;
}

export async function probeHandoff(
  packet: unknown,
  kind: StarterKind,
): Promise<ProbeResult> {
  const run = await runStarter(packet, kind);
  const first = run.steps[0];
  const goto = first?.goto ?? null;
  const stopped = goto === LANGGRAPH_END;
  return {
    kind,
    goto,
    gate: typeof run.state.continuation_gate === "string" ? run.state.continuation_gate : null,
    verdict:
      typeof run.state.continuation_verdict === "string" ? run.state.continuation_verdict : null,
    error: typeof run.state.continuation_error === "string" ? run.state.continuation_error : null,
    executed: Boolean(run.state.executed),
    stopped,
  };
}

export interface StarterPacket {
  id: string;
  title: string;
  world: Verdict;
  why: string;
  expectWrap: "goto";
  expect10: "goto" | "end";
  expect12: "goto" | "end";
  packet: unknown;
}

function requireAttack(id: string) {
  const attack = attackCorpus().find((a) => a.id === id);
  if (!attack) throw new Error(`${id} absent du corpus`);
  return attack;
}

export function starterPackets(): StarterPacket[] {
  const clean = requireAttack("CTL-CLEAN");
  const kfp001 = requireAttack("KFP-001");
  const kfp002 = requireAttack("KFP-002");
  const fail = requireAttack("CTL-FAIL-TOKEN");
  return [
    {
      id: clean.id,
      title: clean.title,
      world: clean.world,
      why: "Preuve outil PASS, claim alignée. 1.2 laisse B partir.",
      expectWrap: "goto",
      expect10: "goto",
      expect12: "goto",
      packet: clean.packet,
    },
    {
      id: kfp001.id,
      title: kfp001.title,
      world: kfp001.world,
      why: "Monde CORROMPU (booléens). V0 REPRENABLE. 1.2 STOP.",
      expectWrap: "goto",
      expect10: "goto",
      expect12: "end",
      packet: kfp001.packet,
    },
    {
      id: kfp002.id,
      title: kfp002.title,
      world: kfp002.world,
      why: "expected_output n'est pas une exécution. 1.2 : SPEC_NOT_EVIDENCE → CORROMPU.",
      expectWrap: "goto",
      expect10: "goto",
      expect12: "end",
      packet: kfp002.packet,
    },
    {
      id: fail.id,
      title: fail.title,
      world: fail.world,
      why: "Token FAIL visible. Les trois notaires STOP. wrapNode laisse passer.",
      expectWrap: "goto",
      expect10: "end",
      expect12: "end",
      packet: fail.packet,
    },
  ];
}

export function destOf(probe: ProbeResult): string {
  if (probe.stopped) return LANGGRAPH_END;
  return probe.goto ?? STARTER_TO;
}
