/**
 * Run: npx tsx examples/langgraph/index.ts
 *
 * Shows how gateNode 1.2 stops Command.goto when the notary says CORROMPU.
 */
import { LANGGRAPH_END } from "../../src/lib/adopt/langgraph.ts";
import { probeHandoff, starterPackets, type ProbeResult } from "../../src/lib/adopt/starter.ts";

function cell(probe: ProbeResult): string {
  const dest = probe.stopped ? LANGGRAPH_END : (probe.goto ?? "?");
  const gate = probe.gate ?? "—";
  const verdict = probe.verdict ?? "—";
  return `${dest} ${gate} ${verdict}`.trim();
}

async function main() {
  const packets = starterPackets();
  const header = ["packet".padEnd(18), "wrapNode".padEnd(28), "gate 1.0".padEnd(28), "gate 1.2"].join(
    "  ",
  );
  console.log("HANDOFF CERT · starter LangGraph · ruleset 1.2");
  console.log("CORROMPU → goto __end__. wrapNode never judges.");
  console.log("");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of packets) {
    const wrap = await probeHandoff(row.packet, "wrap");
    const v10 = await probeHandoff(row.packet, "1.0");
    const v12 = await probeHandoff(row.packet, "1.2");
    console.log(
      [row.id.padEnd(18), cell(wrap).padEnd(28), cell(v10).padEnd(28), cell(v12)].join("  "),
    );
    if (row.expect12 === "end" && !v12.stopped) {
      throw new Error(`${row.id}: 1.2 should STOP goto on CORROMPU`);
    }
    if (row.expect12 === "goto" && v12.stopped) {
      throw new Error(`${row.id}: 1.2 should PASS a clean packet`);
    }
  }

  console.log("");
  console.log("How to stop goto on CORROMPU:");
  console.log('  gateNode("planner", planner, { ruleset: "1.2" })');
  console.log("  // STOP rewrites Command.goto → __end__");
}

await main();
