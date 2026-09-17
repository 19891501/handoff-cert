export type HostId = "otel" | "langgraph" | "crewai" | "generic" | "unknown";

export const HOSTS: Array<{
  id: Exclude<HostId, "unknown">;
  label: string;
  already: string;
  added: number;
  patch: string;
}> = [
  {
    id: "langgraph",
    label: "LangGraph",
    already: "graph, nodes, checkpointer, tools",
    added: 1,
    patch: `.addNode(
  "payment_agent",
  wrapNode(
    "payment_agent",
    paymentAgent,
    { graph: "checkout" },
  ),
)`,
  },
  {
    id: "otel",
    label: "OpenTelemetry",
    already: "SDK, exporter, collector, spans",
    added: 2,
    patch: `from continuation_proof.otel import ContinuationProcessor
provider.add_span_processor(ContinuationProcessor())`,
  },
  {
    id: "crewai",
    label: "CrewAI",
    already: "crew, agents, tasks, tools",
    added: 3,
    patch: `from continuation_proof import adopt

@after_kickoff
def seal(output):
    output.continuation_proof = adopt(output)`,
  },
  {
    id: "generic",
    label: "HTTP / JSON",
    already: "handlers, middleware, logs",
    added: 2,
    patch: `proof = adopt(request.json)
response.headers["X-Continuation-Proof"] = proof["id"]`,
  },
];

export const STACK = [
  "OpenTelemetry",
  "Langfuse",
  "MLflow",
  "Redis",
  "MCP",
  "Guardrails",
  "Evals",
  "Tools",
  "Memory",
  "Queue",
  "Secrets",
  "Checkpointer",
] as const;

export const EVENTS: Record<Exclude<HostId, "unknown">, unknown> = {
  langgraph: {
    graph: "checkout",
    node: "payment_agent",
    command: { goto: "fulfillment_agent" },
    state: { order_id: "ord_9", charged: true },
    updates: { payment: { status: "succeeded", charge_id: "ch_1" } },
  },
  otel: {
    telemetry: "otel",
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    name: "gen_ai.client.handoff",
    attributes: {
      "gen_ai.agent.name": "payment",
      "gen_ai.handoff.target": "fulfillment",
    },
    events: [
      {
        name: "gen_ai.tool.result",
        attributes: { tool: "stripe.charges.create", status: "succeeded" },
      },
    ],
  },
  crewai: {
    crew: "checkout_crew",
    agent: "Payment Specialist",
    task: "Charge the customer",
    output: "Charged 100 EUR. charge_id=ch_1",
    handoff_to: "Fulfillment Specialist",
  },
  generic: {
    from: "agent_A",
    to: "agent_B",
    task: "Charge then fulfill",
    state: { order_id: "ord_9" },
  },
};

export const UNKNOWN_EVENT = { foo: 1, log: "task done" };

export function recognize(raw: unknown): HostId {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "unknown";
  const r = raw as Record<string, unknown>;
  if (r.telemetry === "otel" || (typeof r.traceId === "string" && typeof r.spanId === "string")) {
    return "otel";
  }
  if (typeof r.graph === "string" && (r.command || r.node)) return "langgraph";
  if (r.crew || (r.agent && r.task && r.handoff_to)) return "crewai";
  if (typeof r.from === "string" && typeof r.to === "string") return "generic";
  return "unknown";
}

export function tamper(host: Exclude<HostId, "unknown">, event: unknown): unknown {
  const rec = { ...(event as Record<string, unknown>) };
  if (host === "langgraph") {
    const state = { ...((rec.state as Record<string, unknown>) ?? {}), charged: false };
    return { ...rec, state };
  }
  if (host === "otel") {
    const attributes = {
      ...((rec.attributes as Record<string, unknown>) ?? {}),
      "gen_ai.handoff.target": "other",
    };
    return { ...rec, attributes };
  }
  if (host === "crewai") {
    return { ...rec, output: "altered" };
  }
  const state = { ...((rec.state as Record<string, unknown>) ?? {}), extra: 1 };
  return { ...rec, state };
}
