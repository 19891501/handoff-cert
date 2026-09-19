/**
 * LangGraph starter — gateNode ruleset 1.2.
 *
 * wrapNode observes Command.goto. gateNode certifies, then rewrites
 * goto to __end__ when the verdict is not REPRENABLE.
 *
 * Copy the addNode call. Do not copy wrapNode and call it a grille.
 */
export {
  STARTER_FROM,
  STARTER_GRAPH,
  STARTER_PATCH,
  STARTER_RULESET,
  STARTER_TO,
  destOf,
  probeHandoff,
  runStarter,
  starterGraph,
  starterPackets,
  type ProbeResult,
  type StarterKind,
  type StarterPacket,
  type StarterState,
} from "../../src/lib/adopt/starter.ts";

export { GATE_PATCH, LANGGRAPH_END, gateNode, wrapNode } from "../../src/lib/adopt/langgraph.ts";
