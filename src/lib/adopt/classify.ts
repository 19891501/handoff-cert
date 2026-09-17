import { LANGGRAPH_END, type LangGraphCommand } from "./langgraph";

export type Classification =
  | {
      handoff: true;
      dest: string;
      parent: boolean;
      label: string;
      why: string;
    }
  | {
      handoff: false;
      dest: string | null;
      parent: boolean;
      label: string;
      why: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function destOf(goto: unknown): string | null {
  if (typeof goto === "string") return goto;
  if (Array.isArray(goto)) {
    const first = goto[0];
    return destOf(first);
  }
  if (isRecord(goto) && typeof goto.node === "string") return goto.node;
  return null;
}

export function classify(value: unknown): Classification {
  if (value === null || value === undefined) {
    return {
      handoff: false,
      dest: null,
      parent: false,
      label: "vide",
      why: "Rien à router.",
    };
  }
  if (!isRecord(value)) {
    return {
      handoff: false,
      dest: null,
      parent: false,
      label: "non-objet",
      why: "Un Command est un objet { update, goto, graph, resume }.",
    };
  }
  const goto = value.goto;
  const dest = destOf(goto);
  const parent = value.graph === "PARENT" || value.graph === "Command.PARENT";
  const hasResume = value.resume !== undefined;
  const looksCommand = goto !== undefined || hasResume || "update" in value;

  if (!looksCommand) {
    return {
      handoff: false,
      dest: null,
      parent: false,
      label: "état",
      why: "Un return de nœud classique. L'edge statique n'est pas un handoff.",
    };
  }

  if (hasResume && goto === undefined) {
    return {
      handoff: false,
      dest: null,
      parent: false,
      label: "resume",
      why: "Command.resume reprend un interrupt. Personne ne succéde.",
    };
  }

  if (dest === null) {
    return {
      handoff: false,
      dest: null,
      parent,
      label: "goto vide",
      why: "goto est présent mais sans destination lisible.",
    };
  }

  if (dest === LANGGRAPH_END) {
    return {
      handoff: false,
      dest,
      parent,
      label: "fin",
      why: "__end__ termine le graphe. Ce n'est pas un transfert vers un autre agent.",
    };
  }

  if (parent) {
    return {
      handoff: true,
      dest,
      parent: true,
      label: "PARENT",
      why: "Handoff inter-graphe : goto vers un nœud du parent.",
    };
  }

  if (isRecord(goto) && typeof goto.node === "string") {
    return {
      handoff: true,
      dest,
      parent: false,
      label: "Send",
      why: "Send({ node }) est un handoff, éventuellement avec un état ciblé.",
    };
  }

  if (Array.isArray(goto)) {
    return {
      handoff: true,
      dest,
      parent: false,
      label: "fan-out",
      why: "goto en séquence. Le premier successeur reçoit le sceau.",
    };
  }

  return {
    handoff: true,
    dest,
    parent: false,
    label: "goto",
    why: "Command.goto vers un autre nœud : c'est le handoff.",
  };
}

export const PRESETS: Array<{
  id: string;
  title: string;
  value: unknown;
}> = [
  {
    id: "goto",
    title: "goto nœud",
    value: {
      update: { charged: true },
      goto: "fulfillment_agent",
    } satisfies LangGraphCommand,
  },
  {
    id: "parent",
    title: "graph PARENT",
    value: {
      update: { handed: true },
      goto: "sales_agent",
      graph: "PARENT",
    } satisfies LangGraphCommand,
  },
  {
    id: "send",
    title: "Send",
    value: {
      update: { n: 1 },
      goto: { node: "worker" },
    } satisfies LangGraphCommand,
  },
  {
    id: "end",
    title: "goto __end__",
    value: {
      update: { done: true },
      goto: LANGGRAPH_END,
    } satisfies LangGraphCommand,
  },
  {
    id: "resume",
    title: "resume",
    value: { resume: "approved" } satisfies LangGraphCommand,
  },
  {
    id: "state",
    title: "return état",
    value: { fulfilled: true },
  },
];
