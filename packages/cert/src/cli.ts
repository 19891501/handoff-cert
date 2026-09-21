import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { HandoffCert, parseRuleset } from "./client.ts";
import { UsageError } from "./errors.ts";
import type { RulesetId } from "./types.ts";
import { DEFAULT_BASE_URL, VERSION } from "./types.ts";

export const USAGE = `handoff-cert — TLS des reprises d'agents (preview, no paying customers)

Usage:
  handoff-cert certify [--ruleset 1.0|1.1|1.2] [--url URL] [file|-]
  handoff-cert gate    [--ruleset 1.0|1.1|1.2] [--url URL] [file|-]
  handoff-cert catalogue [--url URL]

Default URL: $HANDOFF_CERT_URL or ${DEFAULT_BASE_URL}
Default ruleset: 1.0 (receipt SKU handoff-cert-v1, 0.001€, frozen).
Paid grille: --ruleset 1.2 (SKU handoff-gate-v12, 0.05€). Billing is preview.
V0 is a frozen receipt, not a safety gate. MIT, not a standard.

Exit: 0 ok / PASS · 2 STOP · 1 error
`;

export type ParsedCli =
  | { ok: true; command: "help" }
  | { ok: true; command: "version" }
  | { ok: true; command: "catalogue"; url?: string }
  | {
      ok: true;
      command: "certify" | "gate";
      ruleset: RulesetId;
      url?: string;
      file?: string;
    }
  | { ok: false; error: string };

export function parseArgs(argv: string[]): ParsedCli {
  if (argv.length === 0) return { ok: true, command: "help" };
  const [cmd, ...rest] = argv;
  if (cmd === "-h" || cmd === "--help" || cmd === "help") {
    return { ok: true, command: "help" };
  }
  if (cmd === "-v" || cmd === "--version" || cmd === "version") {
    return { ok: true, command: "version" };
  }
  if (cmd !== "certify" && cmd !== "gate" && cmd !== "catalogue") {
    return { ok: false, error: `unknown command: ${cmd}` };
  }

  let ruleset: RulesetId = "1.0";
  let url: string | undefined;
  let file: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--ruleset" || arg === "-r") {
      const value = rest[i + 1];
      if (!value) return { ok: false, error: "--ruleset needs a value" };
      try {
        ruleset = parseRuleset(value);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      i += 1;
      continue;
    }
    if (arg.startsWith("--ruleset=")) {
      try {
        ruleset = parseRuleset(arg.slice("--ruleset=".length));
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      continue;
    }
    if (arg === "--url" || arg === "-u") {
      const value = rest[i + 1];
      if (!value) return { ok: false, error: "--url needs a value" };
      url = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--url=")) {
      url = arg.slice("--url=".length);
      continue;
    }
    if (arg === "-h" || arg === "--help") return { ok: true, command: "help" };
    if (arg.startsWith("-") && arg !== "-") {
      return { ok: false, error: `unexpected argument: ${arg}` };
    }
    if (file) return { ok: false, error: `unexpected argument: ${arg}` };
    file = arg;
  }

  if (cmd === "catalogue") {
    if (file) return { ok: false, error: "catalogue takes no packet file" };
    return { ok: true, command: "catalogue", url };
  }
  return { ok: true, command: cmd, ruleset, url, file };
}

export interface CliIo {
  fetch?: typeof fetch;
  readInput?: (file?: string) => Promise<string>;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  env?: NodeJS.ProcessEnv;
}

export async function defaultReadInput(file?: string): Promise<string> {
  if (!file || file === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  return readFile(file, "utf8");
}

function parsePaquetJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new UsageError("empty packet");
  let body: unknown;
  try {
    body = JSON.parse(trimmed);
  } catch {
    throw new UsageError("JSON invalide");
  }
  if (body && typeof body === "object" && "paquet" in body) {
    return (body as { paquet: unknown }).paquet;
  }
  return body;
}

export async function main(argv: string[], io: CliIo = {}): Promise<number> {
  const out = io.stdout ?? ((line) => process.stdout.write(`${line}\n`));
  const err = io.stderr ?? ((line) => process.stderr.write(`${line}\n`));
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    err(parsed.error);
    err(USAGE);
    return 1;
  }
  if (parsed.command === "help") {
    out(USAGE.trimEnd());
    return 0;
  }
  if (parsed.command === "version") {
    out(VERSION);
    return 0;
  }

  const client = new HandoffCert({
    baseUrl: parsed.url,
    fetch: io.fetch,
    env: io.env,
  });

  try {
    if (parsed.command === "catalogue") {
      const cat = await client.catalogue();
      out(JSON.stringify(cat, null, 2));
      return 0;
    }
    const readInput = io.readInput ?? defaultReadInput;
    const raw = await readInput(parsed.file);
    const paquet = parsePaquetJson(raw);
    if (parsed.command === "certify") {
      const res = await client.certify(paquet, { ruleset: parsed.ruleset });
      out(JSON.stringify(res, null, 2));
      return 0;
    }
    const gate = await client.gateResume(paquet, { ruleset: parsed.ruleset });
    out(JSON.stringify(gate, null, 2));
    return gate.decision === "STOP" ? 2 : 0;
  } catch (e) {
    if (e instanceof UsageError) {
      err(e.message);
      return 1;
    }
    const body = e && typeof e === "object" && "body" in e ? (e as { body: unknown }).body : undefined;
    if (body !== undefined) {
      err(JSON.stringify(body, null, 2));
    } else {
      err(e instanceof Error ? e.message : String(e));
    }
    return 1;
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  process.exit(await main(process.argv.slice(2)));
}
