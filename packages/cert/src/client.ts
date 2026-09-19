import { HandoffCertError, PaymentRequiredError } from "./errors.ts";
import { fromCertificate } from "./gate.ts";
import type {
  Catalogue,
  CertifyResponse,
  ClientOptions,
  GateResult,
  RulesetId,
} from "./types.ts";
import { CERTIFY_PATH, DEFAULT_BASE_URL } from "./types.ts";

export function resolveBaseUrl(explicit?: string, env: NodeJS.ProcessEnv = process.env): string {
  const raw = explicit ?? env.HANDOFF_CERT_URL ?? DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function endpoint(baseUrl: string, path: string): string {
  return `${resolveBaseUrl(baseUrl)}${path}`;
}

function isRuleset(value: unknown): value is RulesetId {
  return value === "1.0" || value === "1.1" || value === "1.2";
}

export function parseRuleset(raw: unknown): RulesetId {
  if (raw == null || raw === "") return "1.0";
  const value = String(raw);
  if (isRuleset(value)) return value;
  throw new HandoffCertError(`ruleset inconnu: ${value}`, 400);
}

export class HandoffCert {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;
  private readonly payment?: string;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(opts.baseUrl, opts.env ?? process.env);
    this.fetchImpl = opts.fetch ?? fetch;
    this.headers = { ...(opts.headers ?? {}) };
    this.payment = opts.payment;
  }

  private requestHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...this.headers,
      ...extra,
    };
    if (this.payment) headers["X-PAYMENT"] = this.payment;
    return headers;
  }

  async catalogue(): Promise<Catalogue> {
    const res = await this.fetchImpl(endpoint(this.baseUrl, CERTIFY_PATH), {
      method: "GET",
      headers: this.requestHeaders(),
    });
    const body: unknown = await readJson(res);
    if (!res.ok) throw statusError(res.status, body);
    return body as Catalogue;
  }

  async certify(
    paquet: unknown,
    opts?: { ruleset?: RulesetId },
  ): Promise<CertifyResponse> {
    const ruleset = parseRuleset(opts?.ruleset);
    const res = await this.fetchImpl(endpoint(this.baseUrl, CERTIFY_PATH), {
      method: "POST",
      headers: this.requestHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ paquet, ruleset }),
    });
    const body: unknown = await readJson(res);
    if (res.status === 402) throw new PaymentRequiredError(body);
    if (!res.ok) throw statusError(res.status, body);
    return body as CertifyResponse;
  }

  async gateResume(
    paquet: unknown,
    opts?: { ruleset?: RulesetId },
  ): Promise<GateResult> {
    const ruleset = parseRuleset(opts?.ruleset);
    const certified = await this.certify(paquet, { ruleset });
    return fromCertificate(certified, ruleset);
  }
}

export function createClient(opts?: ClientOptions): HandoffCert {
  return new HandoffCert(opts);
}

export async function certify(
  paquet: unknown,
  opts?: ClientOptions & { ruleset?: RulesetId },
): Promise<CertifyResponse> {
  const { ruleset, ...clientOpts } = opts ?? {};
  return createClient(clientOpts).certify(paquet, { ruleset });
}

export async function gateResume(
  paquet: unknown,
  opts?: ClientOptions & { ruleset?: RulesetId },
): Promise<GateResult> {
  const { ruleset, ...clientOpts } = opts ?? {};
  return createClient(clientOpts).gateResume(paquet, { ruleset });
}

export async function catalogue(opts?: ClientOptions): Promise<Catalogue> {
  return createClient(opts).catalogue();
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { erreur: text };
  }
}

function statusError(status: number, body: unknown): HandoffCertError {
  const message =
    body && typeof body === "object" && "erreur" in body
      ? String((body as { erreur: unknown }).erreur)
      : `HTTP ${status}`;
  return new HandoffCertError(message, status, body);
}
