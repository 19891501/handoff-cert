import {
  LANGGRAPH_END,
  runGraph,
  wrapNode,
  type GraphStep,
  type LangGraphCommand,
} from "./langgraph";

export interface Pattern {
  id: string;
  title: string;
  official: string;
  handoff: boolean;
  why: string;
  snippet: string;
  run: () => Promise<{ steps: GraphStep[]; state: Record<string, unknown> }>;
}

function graph(name: string, start: string, nodes: Record<string, (s: Record<string, unknown>) => unknown>, edges?: Record<string, string>, input: Record<string, unknown> = { ticket: "T-9" }) {
  const wrapped: Record<string, (s: Record<string, unknown>) => Promise<unknown>> = {};
  for (const [k, fn] of Object.entries(nodes)) {
    wrapped[k] = wrapNode(k, fn, { graph: name });
  }
  return () => runGraph({ name, start, nodes: wrapped, input, edges });
}

export const PATTERNS: Pattern[] = [
  {
    id: "transfer",
    title: "Transfer tool",
    official: "Command.goto dans le même graphe",
    handoff: true,
    why: "Un outil de transfert rend Command.goto. L'agent A s'arrête. B est un autre nœud.",
    snippet: `return new Command({
  goto: "sales_agent",
  update: { activeAgent: "sales_agent" },
})`,
    run: graph("support", "triage", {
      triage: (): LangGraphCommand => ({
        update: { activeAgent: "sales_agent", note: "transferred" },
        goto: "sales_agent",
      }),
      sales_agent: (s) => ({ closed: true, activeAgent: s.activeAgent }),
    }),
  },
  {
    id: "parent",
    title: "Sous-graphe",
    official: "Command.PARENT",
    handoff: true,
    why: "Le nœud enfant route vers un nœud du parent. Transfert inter-graphe.",
    snippet: `return new Command({
  goto: "sales_agent",
  graph: Command.PARENT,
  update: { messages: [...] },
})`,
    run: graph("child", "intake", {
      intake: (): LangGraphCommand => ({
        update: { handed: true },
        goto: "sales_agent",
        graph: "PARENT",
      }),
      sales_agent: () => ({ taken: true }),
    }),
  },
  {
    id: "send",
    title: "Send",
    official: "fan-out vers un nœud nommé",
    handoff: true,
    why: "Send({ node }) est un goto ciblé. Un successeur existe.",
    snippet: `return new Command({
  goto: { node: "worker" },
  update: { n: 1 },
})`,
    run: graph("map", "split", {
      split: (): LangGraphCommand => ({
        update: { n: 1 },
        goto: { node: "worker" },
      }),
      worker: () => ({ done: true }),
    }),
  },
  {
    id: "middleware",
    title: "Middleware",
    official: "un seul agent, currentStep",
    handoff: false,
    why: "Le même agent change de prompt et d'outils. Personne ne succéde. Ce n'est pas un handoff.",
    snippet: `wrapModelCall(request, handler) {
  const step = request.state.currentStep
  return handler({ ...request, tools: configs[step].tools })
}`,
    run: graph("single", "agent", {
      agent: () => ({
        currentStep: "specialist",
        warranty: "ok",
      }),
    }),
  },
  {
    id: "edge",
    title: "Edge statique",
    official: "addEdge, pas Command",
    handoff: false,
    why: "Le graphe continue par une arête compilée. Aucun Command.goto. Le wrap se tait.",
    snippet: `graph.addEdge("payment", "fulfillment")`,
    run: graph(
      "pipeline",
      "payment",
      {
        payment: () => ({ charged: true }),
        fulfillment: (s) => ({ fulfilled: Boolean(s.charged) }),
      },
      { payment: "fulfillment", fulfillment: LANGGRAPH_END },
    ),
  },
  {
    id: "resume",
    title: "Interrupt",
    official: "Command.resume",
    handoff: false,
    why: "On reprend le même nœud après une pause. Pas de successeur.",
    snippet: `graph.invoke(new Command({ resume: "yes" }))`,
    run: graph("review", "human", {
      human: (): LangGraphCommand => ({ resume: "approved" }),
    }),
  },
];
